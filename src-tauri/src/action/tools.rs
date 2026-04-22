use tauri::AppHandle;

use crate::base::tools::ToolRegistry;

/// List all available built-in tool names.
#[tauri::command]
pub fn list_available_tools(_app: AppHandle) -> Result<Vec<String>, String> {
  let registry = ToolRegistry::new();
  let names: Vec<String> = registry.all().iter().map(|t| t.name().to_string()).collect();
  Ok(names)
}
