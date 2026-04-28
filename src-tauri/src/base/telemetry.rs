use std::collections::HashMap;
use std::path::Path;

use serde::{Deserialize, Serialize};

/// Cumulative token/tool statistics across sessions.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UsageStats {
  pub total_prompt_tokens: u64,
  pub total_completion_tokens: u64,
  pub total_tool_calls: u64,
  pub total_tool_errors: u64,
  pub total_messages: u64,
  /// Per-session stats keyed by session_id.
  pub sessions: HashMap<String, SessionStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SessionStats {
  pub session_id: String,
  pub prompt_tokens: u64,
  pub completion_tokens: u64,
  pub tool_calls: u64,
  pub tool_errors: u64,
  pub messages: u64,
}

impl UsageStats {
  pub fn load(data_dir: &Path) -> Self {
    let path = data_dir.join("stats.json");
    std::fs::read_to_string(&path)
      .ok()
      .and_then(|s| serde_json::from_str(&s).ok())
      .unwrap_or_default()
  }

  pub fn save(&self, data_dir: &Path) {
    let path = data_dir.join("stats.json");
    if let Ok(data) = serde_json::to_string(self) {
      let _ = std::fs::write(path, data);
    }
  }

  /// Record a completed LLM turn's token usage and tool outcomes.
  pub fn record(
    &mut self,
    session_id: &str,
    prompt_tokens: u64,
    completion_tokens: u64,
    tool_calls: u64,
    tool_errors: u64,
  ) {
    self.total_prompt_tokens += prompt_tokens;
    self.total_completion_tokens += completion_tokens;
    self.total_tool_calls += tool_calls;
    self.total_tool_errors += tool_errors;
    self.total_messages += 1;

    let session = self
      .sessions
      .entry(session_id.to_string())
      .or_insert_with(|| SessionStats {
        session_id: session_id.to_string(),
        ..Default::default()
      });
    session.prompt_tokens += prompt_tokens;
    session.completion_tokens += completion_tokens;
    session.tool_calls += tool_calls;
    session.tool_errors += tool_errors;
    session.messages += 1;
  }
}
