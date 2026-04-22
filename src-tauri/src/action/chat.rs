use std::sync::atomic::Ordering;

use tauri::ipc::Channel;
use tauri::{AppHandle, Manager};

use crate::base::agent::{AgentRuntime, AgentStreamEvent};
use crate::base::config::read_agent_config;
use crate::base::history::{read_chat_history, write_chat_history};
use crate::base::models::ChatHistoryState;
use crate::base::providers::factory::create_provider;
use crate::base::tools::{ToolContext, ToolRegistry};
use crate::share::agent::AppAgentState;

#[tauri::command]
pub fn get_chat_history(app: AppHandle) -> Result<Option<ChatHistoryState>, String> {
  read_chat_history(&app)
}

#[tauri::command]
pub fn save_chat_history(app: AppHandle, payload: ChatHistoryState) -> Result<bool, String> {
  write_chat_history(&app, &payload)
}

/// Send a message and receive events via Tauri Channel.
#[tauri::command]
pub async fn send_message(
  app: AppHandle,
  agent_state: tauri::State<'_, AppAgentState>,
  message: String,
  session_id: Option<String>,
  channel: Channel<AgentStreamEvent>,
) -> Result<(), String> {
  let message = message.trim().to_string();
  if message.is_empty() {
    return Err("消息不能为空".to_string());
  }

  let session_id = session_id
    .map(|v| v.trim().to_string())
    .filter(|v| !v.is_empty())
    .unwrap_or_else(|| "default".to_string());

  // Reset stop flag
  agent_state.stop_flag.store(false, Ordering::Relaxed);

  let config = read_agent_config(&app)?;
  let provider = create_provider(&config).map_err(|e| e.to_string())?;

  // Build tool registry
  let data_dir = app
    .path()
    .app_data_dir()
    .map_err(|e| format!("Cannot get app data dir: {e}"))?;
  let work_dir = data_dir.join("workspace");
  let tool_ctx = ToolContext {
    work_dir: work_dir.clone(),
    data_dir: data_dir.clone(),
    web_search_provider: config.web_search.provider.clone(),
    tavily_api_key: config.web_search.tavily_api_key.clone(),
    cdp_port: config.browser.cdp_port,
    chrome_executable: config.browser.chrome_executable.clone(),
  };

  let registry = ToolRegistry::new();
  // Register tools from enabled list if configured
  let tools = if config.enabled_tools.is_empty() {
    registry.all().into_iter().cloned().collect()
  } else {
    registry.get_tools_for_session(Some(&config.enabled_tools))
  };

  let runtime = AgentRuntime::new(provider, tools, tool_ctx, config.system_prompt.clone(), config.max_tool_rounds);

  let mut ctx = agent_state.get_or_create_session(&session_id).await;
  let stop_flag = std::sync::Arc::clone(&agent_state.stop_flag);

  runtime.run(&mut ctx, &message, channel, stop_flag).await;

  agent_state.save_session(ctx).await;
  Ok(())
}

#[tauri::command]
pub fn stop_message(agent_state: tauri::State<'_, AppAgentState>) -> Result<bool, String> {
  agent_state.stop_flag.store(true, Ordering::Relaxed);
  Ok(true)
}
