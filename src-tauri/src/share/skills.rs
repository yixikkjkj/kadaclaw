use std::collections::HashSet;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde_json::{json, Value};
use tauri::AppHandle;

use crate::base::models::{InstalledSkillRecord, SkillManifest};
use crate::base::runtime_config::{
  bundled_prefix, bundled_skills_dir, ensure_bundled_layout, ensure_runtime_config_object, runtime_config_path,
  write_runtime_config_value,
};
use crate::util::fs::{copy_directory_recursive, create_temp_subdir, extract_zip_bytes_to_dir};

// ---- skill directory helpers ----

pub fn skill_dir_name(skill_id: &str) -> String {
  skill_id
    .chars()
    .map(|ch| if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' { ch } else { '-' })
    .collect()
}

pub fn skills_dir_for_app(app: &AppHandle) -> Result<PathBuf, String> {
  let prefix = bundled_prefix(app)?;
  ensure_bundled_layout(&prefix)?;
  Ok(bundled_skills_dir(&prefix))
}

pub fn is_skill_directory(path: &Path) -> bool {
  path.join("skill.json").is_file() && path.join("SKILL.md").is_file()
}

pub fn find_workspace_skills_dir(start: &Path) -> Option<PathBuf> {
  let mut current = if start.is_dir() { start.to_path_buf() } else { start.parent()?.to_path_buf() };

  loop {
    let candidate = current.join("skills");
    if candidate.is_dir() {
      let entries = fs::read_dir(&candidate).ok()?;
      for entry in entries.flatten() {
        if is_skill_directory(&entry.path()) {
          return Some(candidate);
        }
      }
    }

    if !current.pop() {
      break;
    }
  }

  None
}

pub fn find_first_skill_directory(root: &Path) -> Option<PathBuf> {
  if is_skill_directory(root) {
    return Some(root.to_path_buf());
  }

  let entries = fs::read_dir(root).ok()?;
  for entry in entries.flatten() {
    let path = entry.path();
    if !path.is_dir() {
      continue;
    }

    if let Some(found) = find_first_skill_directory(&path) {
      return Some(found);
    }
  }

  None
}

// ---- skill enabled state ----

pub fn read_skill_enabled_state(app: &AppHandle, skill_id: &str) -> Result<bool, String> {
  let path = runtime_config_path(&bundled_prefix(app)?);
  let root = ensure_runtime_config_object(&path)?;

  Ok(
    root
      .get("skills")
      .and_then(|value| value.get("entries"))
      .and_then(|value| value.get(skill_id))
      .and_then(|value| value.get("enabled"))
      .and_then(Value::as_bool)
      .unwrap_or(true),
  )
}

pub fn write_skill_enabled_state(app: &AppHandle, skill_id: &str, enabled: bool) -> Result<bool, String> {
  let path = runtime_config_path(&bundled_prefix(app)?);
  let mut root = ensure_runtime_config_object(&path)?;
  let root_obj = root.as_object_mut().ok_or_else(|| "runtime 配置对象无效".to_string())?;

  let skills_value = root_obj.entry("skills".to_string()).or_insert_with(|| json!({}));
  if !skills_value.is_object() {
    *skills_value = json!({});
  }
  let skills_obj = skills_value
    .as_object_mut()
    .ok_or_else(|| "skills 配置无效".to_string())?;

  let entries_value = skills_obj.entry("entries".to_string()).or_insert_with(|| json!({}));
  if !entries_value.is_object() {
    *entries_value = json!({});
  }
  let entries_obj = entries_value
    .as_object_mut()
    .ok_or_else(|| "skills.entries 配置无效".to_string())?;

  let skill_value = entries_obj.entry(skill_id.to_string()).or_insert_with(|| json!({}));
  if !skill_value.is_object() {
    *skill_value = json!({});
  }
  let skill_obj = skill_value
    .as_object_mut()
    .ok_or_else(|| "skills.entries.<id> 配置无效".to_string())?;

  skill_obj.insert("enabled".to_string(), Value::Bool(enabled));

  write_runtime_config_value(&path, &root)?;
  Ok(true)
}

// ---- skill manifest ----

pub fn read_skill_manifest(manifest_path: &Path) -> Result<SkillManifest, String> {
  let content = fs::read_to_string(manifest_path)
    .map_err(|error| format!("无法读取技能清单 {}: {error}", manifest_path.display()))?;
  serde_json::from_str::<SkillManifest>(&content)
    .map_err(|error| format!("技能清单格式错误 {}: {error}", manifest_path.display()))
}

pub fn read_skill_manifest_from_dir(skill_dir: &Path) -> Result<SkillManifest, String> {
  if !skill_dir.is_dir() {
    return Err(format!("技能目录不存在: {}", skill_dir.display()));
  }

  if !skill_dir.join("SKILL.md").is_file() {
    return Err(format!("技能目录缺少 SKILL.md: {}", skill_dir.display()));
  }

  read_skill_manifest(&skill_dir.join("skill.json"))
}

pub fn build_installed_skill_record(
  skill_dir: &Path,
  manifest: &SkillManifest,
  enabled: bool,
  source_label: &str,
  source_type: &str,
  removable: bool,
) -> InstalledSkillRecord {
  InstalledSkillRecord {
    id: manifest.id.clone(),
    name: manifest.name.clone(),
    category: manifest.category.clone(),
    summary: manifest.summary.clone(),
    author: manifest.author.clone(),
    version: manifest.version.clone(),
    enabled,
    manifest_path: skill_dir.join("skill.json").to_string_lossy().to_string(),
    directory: skill_dir.to_string_lossy().to_string(),
    source_label: source_label.to_string(),
    source_type: source_type.to_string(),
    removable,
  }
}

// ---- local skill dirs discovery ----

pub fn normalize_local_skill_dirs(directories: &[String]) -> Vec<String> {
  let mut seen = HashSet::new();
  let mut normalized = Vec::new();

  for directory in directories {
    let value = directory.trim();
    if value.is_empty() {
      continue;
    }

    if seen.insert(value.to_string()) {
      normalized.push(value.to_string());
    }
  }

  normalized
}

pub fn discover_local_skill_dirs() -> Vec<String> {
  let mut directories = Vec::new();

  if let Ok(current_dir) = env::current_dir() {
    if let Some(skills_dir) = find_workspace_skills_dir(&current_dir) {
      directories.push(skills_dir.to_string_lossy().to_string());
    }
  }

  normalize_local_skill_dirs(&directories)
}

// ---- skill install ----

pub fn install_managed_skill_from_directory(
  app: &AppHandle,
  source_dir: &Path,
) -> Result<InstalledSkillRecord, String> {
  let manifest = read_skill_manifest_from_dir(source_dir)?;
  let target_dir = skills_dir_for_app(app)?.join(skill_dir_name(&manifest.id));
  let enabled = read_skill_enabled_state(app, &manifest.id)?;

  let source_canonical =
    fs::canonicalize(source_dir).map_err(|error| format!("无法解析技能目录 {}: {error}", source_dir.display()))?;
  let target_canonical = fs::canonicalize(&target_dir).ok();
  if target_canonical.as_ref() == Some(&source_canonical) {
    return Ok(build_installed_skill_record(&target_dir, &manifest, enabled, "应用托管", "bundled", true));
  }

  if target_dir.exists() {
    fs::remove_dir_all(&target_dir)
      .map_err(|error| format!("无法覆盖已安装技能目录 {}: {error}", target_dir.display()))?;
  }

  copy_directory_recursive(source_dir, &target_dir)?;
  let installed_manifest = read_skill_manifest_from_dir(&target_dir)?;

  Ok(build_installed_skill_record(&target_dir, &installed_manifest, enabled, "应用托管", "bundled", true))
}

pub async fn install_skill_from_url_impl(app: &AppHandle, url: String) -> Result<InstalledSkillRecord, String> {
  if url.is_empty() {
    return Err("技能链接不能为空".to_string());
  }

  if !url.starts_with("http://") && !url.starts_with("https://") {
    return Err("当前只支持 http/https 技能链接".to_string());
  }

  let response = reqwest::Client::new()
    .get(&url)
    .timeout(Duration::from_secs(30))
    .send()
    .await
    .map_err(|error| format!("下载技能失败: {error}"))?;

  if !response.status().is_success() {
    return Err(format!("下载技能失败，服务器返回 {}", response.status().as_u16()));
  }

  let bytes = response
    .bytes()
    .await
    .map_err(|error| format!("读取技能压缩包失败: {error}"))?;
  let temp_dir = create_temp_subdir("skill-install")?;
  let install_result = (|| -> Result<InstalledSkillRecord, String> {
    extract_zip_bytes_to_dir(bytes.as_ref(), &temp_dir)?;
    let skill_dir = find_first_skill_directory(&temp_dir)
      .ok_or_else(|| "压缩包中没有找到包含 skill.json 和 SKILL.md 的技能目录".to_string())?;
    install_managed_skill_from_directory(app, &skill_dir)
  })();
  let _ = fs::remove_dir_all(&temp_dir);
  install_result
}

// ---- skill registry ----

pub fn list_installed_skill_records(app: &AppHandle) -> Result<Vec<InstalledSkillRecord>, String> {
  let bundled_skills_dir_path = skills_dir_for_app(app)?;
  let local_skills_dirs = discover_local_skill_dirs();
  let mut records = Vec::new();
  let mut seen_ids = HashSet::new();
  let skill_sources = std::iter::once((bundled_skills_dir_path, "应用托管".to_string(), "bundled".to_string(), true))
    .chain(
      local_skills_dirs
        .into_iter()
        .map(|directory| (PathBuf::from(directory), "本地目录".to_string(), "local".to_string(), false)),
    );

  for (skills_dir, source_label, source_type, removable) in skill_sources {
    if !skills_dir.exists() {
      continue;
    }

    let entries =
      fs::read_dir(&skills_dir).map_err(|error| format!("无法读取技能目录 {}: {error}", skills_dir.display()))?;

    for entry in entries {
      let entry = entry.map_err(|error| format!("读取技能目录条目失败: {error}"))?;
      let path = entry.path();
      if !path.is_dir() {
        continue;
      }

      let manifest_path = path.join("skill.json");
      if !manifest_path.exists() {
        continue;
      }

      let manifest = read_skill_manifest(&manifest_path)?;
      let enabled = read_skill_enabled_state(app, &manifest.id)?;

      if !seen_ids.insert(manifest.id.clone()) {
        continue;
      }

      records.push(build_installed_skill_record(&path, &manifest, enabled, &source_label, &source_type, removable));
    }
  }

  records.sort_by(|a, b| a.id.cmp(&b.id));
  Ok(records)
}
