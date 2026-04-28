use serde::{Deserialize, Serialize};

use crate::base::providers::ChatMessage;

const MAX_HISTORY_CHARS: usize = 40_000; // safety-net truncation (~10k tokens)

/// Manages conversation history for a single session.
#[derive(Clone, Serialize, Deserialize)]
pub struct ConversationContext {
  pub session_id: String,
  pub messages: Vec<ChatMessage>,
  /// Prompt tokens reported by the provider in the last LLM turn.
  /// Zero means not yet known.
  #[serde(default)]
  pub last_prompt_tokens: u32,
}

impl ConversationContext {
  pub fn new(session_id: impl Into<String>) -> Self {
    Self {
      session_id: session_id.into(),
      messages: Vec::new(),
      last_prompt_tokens: 0,
    }
  }

  pub fn add(&mut self, msg: ChatMessage) {
    self.messages.push(msg);
    self.truncate_if_needed();
  }

  pub fn messages_with_system(&self, system_prompt: &str) -> Vec<ChatMessage> {
    let mut msgs = vec![ChatMessage::system(system_prompt)];
    msgs.extend_from_slice(&self.messages);
    msgs
  }

  /// Rough char-based token estimate (4 chars ≈ 1 token).
  pub fn token_count_approx(&self) -> u32 {
    let chars: usize = self
      .messages
      .iter()
      .map(|m| {
        m.content
          .as_ref()
          .and_then(|v| v.as_str())
          .map(|s| s.len())
          .unwrap_or(64) // tool messages may have no string content
      })
      .sum();
    (chars / 4) as u32
  }

  /// Safety-net truncation when context exceeds the hard char limit.
  /// Drops from the front while keeping tool-call pairs intact.
  fn truncate_if_needed(&mut self) {
    let total: usize = self
      .messages
      .iter()
      .map(|m| {
        m.content
          .as_ref()
          .and_then(|v| v.as_str())
          .map(|s| s.len())
          .unwrap_or(64)
      })
      .sum();

    if total <= MAX_HISTORY_CHARS {
      return;
    }

    // Drop from the front while never breaking a tool-call/tool-result pair.
    // A "safe" drop point is any index where the NEXT message is a user message.
    while self.messages.len() > 4 {
      let remaining: usize = self
        .messages
        .iter()
        .map(|m| {
          m.content
            .as_ref()
            .and_then(|v| v.as_str())
            .map(|s| s.len())
            .unwrap_or(64)
        })
        .sum();

      if remaining <= MAX_HISTORY_CHARS {
        break;
      }

      // Find the first safe drop point
      let drop_count = self.first_safe_drop_count();
      if drop_count == 0 {
        // Can't safely drop anything; break to avoid infinite loop
        break;
      }
      self.messages.drain(0..drop_count);
    }
  }

  /// Returns how many messages from the front can safely be dropped as a unit
  /// (i.e., won't leave orphaned tool_result messages).
  fn first_safe_drop_count(&self) -> usize {
    // Drop one message at a time; after removing, check if index 0 is "tool"
    // which would indicate an orphaned tool result.
    // Simple approach: look for the next position where role == "user" after index 0.
    for i in 1..self.messages.len() {
      if self.messages[i].role == "user" {
        return i;
      }
    }
    0
  }
}
