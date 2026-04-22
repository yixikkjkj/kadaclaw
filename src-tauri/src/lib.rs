mod action;
mod base;
mod share;
mod util;

use share::agent::AppAgentState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .manage(AppAgentState::default())
    .invoke_handler(tauri::generate_handler![
      // Config
      action::config::get_agent_config,
      action::config::save_agent_config,
      action::config::list_configured_providers,
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
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
