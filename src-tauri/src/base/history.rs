use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::base::models::ChatHistoryState;

fn chat_history_path(app: &AppHandle) -> Result<PathBuf, String> {
  let base_dir = app
    .path()
    .app_local_data_dir()
    .map_err(|error| format!("无法获取本地数据目录: {error}"))?;

  if !base_dir.exists() {
    fs::create_dir_all(&base_dir).map_err(|error| format!("无法创建本地数据目录: {error}"))?;
  }

  Ok(base_dir.join("chat-history.json"))
}

pub fn read_chat_history(app: &AppHandle) -> Result<Option<ChatHistoryState>, String> {
  let path = chat_history_path(app)?;
  if !path.exists() {
    return Ok(None);
  }

  let content = fs::read_to_string(&path).map_err(|error| format!("无法读取聊天记录 {}: {error}", path.display()))?;
  if content.trim().is_empty() {
    return Ok(None);
  }

  let history = serde_json::from_str::<ChatHistoryState>(&content)
    .map_err(|error| format!("无法解析聊天记录 {}: {error}", path.display()))?;

  Ok(Some(history))
}

pub fn write_chat_history(app: &AppHandle, payload: &ChatHistoryState) -> Result<bool, String> {
  let path = chat_history_path(app)?;
  let body = serde_json::to_string_pretty(payload).map_err(|error| format!("无法序列化聊天记录: {error}"))?;

  fs::write(&path, body).map_err(|error| format!("无法写入聊天记录 {}: {error}", path.display()))?;
  Ok(true)
}
