use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::mpsc;

use crate::util::error::Result;

// ── Message types ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallFunction {
  pub name: String,
  pub arguments: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
  pub id: String,
  #[serde(rename = "type", default = "function_str")]
  pub call_type: String,
  pub function: ToolCallFunction,
}

fn function_str() -> String {
  "function".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
  pub role: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub content: Option<Value>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub tool_calls: Option<Vec<ToolCall>>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub tool_call_id: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub name: Option<String>,
}

impl ChatMessage {
  pub fn system(content: impl Into<String>) -> Self {
    Self {
      role: "system".into(),
      content: Some(Value::String(content.into())),
      tool_calls: None,
      tool_call_id: None,
      name: None,
    }
  }

  pub fn user(content: impl Into<String>) -> Self {
    Self {
      role: "user".into(),
      content: Some(Value::String(content.into())),
      tool_calls: None,
      tool_call_id: None,
      name: None,
    }
  }

  pub fn assistant_text(content: impl Into<String>) -> Self {
    Self {
      role: "assistant".into(),
      content: Some(Value::String(content.into())),
      tool_calls: None,
      tool_call_id: None,
      name: None,
    }
  }

  pub fn assistant_with_tool_calls(text: Option<String>, tool_calls: Vec<ToolCall>) -> Self {
    Self {
      role: "assistant".into(),
      content: text.map(Value::String),
      tool_calls: Some(tool_calls),
      tool_call_id: None,
      name: None,
    }
  }

  pub fn tool_result(tool_call_id: impl Into<String>, content: impl Into<String>) -> Self {
    Self {
      role: "tool".into(),
      content: Some(Value::String(content.into())),
      tool_calls: None,
      tool_call_id: Some(tool_call_id.into()),
      name: None,
    }
  }
}

// ── Response types ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct LLMResponse {
  pub content: Option<String>,
  pub tool_calls: Vec<ToolCall>,
  pub finish_reason: String,
}

/// Streaming chunks from a provider.
/// Text deltas arrive incrementally; Done arrives once with any tool calls.
#[derive(Debug, Clone)]
pub enum StreamChunk {
  TextDelta {
    delta: String,
  },
  Done {
    finish_reason: String,
    tool_calls: Vec<ToolCall>,
  },
  Error {
    message: String,
  },
}

// ── Provider trait ─────────────────────────────────────────────────────────────

#[async_trait]
pub trait Provider: Send + Sync {
  /// Non-streaming chat. Default implementation collects from chat_stream.
  #[allow(dead_code)]
  async fn chat(&self, messages: &[ChatMessage], tools: &[Value]) -> Result<LLMResponse> {
    let (tx, mut rx) = mpsc::channel(256);
    self.chat_stream(messages, tools, tx).await?;
    let mut content = String::new();
    let mut finish_reason = "stop".to_string();
    let mut tool_calls = Vec::new();
    while let Some(chunk) = rx.recv().await {
      match chunk {
        StreamChunk::TextDelta { delta } => content.push_str(&delta),
        StreamChunk::Done {
          finish_reason: fr,
          tool_calls: tc,
        } => {
          finish_reason = fr;
          tool_calls = tc;
        },
        StreamChunk::Error { message } => {
          return Err(crate::util::error::KadaError::Provider(message));
        },
      }
    }
    Ok(LLMResponse {
      content: if content.is_empty() { None } else { Some(content) },
      tool_calls,
      finish_reason,
    })
  }

  /// Streaming chat. Sends chunks to `tx` and completes when done.
  async fn chat_stream(&self, messages: &[ChatMessage], tools: &[Value], tx: mpsc::Sender<StreamChunk>) -> Result<()>;
}

pub mod anthropic;
pub mod factory;
pub mod ollama;
pub mod openai;

// Provider types are imported directly from their submodules where needed.
