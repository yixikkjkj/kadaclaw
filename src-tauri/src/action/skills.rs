use std::fs;
use std::path::Path;

use tauri::AppHandle;

use crate::base::models::{
  InstallSkillFromDirectoryPayload, InstallSkillFromUrlPayload, InstalledSkillRecord, RecognizedSkillRecord,
};
use crate::share::skills::{
  install_managed_skill_from_directory, install_skill_from_url_impl, list_installed_skill_records, skill_dir_name,
  skills_dir_for_app, write_skill_enabled_state,
};

#[tauri::command]
pub fn list_installed_skills(app: AppHandle) -> Result<Vec<InstalledSkillRecord>, String> {
  list_installed_skill_records(&app)
}

#[tauri::command]
pub fn list_recognized_skills(app: AppHandle) -> Result<Vec<RecognizedSkillRecord>, String> {
  let records = list_installed_skill_records(&app)?;
  Ok(
    records
      .iter()
      .map(|record| RecognizedSkillRecord {
        name: record.id.clone(),
        description: record.summary.clone(),
        eligible: record.enabled,
        disabled: !record.enabled,
        blocked_by_allowlist: false,
        source: record.source_label.clone(),
        bundled: record.source_type == "bundled",
      })
      .collect(),
  )
}

#[tauri::command]
pub fn remove_skill(app: AppHandle, skill_id: String) -> Result<bool, String> {
  let skills_dir = skills_dir_for_app(&app)?;
  let skill_dir = skills_dir.join(skill_dir_name(&skill_id));

  if !skill_dir.exists() {
    return Err(format!("技能 `{skill_id}` 不存在"));
  }

  fs::remove_dir_all(&skill_dir).map_err(|error| format!("无法删除技能目录 {}: {error}", skill_dir.display()))?;
  Ok(true)
}

#[tauri::command]
pub fn set_skill_enabled(app: AppHandle, skill_id: String, enabled: bool) -> Result<bool, String> {
  write_skill_enabled_state(&app, &skill_id, enabled)
}

#[tauri::command]
pub fn install_skill_from_directory(
  app: AppHandle,
  payload: InstallSkillFromDirectoryPayload,
) -> Result<InstalledSkillRecord, String> {
  let source_dir = Path::new(&payload.directory);
  if !source_dir.is_dir() {
    return Err(format!("技能目录不存在: {}", payload.directory));
  }

  install_managed_skill_from_directory(&app, source_dir)
}

#[tauri::command]
pub async fn install_skill_from_url(
  app: AppHandle,
  payload: InstallSkillFromUrlPayload,
) -> Result<InstalledSkillRecord, String> {
  install_skill_from_url_impl(&app, payload.url).await
}
