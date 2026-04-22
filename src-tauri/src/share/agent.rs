use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::base::agent::ConversationContext;
use crate::base::providers::ChatMessage;

/// Tauri managed state for the AI agent system.
pub struct AppAgentState {
  /// Stop flag — set to true to abort the current generation
  pub stop_flag: Arc<AtomicBool>,
  /// Session ID → conversation history
  pub sessions: Arc<Mutex<HashMap<String, ConversationContext>>>,
}

impl AppAgentState {
  pub fn new() -> Self {
    Self {
      stop_flag: Arc::new(AtomicBool::new(false)),
      sessions: Arc::new(Mutex::new(HashMap::new())),
    }
  }

  /// Get or create a session context.
  pub async fn get_or_create_session(&self, session_id: &str) -> ConversationContext {
    let mut sessions = self.sessions.lock().await;
    if !sessions.contains_key(session_id) {
      sessions.insert(session_id.to_string(), ConversationContext::new(session_id));
    }
    // Clone the context for use; we'll write it back after the turn
    sessions.get(session_id).unwrap().clone()
  }

  /// Persist updated context back to state.
  pub async fn save_session(&self, ctx: ConversationContext) {
    let mut sessions = self.sessions.lock().await;
    sessions.insert(ctx.session_id.clone(), ctx);
  }

  /// Export session history as simple ChatMessage vec (for persistence).
  #[allow(dead_code)]
  pub async fn export_history(&self, session_id: &str) -> Vec<ChatMessage> {
    let sessions = self.sessions.lock().await;
    sessions
      .get(session_id)
      .map(|ctx| ctx.messages.clone())
      .unwrap_or_default()
  }

  /// Import history into a session.
  #[allow(dead_code)]
  pub async fn import_history(&self, session_id: &str, messages: Vec<ChatMessage>) {
    let mut sessions = self.sessions.lock().await;
    let ctx = sessions
      .entry(session_id.to_string())
      .or_insert_with(|| ConversationContext::new(session_id));
    ctx.messages = messages;
  }
}

impl Default for AppAgentState {
  fn default() -> Self {
    Self::new()
  }
}
