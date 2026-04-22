use tauri::AppHandle;

use crate::base::config::{read_agent_config, write_agent_config};
use crate::base::models::AgentConfig;

#[tauri::command]
pub fn get_agent_config(app: AppHandle) -> Result<AgentConfig, String> {
  read_agent_config(&app)
}

#[tauri::command]
pub fn save_agent_config(app: AppHandle, config: AgentConfig) -> Result<AgentConfig, String> {
  write_agent_config(&app, &config)?;
  Ok(config)
}

/// List provider IDs configured in the agent config.
#[tauri::command]
pub fn list_configured_providers(app: AppHandle) -> Result<Vec<String>, String> {
  let config = read_agent_config(&app)?;
  Ok(config.providers.keys().cloned().collect())
}
