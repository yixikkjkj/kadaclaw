use async_trait::async_trait;
use futures_util::StreamExt;
use reqwest::Client;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::Duration;
use tokio::sync::mpsc;

use crate::util::error::{KadaError, Result};

use super::{ChatMessage, Provider, StreamChunk, TokenUsage, ToolCall, ToolCallFunction};

pub struct OpenAIProvider {
  client: Client,
  api_key: String,
  api_base: String,
  model: String,
  max_tokens: u32,
  temperature: f32,
}

impl OpenAIProvider {
  pub fn new(api_key: &str, api_base: Option<&str>, model: &str) -> Self {
    let resolved_base = api_base
      .unwrap_or("https://api.openai.com/v1")
      .trim_end_matches('/')
      .to_string();
    let client = Client::builder()
      .timeout(Duration::from_secs(180))
      .build()
      .expect("Failed to build HTTP client");
    Self {
      client,
      api_key: api_key.to_string(),
      api_base: resolved_base,
      model: model.to_string(),
      max_tokens: 8192,
      temperature: 0.7,
    }
  }

  fn build_body(&self, messages: &[ChatMessage], tools: &[Value], stream: bool) -> Value {
    let mut body = json!({
        "model": &self.model,
        "messages": messages,
        "max_tokens": self.max_tokens,
        "temperature": self.temperature,
        "stream": stream,
    });
    if stream {
      // Request usage info in the final streaming chunk
      body["stream_options"] = json!({ "include_usage": true });
    }
    if !tools.is_empty() {
      body["tools"] = json!(tools);
      body["tool_choice"] = json!("auto");
    }
    body
  }
}

#[derive(Default)]
struct PartialToolCall {
  id: String,
  name: String,
  args: String,
}

#[async_trait]
impl Provider for OpenAIProvider {
  async fn chat(&self, messages: &[ChatMessage], tools: &[Value]) -> Result<super::LLMResponse> {
    let body = self.build_body(messages, tools, false);

    let resp = self
      .client
      .post(format!("{}/chat/completions", &self.api_base))
      .bearer_auth(&self.api_key)
      .json(&body)
      .send()
      .await?;

    if !resp.status().is_success() {
      let status = resp.status().as_u16();
      let text = resp.text().await.unwrap_or_default();
      return Err(KadaError::Provider(format!("OpenAI HTTP {status}: {text}")));
    }

    let json: Value = resp.json().await?;
    let choice = &json["choices"][0];
    let message = &choice["message"];

    let content = message["content"].as_str().map(String::from);
    let finish_reason = choice["finish_reason"].as_str().unwrap_or("stop").to_string();

    let tool_calls = message["tool_calls"]
      .as_array()
      .map(|arr| {
        arr
          .iter()
          .filter_map(|tc| {
            Some(ToolCall {
              id: tc["id"].as_str()?.to_string(),
              call_type: "function".to_string(),
              function: ToolCallFunction {
                name: tc["function"]["name"].as_str()?.to_string(),
                arguments: tc["function"]["arguments"].as_str().unwrap_or("{}").to_string(),
              },
            })
          })
          .collect()
      })
      .unwrap_or_default();

    Ok(super::LLMResponse {
      content,
      tool_calls,
      finish_reason,
    })
  }

  async fn chat_stream(&self, messages: &[ChatMessage], tools: &[Value], tx: mpsc::Sender<StreamChunk>) -> Result<()> {
    let body = self.build_body(messages, tools, true);

    let resp = self
      .client
      .post(format!("{}/chat/completions", &self.api_base))
      .bearer_auth(&self.api_key)
      .json(&body)
      .send()
      .await?;

    if !resp.status().is_success() {
      let status = resp.status().as_u16();
      let text = resp.text().await.unwrap_or_default();
      return Err(KadaError::Provider(format!("OpenAI HTTP {status}: {text}")));
    }

    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();
    let mut tool_acc: HashMap<usize, PartialToolCall> = HashMap::new();
    let mut finish_reason = String::from("stop");
    let mut usage: Option<TokenUsage> = None;

    while let Some(chunk) = stream.next().await {
      let bytes = chunk?;
      buffer.push_str(&String::from_utf8_lossy(&bytes));

      loop {
        match buffer.find('\n') {
          None => break,
          Some(pos) => {
            let line = buffer[..pos].trim().to_string();
            buffer = buffer[pos + 1..].to_string();

            if line.is_empty() || line == "data: [DONE]" {
              continue;
            }
            let Some(data_str) = line.strip_prefix("data: ") else {
              continue;
            };
            let Ok(val) = serde_json::from_str::<Value>(data_str) else {
              continue;
            };

            if let Some(reason) = val["choices"][0]["finish_reason"].as_str() {
              if reason != "null" {
                finish_reason = reason.to_string();
              }
            }

            // Capture usage from the extra chunk that OpenAI sends when stream_options.include_usage=true
            if let Some(usage_val) = val.get("usage").filter(|v| !v.is_null()) {
              let pt = usage_val["prompt_tokens"].as_u64().unwrap_or(0) as u32;
              let ct = usage_val["completion_tokens"].as_u64().unwrap_or(0) as u32;
              usage = Some(TokenUsage {
                prompt_tokens: pt,
                completion_tokens: ct,
                total_tokens: pt + ct,
              });
            }

            if let Some(delta_text) = val["choices"][0]["delta"]["content"].as_str() {
              if !delta_text.is_empty() {
                let _ = tx.send(StreamChunk::TextDelta { delta: delta_text.to_string() }).await;
              }
            }

            if let Some(tc_arr) = val["choices"][0]["delta"]["tool_calls"].as_array() {
              for tc in tc_arr {
                let idx = tc["index"].as_u64().unwrap_or(0) as usize;
                let entry = tool_acc.entry(idx).or_default();
                if let Some(id) = tc["id"].as_str() {
                  entry.id = id.to_string();
                }
                if let Some(name) = tc["function"]["name"].as_str() {
                  entry.name = name.to_string();
                }
                if let Some(args) = tc["function"]["arguments"].as_str() {
                  entry.args.push_str(args);
                }
              }
            }
          },
        }
      }
    }

    let tool_calls: Vec<ToolCall> = {
      let mut v: Vec<(usize, PartialToolCall)> = tool_acc.into_iter().collect();
      v.sort_by_key(|(k, _)| *k);
      v.into_iter()
        .filter(|(_, tc)| !tc.name.is_empty())
        .map(|(_, tc)| ToolCall {
          id: tc.id,
          call_type: "function".to_string(),
          function: ToolCallFunction {
            name: tc.name,
            arguments: tc.args,
          },
        })
        .collect()
    };

    let _ = tx
      .send(StreamChunk::Done {
        finish_reason,
        tool_calls,
        usage,
      })
      .await;
    Ok(())
  }
}
