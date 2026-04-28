use tauri::AppHandle;
use tauri::Manager;

use crate::base::telemetry::UsageStats;

#[tauri::command]
pub fn get_usage_stats(app: AppHandle) -> Result<UsageStats, String> {
  let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  Ok(UsageStats::load(&data_dir))
}
