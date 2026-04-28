use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::base::agent::ConversationContext;

/// Tauri managed state for the AI agent system.
pub struct AppAgentState {
  /// Stop flag — set to true to abort the current generation
  pub stop_flag: Arc<AtomicBool>,
  /// Session ID → conversation history (in-memory cache)
  pub sessions: Arc<Mutex<HashMap<String, ConversationContext>>>,
  /// App data dir for session persistence
  data_dir: std::sync::Mutex<Option<PathBuf>>,
}

impl AppAgentState {
  pub fn new() -> Self {
    Self {
      stop_flag: Arc::new(AtomicBool::new(false)),
      sessions: Arc::new(Mutex::new(HashMap::new())),
      data_dir: std::sync::Mutex::new(None),
    }
  }

  /// Set the data directory once after the app is set up.
  pub fn set_data_dir(&self, path: PathBuf) {
    let sessions_dir = path.join("sessions");
    let _ = std::fs::create_dir_all(&sessions_dir);
    *self.data_dir.lock().unwrap() = Some(path);
  }

  fn sessions_dir(&self) -> Option<PathBuf> {
    self.data_dir.lock().unwrap().as_ref().map(|d| d.join("sessions"))
  }

  /// Get or create a session context. Tries the in-memory cache first,
  /// then disk, then creates a fresh context.
  pub async fn get_or_create_session(&self, session_id: &str) -> ConversationContext {
    {
      let sessions = self.sessions.lock().await;
      if let Some(ctx) = sessions.get(session_id) {
        return ctx.clone();
      }
    }

    // Try loading from disk
    if let Some(dir) = self.sessions_dir() {
      let path = dir.join(format!("{}.json", session_id));
      if path.exists() {
        if let Ok(data) = std::fs::read_to_string(&path) {
          if let Ok(ctx) = serde_json::from_str::<ConversationContext>(&data) {
            let mut sessions = self.sessions.lock().await;
            sessions.insert(session_id.to_string(), ctx.clone());
            return ctx;
          }
        }
      }
    }

    // Create fresh
    let ctx = ConversationContext::new(session_id);
    {
      let mut sessions = self.sessions.lock().await;
      sessions.insert(session_id.to_string(), ctx.clone());
    }
    ctx
  }

  /// Persist updated context back to memory and disk.
  pub async fn save_session(&self, ctx: ConversationContext) {
    if let Some(dir) = self.sessions_dir() {
      let path = dir.join(format!("{}.json", ctx.session_id));
      if let Ok(data) = serde_json::to_string(&ctx) {
        let _ = std::fs::write(path, data);
      }
    }

    let mut sessions = self.sessions.lock().await;
    sessions.insert(ctx.session_id.clone(), ctx);
  }
}

impl Default for AppAgentState {
  fn default() -> Self {
    Self::new()
  }
}
