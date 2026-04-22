use async_trait::async_trait;
use futures_util::StreamExt;
use reqwest::Client;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::Duration;
use tokio::sync::mpsc;

use crate::util::error::{KadaError, Result};

use super::{ChatMessage, LLMResponse, Provider, StreamChunk, ToolCall, ToolCallFunction};

const ANTHROPIC_API_BASE: &str = "https://api.anthropic.com";
const ANTHROPIC_VERSION: &str = "2023-06-01";

pub struct AnthropicProvider {
  client: Client,
  api_key: String,
  api_base: String,
  model: String,
  max_tokens: u32,
}

impl AnthropicProvider {
  pub fn new(api_key: &str, api_base: Option<&str>, model: &str) -> Self {
    let resolved_base = api_base.unwrap_or(ANTHROPIC_API_BASE).trim_end_matches('/').to_string();
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
    }
  }

  /// Convert internal messages to Anthropic API format.
  /// Returns (system_prompt, messages).
  fn convert_messages(messages: &[ChatMessage]) -> (Option<String>, Vec<Value>) {
    let mut system_prompt = None;
    let mut result: Vec<Value> = Vec::new();

    for msg in messages {
      match msg.role.as_str() {
        "system" => {
          system_prompt = msg.content.as_ref().and_then(|v| v.as_str()).map(String::from);
        },
        "user" => {
          let text = msg.content.as_ref().and_then(|v| v.as_str()).unwrap_or("");
          result.push(json!({ "role": "user", "content": text }));
        },
        "tool" => {
          // Tool result → user message with tool_result block
          let content_text = msg.content.as_ref().and_then(|v| v.as_str()).unwrap_or("");
          let block = json!({
              "type": "tool_result",
              "tool_use_id": msg.tool_call_id.as_deref().unwrap_or(""),
              "content": content_text
          });
          // Merge consecutive tool results into the same user message
          if let Some(last) = result.last_mut() {
            if last["role"] == "user" {
              if let Some(arr) = last["content"].as_array_mut() {
                if arr.iter().any(|b| b["type"] == "tool_result") {
                  arr.push(block);
                  continue;
                }
              }
            }
          }
          result.push(json!({ "role": "user", "content": [block] }));
        },
        "assistant" => {
          if let Some(tc_list) = &msg.tool_calls {
            let mut content_arr: Vec<Value> = Vec::new();
            if let Some(text) = msg.content.as_ref().and_then(|v| v.as_str()) {
              if !text.is_empty() {
                content_arr.push(json!({ "type": "text", "text": text }));
              }
            }
            for tc in tc_list {
              let input: Value = serde_json::from_str(&tc.function.arguments).unwrap_or(json!({}));
              content_arr.push(json!({
                  "type": "tool_use",
                  "id": tc.id,
                  "name": tc.function.name,
                  "input": input
              }));
            }
            result.push(json!({ "role": "assistant", "content": content_arr }));
          } else {
            let text = msg.content.as_ref().and_then(|v| v.as_str()).unwrap_or("");
            result.push(json!({ "role": "assistant", "content": text }));
          }
        },
        _ => {},
      }
    }

    (system_prompt, result)
  }

  /// Convert OpenAI-style tool schemas to Anthropic format.
  fn convert_tools(tools: &[Value]) -> Vec<Value> {
    tools
      .iter()
      .filter_map(|t| {
        let f = t.get("function")?;
        let name = f.get("name")?.as_str()?;
        let description = f.get("description")?.as_str().unwrap_or("");
        let parameters = f.get("parameters").cloned().unwrap_or(json!({}));
        Some(json!({
            "name": name,
            "description": description,
            "input_schema": parameters
        }))
      })
      .collect()
  }
}

#[async_trait]
impl Provider for AnthropicProvider {
  async fn chat(&self, messages: &[ChatMessage], tools: &[Value]) -> Result<LLMResponse> {
    let (system, converted_msgs) = Self::convert_messages(messages);
    let anthropic_tools = Self::convert_tools(tools);

    let mut body = json!({
        "model": &self.model,
        "max_tokens": self.max_tokens,
        "messages": converted_msgs,
    });
    if let Some(sys) = system {
      body["system"] = json!(sys);
    }
    if !anthropic_tools.is_empty() {
      body["tools"] = json!(anthropic_tools);
      body["tool_choice"] = json!({ "type": "auto" });
    }

    let resp = self
      .client
      .post(format!("{}/v1/messages", &self.api_base))
      .header("x-api-key", &self.api_key)
      .header("anthropic-version", ANTHROPIC_VERSION)
      .json(&body)
      .send()
      .await?;

    if !resp.status().is_success() {
      let status = resp.status().as_u16();
      let text = resp.text().await.unwrap_or_default();
      return Err(KadaError::Provider(format!("Anthropic HTTP {status}: {text}")));
    }

    let json: Value = resp.json().await?;
    let stop_reason = json["stop_reason"].as_str().unwrap_or("end_turn").to_string();

    let mut text_content = String::new();
    let mut tool_calls: Vec<ToolCall> = Vec::new();

    if let Some(content_arr) = json["content"].as_array() {
      for block in content_arr {
        match block["type"].as_str() {
          Some("text") => {
            if let Some(t) = block["text"].as_str() {
              text_content.push_str(t);
            }
          },
          Some("tool_use") => {
            let id = block["id"].as_str().unwrap_or("").to_string();
            let name = block["name"].as_str().unwrap_or("").to_string();
            let input = block["input"].clone();
            let arguments = serde_json::to_string(&input).unwrap_or_else(|_| "{}".to_string());
            tool_calls.push(ToolCall {
              id,
              call_type: "function".to_string(),
              function: ToolCallFunction { name, arguments },
            });
          },
          _ => {},
        }
      }
    }

    let finish_reason = if stop_reason == "tool_use" { "tool_calls" } else { "stop" }.to_string();

    Ok(LLMResponse {
      content: if text_content.is_empty() { None } else { Some(text_content) },
      tool_calls,
      finish_reason,
    })
  }

  async fn chat_stream(&self, messages: &[ChatMessage], tools: &[Value], tx: mpsc::Sender<StreamChunk>) -> Result<()> {
    let (system, converted_msgs) = Self::convert_messages(messages);
    let anthropic_tools = Self::convert_tools(tools);

    let mut body = json!({
        "model": &self.model,
        "max_tokens": self.max_tokens,
        "messages": converted_msgs,
        "stream": true,
    });
    if let Some(sys) = system {
      body["system"] = json!(sys);
    }
    if !anthropic_tools.is_empty() {
      body["tools"] = json!(anthropic_tools);
      body["tool_choice"] = json!({ "type": "auto" });
    }

    let resp = self
      .client
      .post(format!("{}/v1/messages", &self.api_base))
      .header("x-api-key", &self.api_key)
      .header("anthropic-version", ANTHROPIC_VERSION)
      .json(&body)
      .send()
      .await?;

    if !resp.status().is_success() {
      let status = resp.status().as_u16();
      let text = resp.text().await.unwrap_or_default();
      return Err(KadaError::Provider(format!("Anthropic HTTP {status}: {text}")));
    }

    // Accumulate tool calls by index
    let mut tool_acc: HashMap<usize, (String, String, String)> = HashMap::new(); // idx -> (id, name, partial_json)
    let mut finish_reason = "stop".to_string();

    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
      let bytes = chunk?;
      buffer.push_str(&String::from_utf8_lossy(&bytes));

      loop {
        match buffer.find('\n') {
          None => break,
          Some(pos) => {
            let line = buffer[..pos].trim().to_string();
            buffer = buffer[pos + 1..].to_string();

            if line.is_empty() || line.starts_with("event:") {
              continue;
            }
            let Some(data_str) = line.strip_prefix("data: ") else {
              continue;
            };
            let Ok(val) = serde_json::from_str::<Value>(data_str) else {
              continue;
            };

            match val["type"].as_str() {
              Some("content_block_delta") => {
                let idx = val["index"].as_u64().unwrap_or(0) as usize;
                let delta = &val["delta"];
                match delta["type"].as_str() {
                  Some("text_delta") => {
                    if let Some(t) = delta["text"].as_str() {
                      if !t.is_empty() {
                        let _ = tx.send(StreamChunk::TextDelta { delta: t.to_string() }).await;
                      }
                    }
                  },
                  Some("input_json_delta") => {
                    if let Some(partial) = delta["partial_json"].as_str() {
                      let entry = tool_acc
                        .entry(idx)
                        .or_insert_with(|| (String::new(), String::new(), String::new()));
                      entry.2.push_str(partial);
                    }
                  },
                  _ => {},
                }
              },
              Some("content_block_start") => {
                let idx = val["index"].as_u64().unwrap_or(0) as usize;
                let block = &val["content_block"];
                if block["type"].as_str() == Some("tool_use") {
                  let id = block["id"].as_str().unwrap_or("").to_string();
                  let name = block["name"].as_str().unwrap_or("").to_string();
                  let entry = tool_acc
                    .entry(idx)
                    .or_insert_with(|| (String::new(), String::new(), String::new()));
                  entry.0 = id;
                  entry.1 = name;
                }
              },
              Some("message_delta") => {
                if let Some(reason) = val["delta"]["stop_reason"].as_str() {
                  finish_reason = if reason == "tool_use" { "tool_calls".to_string() } else { "stop".to_string() };
                }
              },
              _ => {},
            }
          },
        }
      }
    }

    let tool_calls: Vec<ToolCall> = {
      let mut v: Vec<(usize, (String, String, String))> = tool_acc.into_iter().collect();
      v.sort_by_key(|(k, _)| *k);
      v.into_iter()
        .filter(|(_, (_, name, _))| !name.is_empty())
        .map(|(_, (id, name, args))| ToolCall {
          id,
          call_type: "function".to_string(),
          function: ToolCallFunction { name, arguments: args },
        })
        .collect()
    };

    let _ = tx.send(StreamChunk::Done { finish_reason, tool_calls }).await;
    Ok(())
  }
}
