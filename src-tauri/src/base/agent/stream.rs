use serde::{Deserialize, Serialize};

/// Events sent to the frontend via Tauri Channel<AgentStreamEvent>.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentStreamEvent {
  /// A chunk of text from the LLM
  TextDelta { delta: String },
  /// A tool call is starting
  ToolCallStart { id: String, name: String, args: String },
  /// A tool call completed (with elapsed time in ms)
  ToolCallResult {
    id: String,
    name: String,
    result: String,
    duration_ms: u64,
    success: bool,
  },
  /// Generation complete
  Done { finish_reason: String },
  /// An error occurred
  Error { message: String },
  /// Token usage for the last LLM call
  TokenUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
  },
}
