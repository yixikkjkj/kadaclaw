mod action;
mod base;
mod share;
mod util;

use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

use base::config::read_agent_config;
use base::memory::MemoryStore;
use base::plan::PlanManager;
use base::tools::mcp::manager::McpManager;
use share::agent::AppAgentState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mcp_manager = Arc::new(Mutex::new(McpManager::new()));

  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .manage(AppAgentState::default())
    .manage(Arc::clone(&mcp_manager))
    .setup(move |app| {
      let handle = app.handle().clone();
      let manager = Arc::clone(&mcp_manager);

      // Set data dir for session persistence
      if let Ok(data_dir) = app.path().app_data_dir() {
        let agent_state = app.state::<AppAgentState>();
        agent_state.set_data_dir(data_dir.clone());

        // Open memory store
        match MemoryStore::open(&data_dir) {
          Ok(store) => {
            app.manage(Arc::new(Mutex::new(store)));
          },
          Err(e) => {
            tracing::error!("Failed to open memory store: {e}");
          },
        }

        // Open plan manager
        app.manage(Arc::new(Mutex::new(PlanManager::new(&data_dir))));
      }

      tauri::async_runtime::spawn(async move {
        let config = read_agent_config(&handle).unwrap_or_default();
        if !config.mcp_servers.is_empty() {
          tracing::info!("Starting {} MCP server(s)...", config.mcp_servers.len());
          manager.lock().await.start_all(&config.mcp_servers).await;
        }
      });
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      // Config
      action::config::get_agent_config,
      action::config::save_agent_config,
      action::config::list_configured_providers,
      action::config::restart_mcp_server,
      action::config::get_mcp_server_status,
      // Chat
      action::chat::get_chat_history,
      action::chat::save_chat_history,
      action::chat::send_message,
      action::chat::stop_message,
      // Tools
      action::tools::list_available_tools,
      // Skills
      action::skills::list_installed_skills,
      action::skills::list_recognized_skills,
      action::skills::remove_skill,
      action::skills::set_skill_enabled,
      action::skills::install_skill_from_directory,
      action::skills::install_skill_from_url,
      // Telemetry
      action::telemetry::get_usage_stats,
      // Memory
      action::memory::list_memories,
      action::memory::update_memory,
      action::memory::delete_memory,
      action::memory::clear_all_memories,
      // Plan
      action::plan::create_plan,
      action::plan::execute_plan_step,
      action::plan::approve_plan_step,
      action::plan::skip_plan_step,
      action::plan::list_plans,
      action::plan::get_plan,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
