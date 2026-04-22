use serde_json::{Map, Value};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

pub fn bundled_prefix(app: &AppHandle) -> Result<PathBuf, String> {
  let base_dir = app
    .path()
    .app_local_data_dir()
    .map_err(|error| format!("无法获取本地数据目录: {error}"))?;

  let prefix = base_dir.join("kadaclaw-runtime");
  if !prefix.exists() {
    fs::create_dir_all(&prefix).map_err(|error| format!("无法创建 runtime 目录: {error}"))?;
  }

  Ok(prefix)
}

pub fn bundled_skills_dir(prefix: &Path) -> PathBuf {
  prefix.join("skills")
}

pub fn runtime_config_path(prefix: &Path) -> PathBuf {
  prefix.join("config").join("runtime.json")
}

pub fn ensure_bundled_layout(prefix: &Path) -> Result<(), String> {
  let dirs = [
    prefix.join("bin"),
    prefix.join("state"),
    prefix.join("config"),
    bundled_skills_dir(prefix),
  ];

  for dir in dirs {
    if !dir.exists() {
      fs::create_dir_all(&dir).map_err(|error| format!("无法创建目录 {}: {error}", dir.display()))?;
    }
  }

  Ok(())
}

pub fn read_runtime_config_value(path: &Path) -> Result<Value, String> {
  if path.exists() {
    let content = fs::read_to_string(path).map_err(|error| format!("无法读取配置文件 {}: {error}", path.display()))?;
    Ok(serde_json::from_str::<Value>(&content).unwrap_or_else(|_| Value::Object(Map::new())))
  } else {
    Ok(Value::Object(Map::new()))
  }
}

pub fn write_runtime_config_value(path: &Path, root: &Value) -> Result<(), String> {
  let body = serde_json::to_string_pretty(root).map_err(|error| format!("无法序列化运行时配置: {error}"))?;
  fs::write(path, body).map_err(|error| format!("无法更新运行时配置 {}: {error}", path.display()))
}

pub fn ensure_runtime_config_object(path: &Path) -> Result<Value, String> {
  let mut root = read_runtime_config_value(path)?;
  if !root.is_object() {
    root = Value::Object(Map::new());
  }
  Ok(root)
}
