use std::sync::atomic::Ordering;
use std::sync::Arc;

use tauri::ipc::Channel;
use tauri::{AppHandle, Manager};
use tokio::sync::Mutex;

use crate::base::agent::{AgentRuntime, AgentStreamEvent};
use crate::base::config::read_agent_config;
use crate::base::history::{read_chat_history, write_chat_history};
use crate::base::models::ChatHistoryState;
use crate::base::providers::factory::create_provider;
use crate::base::telemetry::UsageStats;
use crate::base::tools::mcp::manager::McpManager;
use crate::base::tools::memory::build_memory_tools;
use crate::base::tools::{ToolContext, ToolRegistry};
use crate::share::agent::AppAgentState;
use crate::share::skills::build_skill_injection;

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
  let mut tools = if config.enabled_tools.is_empty() {
    registry.all().into_iter().cloned().collect::<Vec<_>>()
  } else {
    registry.get_tools_for_session(Some(&config.enabled_tools))
  };

  // Append MCP tools
  let mcp_manager = app.state::<Arc<Mutex<McpManager>>>();
  let mcp_tools = mcp_manager.lock().await.all_tools().await;
  tools.extend(mcp_tools);

  // Open a MemoryStore handle for tool use and memory injection.
  // SQLite WAL mode allows multiple readers, so opening a second handle is safe.
  let memory_arc = crate::base::memory::MemoryStore::open(&data_dir)
    .ok()
    .map(std::sync::Arc::new);

  if let Some(ref mem) = memory_arc {
    tools.extend(build_memory_tools(std::sync::Arc::clone(mem)));
  }

  // Retrieve relevant memories and inject into system prompt
  let memory_injection = if let Some(ref mem) = memory_arc {
    match mem.search(&message, None, None, 5) {
      Ok(entries) if !entries.is_empty() => {
        let lines = entries
          .iter()
          .map(|e| format!("- [{}] {}", e.memory_type, e.content))
          .collect::<Vec<_>>()
          .join("\n");
        format!("\n\n---\n# Relevant Memories\n\n{lines}")
      },
      _ => String::new(),
    }
  } else {
    String::new()
  };

  // Build skill injection (SKILL.md content → system prompt)
  let skill_result = build_skill_injection(&app)?;

  // Apply per-skill tool whitelist: if any enabled skill declares a tools list,
  // restrict to the union of those declared tools.
  if let Some(ref whitelist) = skill_result.tool_whitelist {
    tools.retain(|t| whitelist.contains(t.name()));
  }

  let effective_system_prompt = if skill_result.injection.is_empty() {
    format!("{}{}", config.system_prompt, memory_injection)
  } else {
    format!("{}\n\n{}{}", config.system_prompt, skill_result.injection, memory_injection)
  };

  let runtime = AgentRuntime::new(
    provider,
    tools,
    tool_ctx,
    effective_system_prompt,
    config.max_tool_rounds,
    config.token_budget,
    config.compact_threshold,
  );

  let mut ctx = agent_state.get_or_create_session(&session_id).await;
  let stop_flag = std::sync::Arc::clone(&agent_state.stop_flag);

  let run_stats = runtime.run(&mut ctx, &message, channel, stop_flag).await;

  agent_state.save_session(ctx).await;

  // Record telemetry
  let mut usage = UsageStats::load(&data_dir);
  usage.record(
    &session_id,
    run_stats.prompt_tokens,
    run_stats.completion_tokens,
    run_stats.tool_calls,
    run_stats.tool_errors,
  );
  usage.save(&data_dir);

  Ok(())
}

#[tauri::command]
pub fn stop_message(agent_state: tauri::State<'_, AppAgentState>) -> Result<bool, String> {
  agent_state.stop_flag.store(true, Ordering::Relaxed);
  Ok(true)
}
