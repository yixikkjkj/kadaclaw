use std::sync::Arc;

use tauri::AppHandle;
use tokio::sync::Mutex;

use crate::base::config::{read_agent_config, write_agent_config};
use crate::base::models::AgentConfig;
use crate::base::tools::mcp::manager::McpManager;

#[tauri::command]
pub fn get_agent_config(app: AppHandle) -> Result<AgentConfig, String> {
  read_agent_config(&app)
}

#[tauri::command]
pub async fn save_agent_config(
  app: AppHandle,
  config: AgentConfig,
  mcp_manager: tauri::State<'_, Arc<Mutex<McpManager>>>,
) -> Result<AgentConfig, String> {
  write_agent_config(&app, &config)?;
  // Restart MCP servers with new config
  let manager = mcp_manager.lock().await;
  manager.shutdown().await;
  manager.start_all(&config.mcp_servers).await;
  Ok(config)
}

/// List provider IDs configured in the agent config.
#[tauri::command]
pub fn list_configured_providers(app: AppHandle) -> Result<Vec<String>, String> {
  let config = read_agent_config(&app)?;
  Ok(config.providers.keys().cloned().collect())
}

/// Restart a single MCP server without saving config.
#[tauri::command]
pub async fn restart_mcp_server(
  app: AppHandle,
  server_id: String,
  mcp_manager: tauri::State<'_, Arc<Mutex<McpManager>>>,
) -> Result<(), String> {
  let config = read_agent_config(&app)?;
  let server_config = config
    .mcp_servers
    .get(&server_id)
    .ok_or_else(|| format!("MCP server '{}' not found in config", server_id))?
    .clone();

  let manager = mcp_manager.lock().await;
  manager.restart_server(&server_id, &server_config).await;
  Ok(())
}

/// Returns a map of server_id → is_running for all configured MCP servers.
#[tauri::command]
pub async fn get_mcp_server_status(
  mcp_manager: tauri::State<'_, Arc<Mutex<McpManager>>>,
) -> Result<std::collections::HashMap<String, bool>, String> {
  let manager = mcp_manager.lock().await;
  Ok(manager.server_statuses().await)
}
