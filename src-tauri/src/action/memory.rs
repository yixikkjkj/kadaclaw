use std::sync::Arc;

use tauri::AppHandle;
use tokio::sync::Mutex;

use crate::base::memory::{MemoryEntry, MemoryStore};

pub type MemoryStoreState = Arc<Mutex<MemoryStore>>;

#[tauri::command]
pub async fn list_memories(
  _app: AppHandle,
  memory_store: tauri::State<'_, MemoryStoreState>,
  query: Option<String>,
) -> Result<Vec<MemoryEntry>, String> {
  let store = memory_store.lock().await;
  store.list(query.as_deref(), 100)
}

#[tauri::command]
pub async fn update_memory(
  memory_store: tauri::State<'_, MemoryStoreState>,
  id: String,
  content: String,
) -> Result<bool, String> {
  let store = memory_store.lock().await;
  store.update_content(&id, &content)
}

#[tauri::command]
pub async fn delete_memory(memory_store: tauri::State<'_, MemoryStoreState>, id: String) -> Result<bool, String> {
  let store = memory_store.lock().await;
  store.soft_delete(&id)
}

#[tauri::command]
pub async fn clear_all_memories(memory_store: tauri::State<'_, MemoryStoreState>) -> Result<bool, String> {
  let store = memory_store.lock().await;
  store.clear_all()
}
