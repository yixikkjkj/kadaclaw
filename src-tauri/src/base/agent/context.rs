use crate::base::providers::ChatMessage;

const MAX_HISTORY_TOKENS_APPROX: usize = 40_000; // ~40k chars (~10k tokens)

/// Manages conversation history for a single session.
#[derive(Clone)]
pub struct ConversationContext {
  pub session_id: String,
  pub messages: Vec<ChatMessage>,
}

impl ConversationContext {
  pub fn new(session_id: impl Into<String>) -> Self {
    Self {
      session_id: session_id.into(),
      messages: Vec::new(),
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

  /// Remove oldest user/assistant turns if context is too large.
  fn truncate_if_needed(&mut self) {
    let total: usize = self
      .messages
      .iter()
      .map(|m| {
        m.content
          .as_ref()
          .and_then(|v| v.as_str())
          .map(|s| s.len())
          .unwrap_or(0)
      })
      .sum();

    if total <= MAX_HISTORY_TOKENS_APPROX {
      return;
    }

    // Drop oldest pairs until within limit
    while self.messages.len() > 4 {
      let remaining: usize = self
        .messages
        .iter()
        .map(|m| {
          m.content
            .as_ref()
            .and_then(|v| v.as_str())
            .map(|s| s.len())
            .unwrap_or(0)
        })
        .sum();

      if remaining <= MAX_HISTORY_TOKENS_APPROX {
        break;
      }
      self.messages.remove(0);
    }
  }
}
