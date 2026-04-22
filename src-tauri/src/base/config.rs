use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::base::models::AgentConfig;

fn agent_config_path(app: &AppHandle) -> Result<PathBuf, String> {
  let base_dir = app
    .path()
    .app_config_dir()
    .map_err(|e| format!("无法获取配置目录: {e}"))?;
  if !base_dir.exists() {
    fs::create_dir_all(&base_dir).map_err(|e| format!("无法创建配置目录: {e}"))?;
  }
  Ok(base_dir.join("agent_config.json"))
}

pub fn read_agent_config(app: &AppHandle) -> Result<AgentConfig, String> {
  let path = agent_config_path(app)?;
  if !path.exists() {
    return Ok(AgentConfig::default());
  }
  let content = fs::read_to_string(&path).map_err(|e| format!("无法读取 agent config: {e}"))?;
  serde_json::from_str(&content).map_err(|e| format!("agent config 格式错误: {e}"))
}

pub fn write_agent_config(app: &AppHandle, config: &AgentConfig) -> Result<(), String> {
  let path = agent_config_path(app)?;
  let body = serde_json::to_string_pretty(config).map_err(|e| format!("无法序列化 agent config: {e}"))?;
  fs::write(path, body).map_err(|e| format!("无法写入 agent config: {e}"))
}
