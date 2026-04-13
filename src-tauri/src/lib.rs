use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::collections::HashSet;
use std::env;
use std::fs;
use std::io::Cursor;
use std::net::{TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

const BUNDLED_GATEWAY_PORT: u16 = 18795;
const LEGACY_BUNDLED_GATEWAY_PORT: u16 = 18789;
const OLDER_BUNDLED_GATEWAY_PORT: u16 = 18791;
const DEFAULT_OPENCLAW_HEALTH_PATH: &str = "/v1/models";
const OPENCLAW_HEALTH_PROBE_TIMEOUT_SECS: u64 = 5;
const OPENCLAW_HEALTH_PROBE_ATTEMPTS: usize = 2;
const OPENCLAW_RUNTIME_READY_TIMEOUT_SECS: u64 = 90;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct OpenClawConfig {
  enabled: bool,
  display_name: String,
  base_url: String,
  health_path: String,
  model: String,
  command: String,
  args: Vec<String>,
  working_directory: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenClawStatus {
  configured: bool,
  bundled: bool,
  executable_found: bool,
  reachable: bool,
  launchable: bool,
  endpoint: String,
  command_path: String,
  message: String,
  http_status: Option<u16>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct InstallOpenClawResult {
  prefix: String,
  config: OpenClawConfig,
  status: OpenClawStatus,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DashboardUrlResult {
  url: String,
}

fn bundled_gateway_base_url() -> String {
  format!("http://127.0.0.1:{BUNDLED_GATEWAY_PORT}")
}

fn build_gateway_run_args(port: u16) -> Vec<String> {
  vec![
    "gateway".to_string(),
    "run".to_string(),
    "--allow-unconfigured".to_string(),
    "--port".to_string(),
    port.to_string(),
    "--force".to_string(),
  ]
}

fn has_gateway_port_arg(args: &[String], port: u16) -> bool {
  args
    .windows(2)
    .any(|pair| pair[0] == "--port" && pair[1] == port.to_string())
}

fn replace_gateway_port_arg(args: &[String], port: u16) -> Vec<String> {
  if args.is_empty() {
    return build_gateway_run_args(port);
  }

  let mut next_args = Vec::with_capacity(args.len() + 2);
  let mut index = 0;
  let mut replaced = false;

  while index < args.len() {
    let current = &args[index];
    if current == "--port" && index + 1 < args.len() {
      next_args.push(current.clone());
      next_args.push(port.to_string());
      index += 2;
      replaced = true;
      continue;
    }

    next_args.push(current.clone());
    index += 1;
  }

  if !replaced {
    next_args.push("--port".to_string());
    next_args.push(port.to_string());
  }

  next_args
}

fn remove_gateway_auth_override(args: &[String]) -> Vec<String> {
  if args.is_empty() {
    return Vec::new();
  }

  let mut next_args = Vec::with_capacity(args.len());
  let mut index = 0;

  while index < args.len() {
    let current = &args[index];
    if current == "--auth" {
      index += if index + 1 < args.len() { 2 } else { 1 };
      continue;
    }

    next_args.push(current.clone());
    index += 1;
  }

  next_args
}

fn open_external_url(url: &str) -> Result<(), String> {
  #[cfg(target_os = "windows")]
  let output = Command::new("cmd")
    .args(["/C", "start", "", url])
    .output()
    .map_err(|error| format!("无法打开浏览器: {error}"))?;

  #[cfg(target_os = "macos")]
  let output = Command::new("open")
    .arg(url)
    .output()
    .map_err(|error| format!("无法打开浏览器: {error}"))?;

  #[cfg(all(unix, not(target_os = "macos")))]
  let output = Command::new("xdg-open")
    .arg(url)
    .output()
    .map_err(|error| format!("无法打开浏览器: {error}"))?;

  if output.status.success() {
    return Ok(());
  }

  let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
  let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();

  Err(if !stderr.is_empty() {
    stderr
  } else if !stdout.is_empty() {
    stdout
  } else {
    "打开浏览器失败".to_string()
  })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeInfoResult {
  installed: bool,
  bundled: bool,
  version: String,
  version_error: Option<String>,
  command_path: String,
  install_dir: String,
  skills_dir: String,
  local_skills_dirs: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenClawSelfCheckItem {
  key: String,
  label: String,
  status: String,
  detail: String,
  suggestion: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenClawSelfCheckResult {
  runtime_info: RuntimeInfoResult,
  runtime_status: OpenClawStatus,
  checked_at: i64,
  items: Vec<OpenClawSelfCheckItem>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenClawAuthConfig {
  provider: String,
  model: String,
  api_key_env_name: String,
  api_key_configured: bool,
  api_base_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenClawLocalSkillsDirsConfig {
  directories: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveOpenClawAuthPayload {
  provider: String,
  model: String,
  api_key: String,
  api_base_url: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SendOpenClawMessagePayload {
  message: String,
  session_id: Option<String>,
  thinking: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenClawChatResponse {
  session_id: String,
  reply: String,
  raw_output: Value,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct OpenClawChatStreamEvent {
  session_id: String,
  status: String,
  reply: String,
  raw_output: Value,
}

#[derive(Default)]
struct ActiveChatProcessState {
  pid: Mutex<Option<u32>>,
  stream: Mutex<Option<OpenClawChatStreamEvent>>,
  stop_requested: Mutex<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ChatHistoryMessage {
  id: String,
  role: String,
  content: Value,
  raw_content: Option<Value>,
  created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ChatHistorySession {
  id: String,
  title: String,
  created_at: String,
  updated_at: String,
  messages: Vec<ChatHistoryMessage>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ChatHistoryState {
  active_chat_session_id: String,
  chat_sessions: Vec<ChatHistorySession>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SkillManifest {
  id: String,
  name: String,
  category: String,
  summary: String,
  author: String,
  version: String,
  entry: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct InstalledSkillRecord {
  id: String,
  name: String,
  category: String,
  summary: String,
  author: String,
  version: String,
  manifest_path: String,
  directory: String,
  source_label: String,
  source_type: String,
  removable: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OpenClawSkillsListResponse {
  skills: Vec<OpenClawSkillEntry>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenClawSkillEntry {
  name: String,
  description: String,
  eligible: bool,
  disabled: bool,
  blocked_by_allowlist: bool,
  source: String,
  bundled: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveConfigPayload {
  enabled: bool,
  display_name: String,
  base_url: String,
  health_path: String,
  model: String,
  command: String,
  args: Vec<String>,
  working_directory: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveOpenClawLocalSkillsDirsPayload {
  directories: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstallSkillFromDirectoryPayload {
  directory: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstallSkillFromUrlPayload {
  url: String,
}

impl Default for OpenClawConfig {
  fn default() -> Self {
    Self {
      enabled: true,
      display_name: "OpenClaw Runtime".to_string(),
      base_url: bundled_gateway_base_url(),
      health_path: DEFAULT_OPENCLAW_HEALTH_PATH.to_string(),
      model: "anthropic/claude-opus-4-6".to_string(),
      command: "openclaw".to_string(),
      args: build_gateway_run_args(BUNDLED_GATEWAY_PORT),
      working_directory: String::new(),
    }
  }
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
  let base_dir = app
    .path()
    .app_config_dir()
    .map_err(|error| format!("无法获取配置目录: {error}"))?;

  if !base_dir.exists() {
    fs::create_dir_all(&base_dir).map_err(|error| format!("无法创建配置目录: {error}"))?;
  }

  Ok(base_dir.join("openclaw.json"))
}

fn bundled_prefix(app: &AppHandle) -> Result<PathBuf, String> {
  let base_dir = app
    .path()
    .app_local_data_dir()
    .map_err(|error| format!("无法获取本地数据目录: {error}"))?;

  let prefix = base_dir.join("openclaw-runtime");
  if !prefix.exists() {
    fs::create_dir_all(&prefix).map_err(|error| format!("无法创建 runtime 目录: {error}"))?;
  }

  Ok(prefix)
}

fn chat_history_path(app: &AppHandle) -> Result<PathBuf, String> {
  let base_dir = app
    .path()
    .app_local_data_dir()
    .map_err(|error| format!("无法获取本地数据目录: {error}"))?;

  if !base_dir.exists() {
    fs::create_dir_all(&base_dir).map_err(|error| format!("无法创建本地数据目录: {error}"))?;
  }

  Ok(base_dir.join("chat-history.json"))
}

fn bundled_command_path(prefix: &Path) -> PathBuf {
  if cfg!(target_os = "windows") {
    prefix.join("bin").join("openclaw.cmd")
  } else {
    prefix.join("bin").join("openclaw")
  }
}

fn bundled_skills_dir(prefix: &Path) -> PathBuf {
  prefix.join("skills")
}

fn runtime_config_path(prefix: &Path) -> PathBuf {
  prefix.join("config").join("openclaw.json")
}

fn read_runtime_config_value(path: &Path) -> Result<Value, String> {
  if path.exists() {
    let content = fs::read_to_string(path).map_err(|error| format!("无法读取配置文件 {}: {error}", path.display()))?;
    Ok(serde_json::from_str::<Value>(&content).unwrap_or_else(|_| Value::Object(Map::new())))
  } else {
    Ok(Value::Object(Map::new()))
  }
}

fn write_runtime_config_value(path: &Path, root: &Value) -> Result<(), String> {
  let body = serde_json::to_string_pretty(root).map_err(|error| format!("无法序列化 OpenClaw 配置: {error}"))?;
  fs::write(path, body).map_err(|error| format!("无法更新 OpenClaw 配置 {}: {error}", path.display()))
}

fn ensure_runtime_config_object(path: &Path) -> Result<Value, String> {
  let mut root = read_runtime_config_value(path)?;
  if !root.is_object() {
    root = Value::Object(Map::new());
  }
  Ok(root)
}

fn read_chat_history(app: &AppHandle) -> Result<Option<ChatHistoryState>, String> {
  let path = chat_history_path(app)?;
  if !path.exists() {
    return Ok(None);
  }

  let content = fs::read_to_string(&path).map_err(|error| format!("无法读取聊天记录 {}: {error}", path.display()))?;
  if content.trim().is_empty() {
    return Ok(None);
  }

  let history = serde_json::from_str::<ChatHistoryState>(&content)
    .map_err(|error| format!("无法解析聊天记录 {}: {error}", path.display()))?;

  Ok(Some(history))
}

fn write_chat_history(app: &AppHandle, payload: &ChatHistoryState) -> Result<bool, String> {
  let path = chat_history_path(app)?;
  let body = serde_json::to_string_pretty(payload).map_err(|error| format!("无法序列化聊天记录: {error}"))?;

  fs::write(&path, body).map_err(|error| format!("无法写入聊天记录 {}: {error}", path.display()))?;
  Ok(true)
}

fn set_active_chat_pid(state: &ActiveChatProcessState, pid: Option<u32>) -> Result<(), String> {
  let mut guard = state.pid.lock().map_err(|_| "无法锁定当前聊天进程状态".to_string())?;
  *guard = pid;
  Ok(())
}

fn set_active_chat_stream(
  state: &ActiveChatProcessState,
  stream: Option<OpenClawChatStreamEvent>,
) -> Result<(), String> {
  let mut guard = state.stream.lock().map_err(|_| "无法锁定当前聊天流状态".to_string())?;
  *guard = stream;
  Ok(())
}

fn set_active_chat_stop_requested(
  state: &ActiveChatProcessState,
  requested: bool,
) -> Result<(), String> {
  let mut guard = state
    .stop_requested
    .lock()
    .map_err(|_| "无法锁定当前聊天停止状态".to_string())?;
  *guard = requested;
  Ok(())
}

fn get_active_chat_stop_requested(state: &ActiveChatProcessState) -> Result<bool, String> {
  let guard = state
    .stop_requested
    .lock()
    .map_err(|_| "无法锁定当前聊天停止状态".to_string())?;
  Ok(*guard)
}

fn clear_active_chat_pid(state: &ActiveChatProcessState, pid: u32) -> Result<(), String> {
  let mut guard = state.pid.lock().map_err(|_| "无法锁定当前聊天进程状态".to_string())?;

  if *guard == Some(pid) {
    *guard = None;
  }

  Ok(())
}

fn emit_chat_stream_event(
  app: &AppHandle,
  state: &ActiveChatProcessState,
  event: OpenClawChatStreamEvent,
) -> Result<(), String> {
  set_active_chat_stream(state, Some(event.clone()))?;
  app
    .emit("openclaw://chat-stream", event)
    .map_err(|error| format!("发送 OpenClaw 流式事件失败: {error}"))
}

fn terminate_process(pid: u32) -> Result<bool, String> {
  #[cfg(target_os = "windows")]
  let output = Command::new("taskkill")
    .arg("/PID")
    .arg(pid.to_string())
    .arg("/T")
    .arg("/F")
    .output()
    .map_err(|error| format!("无法停止 OpenClaw 生成进程: {error}"))?;

  #[cfg(not(target_os = "windows"))]
  let output = Command::new("kill")
    .arg("-TERM")
    .arg(pid.to_string())
    .output()
    .map_err(|error| format!("无法停止 OpenClaw 生成进程: {error}"))?;

  if output.status.success() {
    return Ok(true);
  }

  let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
  let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();

  if stderr.contains("No such process") || stdout.contains("not found") {
    return Ok(false);
  }

  Err(if !stderr.is_empty() {
    stderr
  } else if !stdout.is_empty() {
    stdout
  } else {
    "停止 OpenClaw 生成失败".to_string()
  })
}


fn default_openclaw_config_path() -> Result<PathBuf, String> {
  let home = env::var("HOME")
    .or_else(|_| env::var("USERPROFILE"))
    .map_err(|_| "无法定位 OpenClaw 配置目录".to_string())?;
  Ok(PathBuf::from(home).join(".openclaw").join("openclaw.json"))
}

fn gateway_config_path_for_runtime(_app: &AppHandle, config: &OpenClawConfig) -> Result<PathBuf, String> {
  if let Ok(prefix) = bundled_prefix_from_command(&config.command) {
    ensure_bundled_layout(&prefix)?;
    return Ok(runtime_config_path(&prefix));
  }

  default_openclaw_config_path()
}

fn ensure_gateway_responses_endpoint_enabled(app: &AppHandle, config: &OpenClawConfig) -> Result<(), String> {
  let path = gateway_config_path_for_runtime(app, config)?;
  let mut root = ensure_runtime_config_object(&path)?;
  let root_obj = root.as_object_mut().ok_or_else(|| "网关配置对象无效".to_string())?;
  let mut changed = false;

  let gateway_value = root_obj.entry("gateway".to_string()).or_insert_with(|| json!({}));
  if !gateway_value.is_object() {
    *gateway_value = json!({});
    changed = true;
  }
  let gateway_obj = gateway_value
    .as_object_mut()
    .ok_or_else(|| "gateway 配置无效".to_string())?;

  let http_value = gateway_obj.entry("http".to_string()).or_insert_with(|| json!({}));
  if !http_value.is_object() {
    *http_value = json!({});
    changed = true;
  }
  let http_obj = http_value
    .as_object_mut()
    .ok_or_else(|| "gateway.http 配置无效".to_string())?;

  let endpoints_value = http_obj.entry("endpoints".to_string()).or_insert_with(|| json!({}));
  if !endpoints_value.is_object() {
    *endpoints_value = json!({});
    changed = true;
  }
  let endpoints_obj = endpoints_value
    .as_object_mut()
    .ok_or_else(|| "gateway.http.endpoints 配置无效".to_string())?;

  let responses_value = endpoints_obj
    .entry("responses".to_string())
    .or_insert_with(|| json!({}));
  if !responses_value.is_object() {
    *responses_value = json!({});
    changed = true;
  }
  let responses_obj = responses_value
    .as_object_mut()
    .ok_or_else(|| "gateway.http.endpoints.responses 配置无效".to_string())?;
  let already_enabled = responses_obj
    .get("enabled")
    .and_then(Value::as_bool)
    .unwrap_or(false);
  if !already_enabled {
    responses_obj.insert("enabled".to_string(), Value::Bool(true));
    changed = true;
  }

  if changed {
    write_runtime_config_value(&path, &root)?;
  }

  Ok(())
}

fn read_gateway_bearer_token(app: &AppHandle, config: &OpenClawConfig) -> Result<Option<String>, String> {
  let path = gateway_config_path_for_runtime(app, config)?;
  let root = ensure_runtime_config_object(&path)?;
  let auth = root
    .get("gateway")
    .and_then(|value| value.get("auth"))
    .and_then(Value::as_object);

  let Some(auth) = auth else {
    return Ok(None);
  };

  let mode = auth
    .get("mode")
    .and_then(Value::as_str)
    .map(str::trim)
    .unwrap_or("none");

  if mode == "none" {
    return Ok(None);
  }

  if mode == "token" {
    return Ok(auth
      .get("token")
      .and_then(Value::as_str)
      .map(str::trim)
      .filter(|value| !value.is_empty())
      .map(ToString::to_string));
  }

  if mode == "password" {
    return Ok(auth
      .get("password")
      .and_then(Value::as_str)
      .map(str::trim)
      .filter(|value| !value.is_empty())
      .map(ToString::to_string));
  }

  Ok(None)
}

fn build_openresponses_endpoint(base_url: &str) -> String {
  format!("{}/v1/responses", base_url.trim_end_matches('/'))
}

fn extract_openresponses_text_from_item(item: &Value, parts: &mut Vec<String>) {
  let item_type = item
    .get("type")
    .and_then(Value::as_str)
    .map(str::trim)
    .unwrap_or_default();

  if item_type == "message" {
    if let Some(content_items) = item.get("content").and_then(Value::as_array) {
      for content_item in content_items {
        let content_type = content_item
          .get("type")
          .and_then(Value::as_str)
          .map(str::trim)
          .unwrap_or_default();

        if (content_type == "output_text" || content_type == "text" || content_type == "input_text")
          && content_item.get("text").and_then(Value::as_str).is_some()
        {
          if let Some(text) = content_item.get("text").and_then(Value::as_str) {
            let trimmed = text.trim();
            if !trimmed.is_empty() {
              parts.push(trimmed.to_string());
            }
          }
        }
      }
    }
    return;
  }

  if item_type == "output_text" || item_type == "text" {
    if let Some(text) = item.get("text").and_then(Value::as_str) {
      let trimmed = text.trim();
      if !trimmed.is_empty() {
        parts.push(trimmed.to_string());
      }
    }
  }
}

fn extract_openresponses_reply(response: &Value) -> String {
  if let Some(output_text) = response.get("output_text").and_then(Value::as_str) {
    let trimmed = output_text.trim();
    if !trimmed.is_empty() {
      return trimmed.to_string();
    }
  }

  let mut parts = Vec::new();

  if let Some(items) = response.get("output").and_then(Value::as_array) {
    for item in items {
      extract_openresponses_text_from_item(item, &mut parts);
    }
  }

  parts.join("\n\n").trim().to_string()
}

fn build_openresponses_stream_snapshot(reply: &str, output_items: &[Value]) -> Value {
  let mut output = Vec::new();

  let trimmed_reply = reply.trim();
  if !trimmed_reply.is_empty() {
    output.push(json!({
      "type": "message",
      "content": [
        {
          "type": "output_text",
          "text": trimmed_reply,
        }
      ]
    }));
  }

  output.extend(output_items.iter().cloned());

  json!({
    "output": output,
  })
}

fn resolve_openresponses_stream_event_type(
  payload: &Value,
  event_type_hint: Option<&str>,
) -> String {
  payload
    .get("type")
    .and_then(Value::as_str)
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .map(ToString::to_string)
    .or_else(|| {
      event_type_hint
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
    })
    .unwrap_or_default()
}

fn upsert_openresponses_output_item(output_items: &mut Vec<Value>, next_item: &Value) {
  let next_type = next_item.get("type").and_then(Value::as_str).unwrap_or_default();
  let next_id = next_item
    .get("id")
    .and_then(Value::as_str)
    .or_else(|| next_item.get("call_id").and_then(Value::as_str))
    .unwrap_or_default();

  if !next_id.is_empty() {
    if let Some(existing) = output_items.iter_mut().find(|item| {
      item
        .get("id")
        .and_then(Value::as_str)
        .or_else(|| item.get("call_id").and_then(Value::as_str))
        == Some(next_id)
    }) {
      *existing = next_item.clone();
      return;
    }
  }

  if !next_type.is_empty() {
    if let Some(existing) = output_items.iter_mut().rev().find(|item| {
      item.get("type").and_then(Value::as_str) == Some(next_type)
        && item
          .get("id")
          .and_then(Value::as_str)
          .or_else(|| item.get("call_id").and_then(Value::as_str))
          .unwrap_or_default()
          .is_empty()
    }) {
      *existing = next_item.clone();
      return;
    }
  }

  output_items.push(next_item.clone());
}

fn append_openresponses_function_call_arguments(output_items: &mut [Value], delta: &str) {
  let Some(current_item) = output_items
    .iter_mut()
    .rev()
    .find(|item| item.get("type").and_then(Value::as_str) == Some("function_call"))
  else {
    return;
  };

  let current_arguments = current_item
    .get("arguments")
    .and_then(Value::as_str)
    .unwrap_or_default()
    .to_string();
  let next_arguments = format!("{current_arguments}{delta}");

  if let Some(object) = current_item.as_object_mut() {
    object.insert("arguments".to_string(), Value::String(next_arguments));
  }
}

fn parse_sse_event_block(block: &str) -> Option<(Option<String>, String)> {
  let mut event_type: Option<String> = None;
  let mut data_lines = Vec::new();

  for line in block.lines() {
    if let Some(value) = line.strip_prefix("event:") {
      let normalized = value.trim();
      if !normalized.is_empty() {
        event_type = Some(normalized.to_string());
      }
      continue;
    }

    if let Some(value) = line.strip_prefix("data:") {
      data_lines.push(value.trim_start().to_string());
    }
  }

  if data_lines.is_empty() {
    return None;
  }

  Some((event_type, data_lines.join("\n")))
}

#[cfg(target_os = "windows")]
fn build_openclaw_command(command_path: &str) -> Command {
  let mut command = Command::new("cmd");
  command.arg("/C").arg(command_path);
  command
}

#[cfg(not(target_os = "windows"))]
fn build_openclaw_command(command_path: &str) -> Command {
  Command::new(command_path)
}


fn read_config(app: &AppHandle) -> Result<OpenClawConfig, String> {
  let path = config_path(app)?;
  if !path.exists() {
    return Ok(OpenClawConfig::default());
  }

  let content = fs::read_to_string(&path).map_err(|error| format!("无法读取配置: {error}"))?;
  let mut config: OpenClawConfig =
    serde_json::from_str(&content).map_err(|error| format!("配置文件格式错误: {error}"))?;

  if is_bundled_command(app, &config.command) && migrate_bundled_gateway_config(&mut config) {
    let body = serde_json::to_string_pretty(&config).map_err(|error| format!("无法序列化迁移后的配置: {error}"))?;
    fs::write(&path, body).map_err(|error| format!("无法更新配置: {error}"))?;
  }

  Ok(config)
}

fn write_config(app: &AppHandle, payload: SaveConfigPayload) -> Result<OpenClawConfig, String> {
  let config = OpenClawConfig {
    enabled: payload.enabled,
    display_name: payload.display_name.trim().to_string(),
    base_url: payload.base_url.trim().to_string(),
    health_path: normalize_health_path(&payload.health_path),
    model: payload.model.trim().to_string(),
    command: payload.command.trim().to_string(),
    args: payload
      .args
      .into_iter()
      .map(|item| item.trim().to_string())
      .filter(|item| !item.is_empty())
      .collect(),
    working_directory: payload.working_directory.trim().to_string(),
  };

  let path = config_path(app)?;
  let body = serde_json::to_string_pretty(&config).map_err(|error| format!("无法序列化配置: {error}"))?;
  fs::write(path, body).map_err(|error| format!("无法写入配置: {error}"))?;
  sync_openclaw_skills_extra_dir(app)?;
  Ok(config)
}

fn normalize_health_path(value: &str) -> String {
  let trimmed = value.trim();
  if trimmed.is_empty() {
    DEFAULT_OPENCLAW_HEALTH_PATH.to_string()
  } else if trimmed.starts_with('/') {
    trimmed.to_string()
  } else {
    format!("/{trimmed}")
  }
}

fn executable_exists(command: &str) -> bool {
  if command.trim().is_empty() {
    return false;
  }

  let path = Path::new(command);
  if path.is_absolute() || command.contains('/') {
    return path.exists();
  }

  let checker = if cfg!(target_os = "windows") {
    ("where", vec![command])
  } else {
    ("which", vec![command])
  };

  Command::new(checker.0)
    .args(checker.1)
    .output()
    .map(|output| output.status.success())
    .unwrap_or(false)
}

fn build_endpoint(base_url: &str, health_path: &str) -> String {
  let base = base_url.trim_end_matches('/');
  format!("{base}{health_path}")
}

async fn probe_status(app: &AppHandle, config: &OpenClawConfig) -> OpenClawStatus {
  let executable_found = executable_exists(&config.command);
  let bundled = is_bundled_command(app, &config.command);
  let normalized_health_path = normalize_health_path(&config.health_path);
  let configured_endpoint = build_endpoint(&config.base_url, &normalized_health_path);
  let fallback_endpoint = if normalized_health_path != DEFAULT_OPENCLAW_HEALTH_PATH {
    Some(build_endpoint(&config.base_url, DEFAULT_OPENCLAW_HEALTH_PATH))
  } else {
    None
  };

  let bearer_token = read_gateway_bearer_token(app, config).ok().flatten();

  let probe_endpoint = |endpoint: String, bearer_token: Option<String>| async move {
    let client = reqwest::Client::new();
    let mut last_error = None;

    for attempt in 0..OPENCLAW_HEALTH_PROBE_ATTEMPTS {
      let mut request = client
        .get(&endpoint)
        .timeout(Duration::from_secs(OPENCLAW_HEALTH_PROBE_TIMEOUT_SECS));
      if let Some(token) = bearer_token.as_deref() {
        request = request.bearer_auth(token);
      }
      let response = request.send().await;

      match response {
        Ok(response) => {
          let status = response.status();
          let ok = status.is_success() || status == StatusCode::NOT_FOUND;
          let message = if ok {
            format!("OpenClaw runtime 已响应 {}", status.as_u16())
          } else if status == StatusCode::UNAUTHORIZED || status == StatusCode::FORBIDDEN {
            format!("OpenClaw runtime 已响应，但当前健康检查认证失败（HTTP {}）", status.as_u16())
          } else {
            format!("OpenClaw runtime 返回状态 {}", status.as_u16())
          };
          return (ok, Some(status.as_u16()), message);
        },
        Err(error) => {
          last_error = Some(error.to_string());
          if attempt + 1 < OPENCLAW_HEALTH_PROBE_ATTEMPTS {
            thread::sleep(Duration::from_millis(250));
          }
        },
      }
    }

    let detail = last_error.unwrap_or_else(|| "未知错误".to_string());
    (false, None, format!("无法连接到 OpenClaw runtime: {detail}"))
  };

  let (mut reachable, mut http_status, mut message) =
    probe_endpoint(configured_endpoint.clone(), bearer_token.clone()).await;
  let mut endpoint = configured_endpoint.clone();

  if !reachable {
    if let Some(fallback_endpoint) = fallback_endpoint {
      let (fallback_reachable, fallback_http_status, fallback_message) =
        probe_endpoint(fallback_endpoint.clone(), bearer_token).await;
      if fallback_reachable {
        reachable = true;
        http_status = fallback_http_status;
        endpoint = fallback_endpoint;
        message = format!(
          "当前健康检查路径 {} 未通过，但 {} 可达；建议将健康检查路径更新为 {}。{}",
          normalized_health_path, DEFAULT_OPENCLAW_HEALTH_PATH, DEFAULT_OPENCLAW_HEALTH_PATH, fallback_message
        );
      }
    }
  }

  if !reachable {
    if let Some(discovered_base_url) = read_gateway_status_base_url(config) {
      if normalize_base_url(&discovered_base_url) != normalize_base_url(&config.base_url) {
        message = format!(
          "{}；另外检测到另一个 gateway 地址为 {}，但当前配置要求使用 {}",
          message,
          normalize_base_url(&discovered_base_url),
          normalize_base_url(&config.base_url),
        );
      }
    }
  }

  OpenClawStatus {
    configured: !config.base_url.is_empty() && !config.command.is_empty(),
    bundled,
    executable_found,
    reachable,
    launchable: executable_found,
    endpoint,
    command_path: config.command.clone(),
    message,
    http_status,
  }
}

fn is_bundled_command(app: &AppHandle, command: &str) -> bool {
  bundled_prefix(app)
    .ok()
    .map(|prefix| command.starts_with(prefix.to_string_lossy().as_ref()))
    .unwrap_or(false)
}

fn is_legacy_bundled_gateway_base_url(base_url: &str) -> bool {
  let normalized = base_url.trim().trim_end_matches('/');
  normalized == format!("http://127.0.0.1:{LEGACY_BUNDLED_GATEWAY_PORT}")
    || normalized == format!("http://127.0.0.1:{OLDER_BUNDLED_GATEWAY_PORT}")
}

fn should_migrate_bundled_health_path(health_path: &str) -> bool {
  let normalized = health_path.trim();
  normalized.is_empty() || normalized == "/"
}

fn migrate_bundled_gateway_config(config: &mut OpenClawConfig) -> bool {
  let uses_legacy_base_url = is_legacy_bundled_gateway_base_url(&config.base_url);
  let uses_legacy_port_arg = has_gateway_port_arg(&config.args, LEGACY_BUNDLED_GATEWAY_PORT)
    || has_gateway_port_arg(&config.args, OLDER_BUNDLED_GATEWAY_PORT);
  let should_upgrade_health_path = should_migrate_bundled_health_path(&config.health_path);
  let normalized_args = remove_gateway_auth_override(&config.args);
  let mut changed = false;

  if uses_legacy_base_url || uses_legacy_port_arg {
    config.base_url = bundled_gateway_base_url();
    config.args = replace_gateway_port_arg(&normalized_args, BUNDLED_GATEWAY_PORT);
    changed = true;
  } else if normalized_args != config.args {
    config.args = normalized_args;
    changed = true;
  }

  if should_upgrade_health_path {
    config.health_path = DEFAULT_OPENCLAW_HEALTH_PATH.to_string();
    changed = true;
  }

  changed
}

fn apply_openclaw_env(command: &mut Command, config: &OpenClawConfig) {
  if let Ok(prefix) = bundled_prefix_from_command(&config.command) {
    let state_dir = prefix.join("state");
    let config_dir = prefix.join("config");
    let config_path = runtime_config_path(&prefix);
    let _ = fs::create_dir_all(&state_dir);
    let _ = fs::create_dir_all(&config_dir);
    command.env("OPENCLAW_HOME", &prefix);
    command.env("OPENCLAW_STATE_DIR", &state_dir);
    command.env("OPENCLAW_CONFIG_PATH", &config_path);
    command.env("OPENCLAW_SKIP_ACPX_RUNTIME", "1");
    if let Some(port) = extract_base_url_port(&config.base_url) {
      command.env("OPENCLAW_GATEWAY_PORT", port);
    }
    command.env("OPENCLAW_LAUNCHD_LABEL", "ai.openclaw.gateway.kadaclaw");
  }
}

fn bundled_prefix_from_command(command: &str) -> Result<PathBuf, String> {
  let path = PathBuf::from(command);
  let parent = path
    .parent()
    .and_then(|value| value.parent())
    .ok_or_else(|| "无法从命令路径推断 OpenClaw 前缀".to_string())?;
  Ok(parent.to_path_buf())
}

fn ensure_bundled_layout(prefix: &Path) -> Result<(), String> {
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

fn skills_dir_for_app(app: &AppHandle) -> Result<PathBuf, String> {
  let prefix = bundled_prefix(app)?;
  ensure_bundled_layout(&prefix)?;
  Ok(bundled_skills_dir(&prefix))
}

fn read_openclaw_skills_extra_dirs(app: &AppHandle) -> Result<Vec<String>, String> {
  let path = runtime_config_path(&bundled_prefix(app)?);
  let root = ensure_runtime_config_object(&path)?;
  let bundled_skills_dir = skills_dir_for_app(app)?.to_string_lossy().to_string();
  let configured_extra_dirs = root
    .get("skills")
    .and_then(|value| value.get("load"))
    .and_then(|value| value.get("extraDirs"))
    .and_then(Value::as_array)
    .map(|items| {
      items
        .iter()
        .filter_map(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty() && *value != bundled_skills_dir)
        .map(ToString::to_string)
        .collect::<Vec<_>>()
    })
    .unwrap_or_default();
  let discovered_extra_dirs = discover_local_skill_dirs(app);
  let extra_dirs = configured_extra_dirs
    .into_iter()
    .chain(discovered_extra_dirs)
    .collect::<Vec<_>>();

  Ok(normalize_local_skill_dirs(&extra_dirs))
}

fn normalize_local_skill_dirs(directories: &[String]) -> Vec<String> {
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

fn is_skill_directory(path: &Path) -> bool {
  path.join("skill.json").is_file() && path.join("SKILL.md").is_file()
}

fn find_workspace_skills_dir(start: &Path) -> Option<PathBuf> {
  let mut current = if start.is_dir() {
    start.to_path_buf()
  } else {
    start.parent()?.to_path_buf()
  };

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

fn discover_local_skill_dirs(app: &AppHandle) -> Vec<String> {
  let mut directories = Vec::new();

  if let Ok(current_dir) = env::current_dir() {
    if let Some(skills_dir) = find_workspace_skills_dir(&current_dir) {
      directories.push(skills_dir.to_string_lossy().to_string());
    }
  }

  if let Ok(config) = read_config(app) {
    let working_directory = config.working_directory.trim();
    if !working_directory.is_empty() {
      if let Some(skills_dir) = find_workspace_skills_dir(Path::new(working_directory)) {
        directories.push(skills_dir.to_string_lossy().to_string());
      }
    }
  }

  normalize_local_skill_dirs(&directories)
}

fn save_openclaw_local_skills_dirs_impl(app: &AppHandle, directories: Vec<String>) -> Result<Vec<String>, String> {
  let skills_dir = skills_dir_for_app(app)?;
  let normalized_directories = normalize_local_skill_dirs(&directories);

  for directory in &normalized_directories {
    fs::create_dir_all(directory).map_err(|error| format!("无法创建本地 skills 目录 {}: {error}", directory))?;
  }

  let path = runtime_config_path(&bundled_prefix(app)?);
  let mut root = ensure_runtime_config_object(&path)?;

  let root_obj = root.as_object_mut().ok_or_else(|| "配置文件对象无效".to_string())?;
  let skills_value = root_obj.entry("skills".to_string()).or_insert_with(|| json!({}));
  if !skills_value.is_object() {
    *skills_value = json!({});
  }

  let skills_obj = skills_value
    .as_object_mut()
    .ok_or_else(|| "skills 配置无效".to_string())?;
  let load_value = skills_obj.entry("load".to_string()).or_insert_with(|| json!({}));
  if !load_value.is_object() {
    *load_value = json!({});
  }

  let load_obj = load_value
    .as_object_mut()
    .ok_or_else(|| "skills.load 配置无效".to_string())?;
  let extra_dirs_value = load_obj
    .entry("extraDirs".to_string())
    .or_insert_with(|| Value::Array(Vec::new()));

  if !extra_dirs_value.is_array() {
    *extra_dirs_value = Value::Array(Vec::new());
  }

  let extra_dirs = extra_dirs_value
    .as_array_mut()
    .ok_or_else(|| "skills.load.extraDirs 配置无效".to_string())?;
  let skills_dir_string = skills_dir.to_string_lossy().to_string();
  *extra_dirs = std::iter::once(skills_dir_string)
    .chain(normalized_directories.iter().cloned())
    .map(Value::String)
    .collect();

  write_runtime_config_value(&path, &root)?;
  Ok(normalized_directories)
}

fn sync_openclaw_skills_extra_dir(app: &AppHandle) -> Result<(), String> {
  let directories = read_openclaw_skills_extra_dirs(app)?;
  save_openclaw_local_skills_dirs_impl(app, directories).map(|_| ())
}

#[cfg(target_os = "macos")]
fn pick_openclaw_local_skills_dir_native() -> Result<Option<String>, String> {
  let output = Command::new("osascript")
    .args([
      "-e",
      "set selectedFolder to choose folder with prompt \"选择本地 Skills 目录\"",
      "-e",
      "POSIX path of selectedFolder",
    ])
    .output()
    .map_err(|error| format!("无法打开目录选择器: {error}"))?;

  if output.status.success() {
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    return if stdout.is_empty() { Ok(None) } else { Ok(Some(stdout)) };
  }

  let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
  if stderr.contains("User canceled") || stderr.contains("(-128)") {
    Ok(None)
  } else {
    Err(format!("打开目录选择器失败: {stderr}"))
  }
}

#[cfg(target_os = "windows")]
fn pick_openclaw_local_skills_dir_native() -> Result<Option<String>, String> {
  let script = r#"
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = '选择本地 Skills 目录'
$dialog.ShowNewFolderButton = $true
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $dialog.SelectedPath
}
"#;

  let output = Command::new("powershell")
    .arg("-NoProfile")
    .arg("-STA")
    .arg("-Command")
    .arg(script)
    .output()
    .map_err(|error| format!("无法打开目录选择器: {error}"))?;

  if !output.status.success() {
    return Err(format!("打开目录选择器失败: {}", String::from_utf8_lossy(&output.stderr).trim()));
  }

  let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
  if stdout.is_empty() {
    Ok(None)
  } else {
    Ok(Some(stdout))
  }
}

#[cfg(all(unix, not(target_os = "macos")))]
fn pick_openclaw_local_skills_dir_native() -> Result<Option<String>, String> {
  let candidates = [
    ("zenity", vec!["--file-selection", "--directory", "--title=选择本地 Skills 目录"]),
    ("kdialog", vec!["--getexistingdirectory", ".", "--title", "选择本地 Skills 目录"]),
  ];

  for (command_name, args) in candidates {
    let output = match Command::new(command_name).args(&args).output() {
      Ok(output) => output,
      Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
      Err(error) => return Err(format!("无法打开目录选择器: {error}")),
    };

    if output.status.success() {
      let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
      return if stdout.is_empty() { Ok(None) } else { Ok(Some(stdout)) };
    }

    if output.status.code() == Some(1) {
      return Ok(None);
    }
  }

  Err("当前系统未检测到可用的目录选择器，请手动输入本地 Skills 路径。".to_string())
}

fn provider_env_name(provider: &str) -> Option<&'static str> {
  match provider {
    "anthropic" => Some("ANTHROPIC_API_KEY"),
    "openai" => Some("OPENAI_API_KEY"),
    "custom" => Some("OPENAI_API_KEY"),
    "openrouter" => Some("OPENROUTER_API_KEY"),
    "deepseek" => Some("DEEPSEEK_API_KEY"),
    "google" => Some("GEMINI_API_KEY"),
    _ => None,
  }
}

fn provider_from_model(model: &str) -> String {
  model
    .split('/')
    .next()
    .filter(|value| !value.trim().is_empty())
    .unwrap_or("anthropic")
    .to_string()
}

fn read_openclaw_auth_config(app: &AppHandle) -> Result<OpenClawAuthConfig, String> {
  let prefix = bundled_prefix(app)?;
  ensure_bundled_layout(&prefix)?;
  let path = runtime_config_path(&prefix);
  let root = ensure_runtime_config_object(&path)?;

  let model = root
    .get("agents")
    .and_then(|value| value.get("defaults"))
    .and_then(|value| value.get("model"))
    .and_then(|value| value.get("primary"))
    .and_then(Value::as_str)
    .unwrap_or("anthropic/claude-opus-4-6")
    .to_string();
  let api_base_url = root
    .get("env")
    .and_then(|value| value.get("OPENAI_BASE_URL"))
    .and_then(Value::as_str)
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .map(ToString::to_string);
  let provider = if api_base_url.is_some() {
    "custom".to_string()
  } else {
    provider_from_model(&model)
  };
  let api_key_env_name = provider_env_name(&provider).unwrap_or("ANTHROPIC_API_KEY").to_string();
  let api_key_configured = root
    .get("env")
    .and_then(|value| value.get(&api_key_env_name))
    .and_then(Value::as_str)
    .map(|value| !value.trim().is_empty())
    .unwrap_or(false);

  Ok(OpenClawAuthConfig {
    provider,
    model,
    api_key_env_name,
    api_key_configured,
    api_base_url,
  })
}

fn save_openclaw_auth_config_impl(
  app: &AppHandle,
  payload: SaveOpenClawAuthPayload,
) -> Result<OpenClawAuthConfig, String> {
  let prefix = bundled_prefix(app)?;
  ensure_bundled_layout(&prefix)?;
  let path = runtime_config_path(&prefix);
  let mut root = ensure_runtime_config_object(&path)?;

  let provider = payload.provider.trim().to_lowercase();
  let model = payload.model.trim().to_string();
  if model.is_empty() {
    return Err("模型不能为空".to_string());
  }

  let api_key_env_name = provider_env_name(&provider)
    .ok_or_else(|| "暂不支持该 Provider".to_string())?
    .to_string();

  let root_obj = root.as_object_mut().ok_or_else(|| "配置文件对象无效".to_string())?;

  let env_value = root_obj.entry("env".to_string()).or_insert_with(|| json!({}));
  if !env_value.is_object() {
    *env_value = json!({});
  }
  let env_obj = env_value.as_object_mut().ok_or_else(|| "env 配置无效".to_string())?;

  let api_key = payload.api_key.trim().to_string();
  if !api_key.is_empty() {
    env_obj.insert(api_key_env_name.clone(), Value::String(api_key));
  }
  let api_base_url = payload
    .api_base_url
    .as_deref()
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .map(ToString::to_string);
  if provider == "custom" {
    let base_url = api_base_url.ok_or_else(|| "Custom Provider 的 API Base URL 不能为空".to_string())?;
    env_obj.insert("OPENAI_BASE_URL".to_string(), Value::String(base_url));
  } else {
    env_obj.remove("OPENAI_BASE_URL");
  }

  let agents_value = root_obj.entry("agents".to_string()).or_insert_with(|| json!({}));
  if !agents_value.is_object() {
    *agents_value = json!({});
  }
  let agents_obj = agents_value
    .as_object_mut()
    .ok_or_else(|| "agents 配置无效".to_string())?;
  let defaults_value = agents_obj.entry("defaults".to_string()).or_insert_with(|| json!({}));
  if !defaults_value.is_object() {
    *defaults_value = json!({});
  }
  let defaults_obj = defaults_value
    .as_object_mut()
    .ok_or_else(|| "agents.defaults 配置无效".to_string())?;
  let model_value = defaults_obj.entry("model".to_string()).or_insert_with(|| json!({}));
  if !model_value.is_object() {
    *model_value = json!({});
  }
  let model_obj = model_value
    .as_object_mut()
    .ok_or_else(|| "agents.defaults.model 配置无效".to_string())?;
  model_obj.insert("primary".to_string(), Value::String(model.clone()));
  root_obj.remove("kadaclaw");

  write_runtime_config_value(&path, &root)?;

  let app_config = read_config(app)?;
  let _ = write_config(
    app,
    SaveConfigPayload {
      enabled: app_config.enabled,
      display_name: app_config.display_name,
      base_url: app_config.base_url,
      health_path: app_config.health_path,
      model: model.clone(),
      command: app_config.command,
      args: app_config.args,
      working_directory: app_config.working_directory,
    },
  )?;

  read_openclaw_auth_config(app)
}

fn skill_dir_name(skill_id: &str) -> String {
  skill_id
    .chars()
    .map(|ch| if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' { ch } else { '-' })
    .collect()
}

fn skill_manifest_path(app: &AppHandle, skill_id: &str) -> Result<PathBuf, String> {
  let skills_dir = skills_dir_for_app(app)?;
  Ok(skills_dir.join(skill_dir_name(skill_id)).join("skill.json"))
}

fn read_skill_manifest(manifest_path: &Path) -> Result<SkillManifest, String> {
  let content = fs::read_to_string(manifest_path)
    .map_err(|error| format!("无法读取技能清单 {}: {error}", manifest_path.display()))?;
  serde_json::from_str::<SkillManifest>(&content)
    .map_err(|error| format!("技能清单格式错误 {}: {error}", manifest_path.display()))
}

fn read_skill_manifest_from_dir(skill_dir: &Path) -> Result<SkillManifest, String> {
  if !skill_dir.is_dir() {
    return Err(format!("技能目录不存在: {}", skill_dir.display()));
  }

  if !skill_dir.join("SKILL.md").is_file() {
    return Err(format!("技能目录缺少 SKILL.md: {}", skill_dir.display()));
  }

  read_skill_manifest(&skill_dir.join("skill.json"))
}

fn build_installed_skill_record(
  skill_dir: &Path,
  manifest: &SkillManifest,
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
    manifest_path: skill_dir.join("skill.json").to_string_lossy().to_string(),
    directory: skill_dir.to_string_lossy().to_string(),
    source_label: source_label.to_string(),
    source_type: source_type.to_string(),
    removable,
  }
}

fn copy_directory_recursive(source_dir: &Path, target_dir: &Path) -> Result<(), String> {
  fs::create_dir_all(target_dir).map_err(|error| format!("无法创建目录 {}: {error}", target_dir.display()))?;

  let entries = fs::read_dir(source_dir)
    .map_err(|error| format!("无法读取目录 {}: {error}", source_dir.display()))?;

  for entry in entries {
    let entry = entry.map_err(|error| format!("读取目录条目失败: {error}"))?;
    let source_path = entry.path();
    let target_path = target_dir.join(entry.file_name());

    if source_path.is_dir() {
      copy_directory_recursive(&source_path, &target_path)?;
    } else {
      ensure_parent_dir(&target_path)?;
      fs::copy(&source_path, &target_path).map_err(|error| {
        format!(
          "无法复制文件 {} -> {}: {error}",
          source_path.display(),
          target_path.display()
        )
      })?;
    }
  }

  Ok(())
}

fn create_temp_subdir(prefix: &str) -> Result<PathBuf, String> {
  let stamp = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|duration| duration.as_millis())
    .unwrap_or(0);
  let directory = env::temp_dir().join(format!("kadaclaw-{prefix}-{stamp}"));
  fs::create_dir_all(&directory).map_err(|error| format!("无法创建临时目录 {}: {error}", directory.display()))?;
  Ok(directory)
}

fn extract_zip_bytes_to_dir(bytes: &[u8], target_dir: &Path) -> Result<(), String> {
  let mut archive = zip::ZipArchive::new(Cursor::new(bytes))
    .map_err(|error| format!("无法解析技能压缩包: {error}"))?;

  for index in 0..archive.len() {
    let mut entry = archive
      .by_index(index)
      .map_err(|error| format!("无法读取压缩包条目: {error}"))?;
    let Some(relative_path) = entry.enclosed_name().map(|value| value.to_path_buf()) else {
      continue;
    };
    let output_path = target_dir.join(relative_path);

    if entry.is_dir() {
      fs::create_dir_all(&output_path)
        .map_err(|error| format!("无法创建解压目录 {}: {error}", output_path.display()))?;
      continue;
    }

    ensure_parent_dir(&output_path)?;
    let mut output_file = fs::File::create(&output_path)
      .map_err(|error| format!("无法写入解压文件 {}: {error}", output_path.display()))?;
    std::io::copy(&mut entry, &mut output_file)
      .map_err(|error| format!("无法解压文件 {}: {error}", output_path.display()))?;
  }

  Ok(())
}

fn find_first_skill_directory(root: &Path) -> Option<PathBuf> {
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

fn install_managed_skill_from_directory(app: &AppHandle, source_dir: &Path) -> Result<InstalledSkillRecord, String> {
  sync_openclaw_skills_extra_dir(app)?;
  let manifest = read_skill_manifest_from_dir(source_dir)?;
  let target_dir = skills_dir_for_app(app)?.join(skill_dir_name(&manifest.id));

  let source_canonical = fs::canonicalize(source_dir)
    .map_err(|error| format!("无法解析技能目录 {}: {error}", source_dir.display()))?;
  let target_canonical = fs::canonicalize(&target_dir).ok();
  if target_canonical.as_ref() == Some(&source_canonical) {
    return Ok(build_installed_skill_record(
      &target_dir,
      &manifest,
      "应用托管",
      "bundled",
      true,
    ));
  }

  if target_dir.exists() {
    fs::remove_dir_all(&target_dir)
      .map_err(|error| format!("无法覆盖已安装技能目录 {}: {error}", target_dir.display()))?;
  }

  copy_directory_recursive(source_dir, &target_dir)?;
  let installed_manifest = read_skill_manifest_from_dir(&target_dir)?;

  Ok(build_installed_skill_record(
    &target_dir,
    &installed_manifest,
    "应用托管",
    "bundled",
    true,
  ))
}

async fn install_skill_from_url_impl(app: &AppHandle, payload: InstallSkillFromUrlPayload) -> Result<InstalledSkillRecord, String> {
  let url = payload.url.trim().to_string();
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

fn ensure_parent_dir(path: &Path) -> Result<(), String> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent).map_err(|error| format!("无法创建目录 {}: {error}", parent.display()))?;
  }
  Ok(())
}

fn parse_marker_line(output: &str, marker: &str) -> Option<String> {
  output
    .lines()
    .find_map(|line| line.trim().strip_prefix(marker).map(|value| value.trim().to_string()))
}

fn normalize_base_url(value: &str) -> String {
  value.trim().trim_end_matches('/').to_string()
}

fn extract_base_url_authority(value: &str) -> Option<String> {
  let normalized = normalize_base_url(value);
  let host_part = normalized
    .strip_prefix("http://")
    .or_else(|| normalized.strip_prefix("https://"))
    .unwrap_or(&normalized);
  let authority = host_part.split('/').next().unwrap_or(host_part).trim();
  if authority.is_empty() {
    None
  } else {
    Some(authority.to_string())
  }
}

fn extract_base_url_port(value: &str) -> Option<String> {
  let normalized = normalize_base_url(value);
  let host_part = normalized
    .strip_prefix("http://")
    .or_else(|| normalized.strip_prefix("https://"))
    .unwrap_or(&normalized);
  host_part
    .rsplit_once(':')
    .map(|(_, port)| port.trim().to_string())
    .filter(|port| !port.is_empty() && port.chars().all(|char| char.is_ascii_digit()))
}

fn gateway_listener_detected(base_url: &str) -> bool {
  let Some(authority) = extract_base_url_authority(base_url) else {
    return false;
  };

  let Ok(addresses) = authority.to_socket_addrs() else {
    return false;
  };

  addresses.into_iter().any(|address| TcpStream::connect_timeout(&address, Duration::from_millis(400)).is_ok())
}

fn configured_gateway_detected(config: &OpenClawConfig) -> bool {
  if gateway_listener_detected(&config.base_url) {
    return true;
  }

  read_gateway_status_base_url(config)
    .map(|base_url| normalize_base_url(&base_url) == normalize_base_url(&config.base_url))
    .unwrap_or(false)
}

fn dashboard_url_to_base_url(value: &str) -> String {
  value
    .trim()
    .split('#')
    .next()
    .unwrap_or(value)
    .trim()
    .trim_end_matches('/')
    .to_string()
}

fn probe_target_to_base_url(value: &str) -> Option<String> {
  let trimmed = value.trim();
  if trimmed.is_empty() {
    return None;
  }

  if let Some(rest) = trimmed.strip_prefix("ws://") {
    return Some(format!("http://{rest}"));
  }

  if let Some(rest) = trimmed.strip_prefix("wss://") {
    return Some(format!("https://{rest}"));
  }

  if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
    return Some(dashboard_url_to_base_url(trimmed));
  }

  None
}

fn read_gateway_status_base_url(config: &OpenClawConfig) -> Option<String> {
  let mut command = build_openclaw_command(&config.command);
  command.args(["gateway", "status"]);
  if !config.working_directory.is_empty() {
    command.current_dir(&config.working_directory);
  }
  apply_openclaw_env(&mut command, config);

  let output = run_command_with_timeout(&mut command, Duration::from_secs(8), "OpenClaw gateway 状态命令").ok()?;
  let stdout = String::from_utf8_lossy(&output.stdout);
  let stderr = String::from_utf8_lossy(&output.stderr);
  let combined = format!("{stdout}\n{stderr}");

  parse_marker_line(&combined, "Dashboard URL:")
    .or_else(|| parse_marker_line(&combined, "Dashboard:"))
    .map(|value| dashboard_url_to_base_url(&value))
    .or_else(|| parse_marker_line(&combined, "Probe target:").and_then(|value| probe_target_to_base_url(&value)))
    .filter(|value| !value.is_empty())
}

fn write_windows_command_shim(wrapper_path: &Path, target_command: &str) -> Result<(), String> {
  ensure_parent_dir(wrapper_path)?;
  let escaped_target = target_command.replace('"', "\"\"");
  let body = format!("@echo off\r\nsetlocal\r\ncall \"{escaped_target}\" %*\r\n");
  fs::write(wrapper_path, body)
    .map_err(|error| format!("无法写入 Windows OpenClaw 启动包装器 {}: {error}", wrapper_path.display()))
}

fn validate_bundled_command(command_path: &Path) -> Result<(), String> {
  if !command_path.exists() {
    return Err(format!("OpenClaw 安装已完成，但命令文件不存在: {}", command_path.display()));
  }

  // On Windows, skip running --version: node may not yet be on PATH in the
  // Tauri process after a fresh Node.js install (PATH is only updated inside
  // the installer's PowerShell session). File existence is sufficient here;
  // runtime reachability is verified when the user actually launches it.
  if cfg!(target_os = "windows") {
    return Ok(());
  }

  let command = command_path.to_string_lossy().to_string();
  read_openclaw_version(&command).map(|_| ())
}

fn skills_dir_writable(skills_dir: &Path) -> Result<(), String> {
  let marker_path = skills_dir.join(".kadaclaw-write-test");
  fs::write(&marker_path, "ok").map_err(|error| format!("技能目录不可写: {error}"))?;
  fs::remove_file(&marker_path).map_err(|error| format!("技能目录写入成功，但清理测试文件失败: {error}"))?;
  Ok(())
}

fn classify_windows_install_failure(stderr: &str, stdout: &str) -> String {
  let combined = format!("{stderr}\n{stdout}");
  let normalized = combined.to_lowercase();
  let detail = combined.trim();

  if normalized.contains("failed to download")
    || normalized.contains("invoke-webrequest")
    || normalized.contains("could not resolve")
    || normalized.contains("name or service not known")
  {
    return "Windows 安装失败：无法下载 OpenClaw 官方安装脚本，请检查网络、代理或防火墙设置。".to_string();
  }

  if normalized.contains("powershell is not recognized") || normalized.contains("无法执行 windows openclaw 安装脚本")
  {
    return "Windows 安装失败：无法调用 PowerShell，请确认系统已启用 PowerShell 并允许当前应用执行它。".to_string();
  }

  if normalized.contains("npm")
    && (normalized.contains("not recognized")
      || normalized.contains("commandnotfoundexception")
      || normalized.contains("无法将"))
  {
    return "Windows 安装失败：OpenClaw 官方安装器依赖的 Node.js/npm 不可用。请先安装 Node.js/npm，或优先改用 WSL2。"
      .to_string();
  }

  if normalized.contains("未能定位 openclaw 命令") || normalized.contains("无法解析 openclaw 命令路径") {
    return "Windows 安装失败：官方脚本已执行，但 Kadaclaw 没有找到可用的 openclaw 命令。请检查 PATH、Node.js/npm 安装链路，或优先改用 WSL2。"
            .to_string();
  }

  if normalized.contains("executionpolicy") || normalized.contains("running scripts is disabled") {
    return "Windows 安装失败：PowerShell 执行策略阻止了安装脚本运行，请放宽当前用户的执行策略或改用 WSL2。"
      .to_string();
  }

  if detail.is_empty() {
    "Windows 安装失败：官方安装器没有返回可读错误，请优先尝试 WSL2。".to_string()
  } else {
    format!("Windows 安装失败：{detail}")
  }
}

fn list_installed_skill_records(app: &AppHandle) -> Result<Vec<InstalledSkillRecord>, String> {
  let bundled_skills_dir = skills_dir_for_app(app)?;
  let local_skills_dirs = read_openclaw_skills_extra_dirs(app)?;
  let mut records = Vec::new();
  let mut seen_ids = HashSet::new();
  let skill_sources = std::iter::once((bundled_skills_dir, "应用托管".to_string(), "bundled".to_string(), true)).chain(
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

      if !seen_ids.insert(manifest.id.clone()) {
        continue;
      }

      records.push(build_installed_skill_record(&path, &manifest, &source_label, &source_type, removable));
    }
  }

  records.sort_by(|a, b| a.id.cmp(&b.id));
  Ok(records)
}

fn run_command_with_timeout(command: &mut Command, timeout: Duration, description: &str) -> Result<Output, String> {
  command.stdout(Stdio::piped()).stderr(Stdio::piped());

  let mut child = command
    .spawn()
    .map_err(|error| format!("无法启动 {description}: {error}"))?;
  let started_at = Instant::now();

  loop {
    match child.try_wait() {
      Ok(Some(_)) => {
        return child
          .wait_with_output()
          .map_err(|error| format!("无法等待 {description} 结果: {error}"));
      },
      Ok(None) => {
        if started_at.elapsed() >= timeout {
          let _ = child.kill();
          let _ = child.wait();
          return Err(format!("{description} 超时（>{} 秒）", timeout.as_secs()));
        }
        thread::sleep(Duration::from_millis(100));
      },
      Err(error) => {
        let _ = child.kill();
        let _ = child.wait();
        return Err(format!("无法检查 {description} 状态: {error}"));
      },
    }
  }
}

fn read_openclaw_skill_registry(app: &AppHandle) -> Result<Vec<OpenClawSkillEntry>, String> {
  let config = read_config(app)?;
  let attempts = 3;

  for attempt in 0..attempts {
    let mut command = build_openclaw_command(&config.command);
    command.args(["skills", "list", "--json"]);
    if !config.working_directory.is_empty() {
      command.current_dir(&config.working_directory);
    }
    apply_openclaw_env(&mut command, &config);

    let output = run_command_with_timeout(&mut command, Duration::from_secs(20), "OpenClaw 技能列表命令")?;

    if !output.status.success() {
      return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if stdout.is_empty() && stderr.is_empty() {
      if attempt + 1 < attempts {
        thread::sleep(Duration::from_millis(800));
        continue;
      }
      return Err("无法解析 OpenClaw 技能列表: EOF while parsing a value at line 1 column 0".to_string());
    }

    for payload in [&stdout, &stderr] {
      if payload.is_empty() {
        continue;
      }

      if let Ok(response) = serde_json::from_str::<OpenClawSkillsListResponse>(payload) {
        return Ok(response.skills);
      }
    }

    return Err("无法解析 OpenClaw 技能列表: 命令返回了非 JSON 输出".to_string());
  }

  Err("无法解析 OpenClaw 技能列表: EOF while parsing a value at line 1 column 0".to_string())
}

fn spawn_runtime_process(config: &OpenClawConfig) -> Result<(), String> {
  let mut command = build_openclaw_command(&config.command);
  if !config.args.is_empty() {
    command.args(&config.args);
  }
  if !config.working_directory.is_empty() {
    command.current_dir(&config.working_directory);
  }
  apply_openclaw_env(&mut command, config);
  command
    .spawn()
    .map_err(|error| format!("无法启动 OpenClaw runtime: {error}"))?;
  Ok(())
}

async fn wait_for_runtime_ready(app: &AppHandle, config: &OpenClawConfig, timeout: Duration) -> OpenClawStatus {
  let started_at = Instant::now();

  loop {
    let status = probe_status(app, config).await;
    if status.reachable || started_at.elapsed() >= timeout {
      return status;
    }
    thread::sleep(Duration::from_millis(500));
  }
}

#[tauri::command]
fn get_openclaw_config(app: AppHandle) -> Result<OpenClawConfig, String> {
  read_config(&app)
}

#[tauri::command]
fn save_openclaw_config(app: AppHandle, payload: SaveConfigPayload) -> Result<OpenClawConfig, String> {
  write_config(&app, payload)
}

#[tauri::command]
async fn probe_openclaw_runtime(app: AppHandle) -> Result<OpenClawStatus, String> {
  let config = read_config(&app)?;
  Ok(probe_status(&app, &config).await)
}

#[tauri::command]
async fn launch_openclaw_runtime(app: AppHandle) -> Result<OpenClawStatus, String> {
  let config = read_config(&app)?;

  if config.command.trim().is_empty() {
    return Err("尚未配置 OpenClaw 启动命令".to_string());
  }

  let current = probe_status(&app, &config).await;
  if current.reachable {
    return Ok(OpenClawStatus {
      message: "OpenClaw runtime 已在运行，无需重复启动".to_string(),
      ..current
    });
  }

  let gateway_detected = configured_gateway_detected(&config);
  if !gateway_detected {
    spawn_runtime_process(&config)?;
  }

  let mut status = wait_for_runtime_ready(&app, &config, Duration::from_secs(OPENCLAW_RUNTIME_READY_TIMEOUT_SECS)).await;
  if !status.reachable && gateway_detected && executable_exists(&config.command) {
    spawn_runtime_process(&config)?;
    status = wait_for_runtime_ready(&app, &config, Duration::from_secs(OPENCLAW_RUNTIME_READY_TIMEOUT_SECS)).await;
  }
  status.message = if status.reachable {
    if gateway_detected {
      "检测到 OpenClaw runtime 正在启动，现已连接".to_string()
    } else {
      "OpenClaw runtime 已启动并连接".to_string()
    }
  } else if gateway_detected {
    "检测到 OpenClaw runtime 已占用当前端口，但等待就绪超时".to_string()
  } else {
    "已发起 OpenClaw runtime 启动命令，但等待就绪超时".to_string()
  };
  Ok(status)
}

fn resolve_openclaw_dashboard_url(app: &AppHandle) -> Result<DashboardUrlResult, String> {
  let config = read_config(&app)?;
  let mut command = build_openclaw_command(&config.command);
  command.arg("dashboard").arg("--no-open");
  if !config.working_directory.is_empty() {
    command.current_dir(&config.working_directory);
  }
  apply_openclaw_env(&mut command, &config);

  let output = command
    .output()
    .map_err(|error| format!("无法获取 OpenClaw dashboard 地址: {error}"))?;

  if !output.status.success() {
    return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
  }

  let stdout = String::from_utf8_lossy(&output.stdout);
  let line = stdout
    .lines()
    .find(|item| item.trim_start().starts_with("Dashboard URL:"))
    .ok_or_else(|| "OpenClaw 未返回 dashboard 地址".to_string())?;

  let url = line
    .split_once(':')
    .map(|(_, value)| value.trim().to_string())
    .ok_or_else(|| "无法解析 dashboard 地址".to_string())?;

  Ok(DashboardUrlResult { url })
}

#[tauri::command]
fn get_openclaw_dashboard_url(app: AppHandle) -> Result<DashboardUrlResult, String> {
  resolve_openclaw_dashboard_url(&app)
}

#[tauri::command]
fn open_openclaw_dashboard(app: AppHandle) -> Result<DashboardUrlResult, String> {
  let result = resolve_openclaw_dashboard_url(&app)?;
  open_external_url(&result.url)?;
  Ok(result)
}

#[tauri::command]
async fn ensure_openclaw_runtime(app: AppHandle) -> Result<OpenClawStatus, String> {
  let config = read_config(&app)?;
  if let Ok(prefix) = bundled_prefix_from_command(&config.command) {
    let _ = ensure_bundled_layout(&prefix);
  }
  let initial = probe_status(&app, &config).await;
  if initial.reachable {
    return Ok(initial);
  }

  if !executable_exists(&config.command) {
    return Ok(initial);
  }

  let gateway_detected = configured_gateway_detected(&config);
  if !gateway_detected {
    let app_clone = app.clone();
    let config_clone = config.clone();
    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
      spawn_runtime_process(&config_clone)?;
      let _ = app_clone;
      Ok(())
    })
    .await
    .map_err(|error| format!("自动启动任务失败: {error}"))??;
  }

  let mut status = wait_for_runtime_ready(&app, &config, Duration::from_secs(OPENCLAW_RUNTIME_READY_TIMEOUT_SECS)).await;
  if !status.reachable && gateway_detected {
    let config_clone = config.clone();
    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
      spawn_runtime_process(&config_clone)?;
      Ok(())
    })
    .await
    .map_err(|error| format!("补偿启动任务失败: {error}"))??;
    status = wait_for_runtime_ready(&app, &config, Duration::from_secs(OPENCLAW_RUNTIME_READY_TIMEOUT_SECS)).await;
  }
  if status.reachable {
    status.message = if gateway_detected {
      "检测到 OpenClaw runtime 正在启动，现已连接".to_string()
    } else {
      "OpenClaw runtime 已自动启动并连接".to_string()
    };
  } else {
    status.message = if gateway_detected {
      "检测到 OpenClaw runtime 已占用当前端口，但等待就绪超时".to_string()
    } else {
      "已尝试自动启动 OpenClaw runtime，但等待就绪超时".to_string()
    };
  }
  Ok(status)
}

#[tauri::command]
async fn send_openclaw_message(
  app: AppHandle,
  payload: SendOpenClawMessagePayload,
) -> Result<OpenClawChatResponse, String> {
  let config = read_config(&app)?;
  let message = payload.message.trim().to_string();
  if message.is_empty() {
    return Err("消息不能为空".to_string());
  }

  sync_openclaw_skills_extra_dir(&app)?;
  ensure_gateway_responses_endpoint_enabled(&app, &config)?;

  let mut status = probe_status(&app, &config).await;
  if !status.reachable && executable_exists(&config.command) {
    if !configured_gateway_detected(&config) {
      let config_clone = config.clone();
      tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        spawn_runtime_process(&config_clone)?;
        Ok(())
      })
      .await
      .map_err(|error| format!("自动启动聊天 runtime 失败: {error}"))??;
    }

    status = wait_for_runtime_ready(&app, &config, Duration::from_secs(OPENCLAW_RUNTIME_READY_TIMEOUT_SECS)).await;
    if !status.reachable && configured_gateway_detected(&config) {
      let config_clone = config.clone();
      tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        spawn_runtime_process(&config_clone)?;
        Ok(())
      })
      .await
      .map_err(|error| format!("补偿启动聊天 runtime 失败: {error}"))??;
      status = wait_for_runtime_ready(&app, &config, Duration::from_secs(OPENCLAW_RUNTIME_READY_TIMEOUT_SECS)).await;
    }
  }

  if !status.reachable {
    return Err(format!(
      "OpenClaw runtime 未就绪，无法请求 {}。当前健康检查地址: {}。启动命令: {}。状态: {}",
      build_openresponses_endpoint(&config.base_url),
      status.endpoint,
      config.command,
      status.message,
    ));
  }

  let session_id = payload
    .session_id
    .map(|value| value.trim().to_string())
    .filter(|value| !value.is_empty())
    .unwrap_or_else(|| "kadaclaw-main".to_string());
  let thinking = payload
    .thinking
    .map(|value| value.trim().to_string())
    .filter(|value| !value.is_empty());
  let active_chat_process = app.state::<ActiveChatProcessState>();
  set_active_chat_pid(active_chat_process.inner(), None)?;
  set_active_chat_stop_requested(active_chat_process.inner(), false)?;
  emit_chat_stream_event(
    &app,
    active_chat_process.inner(),
    OpenClawChatStreamEvent {
      session_id: session_id.clone(),
      status: "Waiting for gateway response".to_string(),
      reply: String::new(),
      raw_output: build_openresponses_stream_snapshot("", &[]),
    },
  )?;

  let mut request_body = json!({
    "model": "openclaw/default",
    "input": message.clone(),
    "user": session_id.clone(),
    "stream": true,
  });

  if let Some(thinking) = thinking {
    request_body["reasoning"] = json!({
      "effort": thinking,
    });
  }

  let endpoint = build_openresponses_endpoint(&config.base_url);
  let bearer_token = read_gateway_bearer_token(&app, &config)?;
  let mut request = reqwest::Client::new()
    .post(&endpoint)
    .timeout(Duration::from_secs(120))
    .json(&request_body)
    .header("content-type", "application/json")
    .header("x-openclaw-session-key", session_id.as_str())
    .header("x-openclaw-agent-id", "main");

  if let Some(token) = bearer_token {
    request = request.bearer_auth(token);
  }

  let mut response = request
    .send()
    .await
    .map_err(|error| {
      format!(
        "调用 OpenClaw gateway responses 失败: {error}。请求地址: {}。健康检查地址: {}",
        endpoint,
        status.endpoint,
      )
    })?;

  let response_status = response.status();

  if !response_status.is_success() {
    let response_body = response
      .text()
      .await
      .map_err(|error| format!("读取 OpenClaw gateway responses 结果失败: {error}"))?;
    set_active_chat_stream(active_chat_process.inner(), None)?;
    let detail = response_body.trim();
    return Err(if detail.is_empty() {
      format!("OpenClaw gateway responses 返回状态 {}", response_status.as_u16())
    } else {
      detail.to_string()
    });
  }

  let mut reply = String::new();
  let mut output_items: Vec<Value> = Vec::new();
  let mut response_json: Option<Value> = None;
  let mut buffer = String::new();

  loop {
    if get_active_chat_stop_requested(active_chat_process.inner())? {
      set_active_chat_stream(active_chat_process.inner(), None)?;
      set_active_chat_stop_requested(active_chat_process.inner(), false)?;
      return Ok(OpenClawChatResponse {
        session_id,
        reply: reply.clone(),
        raw_output: build_openresponses_stream_snapshot(&reply, &output_items),
      });
    }

    let Some(chunk) = response
      .chunk()
      .await
      .map_err(|error| format!("读取 OpenClaw gateway responses 流失败: {error}"))?
    else {
      break;
    };

    buffer.push_str(&String::from_utf8_lossy(&chunk).replace("\r\n", "\n"));

    while let Some(separator_index) = buffer.find("\n\n") {
      let block = buffer[..separator_index].to_string();
      buffer.drain(..separator_index + 2);

      let Some((event_type_hint, data)) = parse_sse_event_block(&block) else {
        continue;
      };

      if data.trim() == "[DONE]" {
        break;
      }

      let payload = serde_json::from_str::<Value>(&data)
        .map_err(|error| format!("OpenClaw gateway SSE 返回了无效 JSON: {error}"))?;
      let event_type = resolve_openresponses_stream_event_type(&payload, event_type_hint.as_deref());

      match event_type.as_str() {
        "response.output_text.delta" => {
          if let Some(delta) = payload.get("delta").and_then(Value::as_str) {
            reply.push_str(delta);
          }
        },
        "response.output_text.done" => {
          if let Some(text) = payload.get("text").and_then(Value::as_str) {
            reply = text.to_string();
          }
        },
        "response.output_item.added" | "response.output_item.done" => {
          if let Some(item) = payload.get("item") {
            upsert_openresponses_output_item(&mut output_items, item);
          }
        },
        "response.function_call_arguments.delta" => {
          if let Some(delta) = payload.get("delta").and_then(Value::as_str) {
            append_openresponses_function_call_arguments(&mut output_items, delta);
          }
        },
        "response.completed" => {
          if let Some(response_value) = payload.get("response") {
            response_json = Some(response_value.clone());
            reply = extract_openresponses_reply(response_value);
          }
        },
        "response.failed" => {
          let detail = payload
            .get("error")
            .and_then(|value| value.get("message"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToString::to_string)
            .or_else(|| {
              payload
                .get("error")
                .and_then(Value::as_object)
                .map(|error| serde_json::to_string(error).unwrap_or_else(|_| "OpenClaw gateway responses 流执行失败".to_string()))
            })
            .unwrap_or_else(|| {
              serde_json::to_string(&payload).unwrap_or_else(|_| "OpenClaw gateway responses 流执行失败".to_string())
            });
          set_active_chat_stream(active_chat_process.inner(), None)?;
          return Err(detail);
        },
        _ => {},
      }

      let snapshot_output = build_openresponses_stream_snapshot(&reply, &output_items);
      emit_chat_stream_event(
        &app,
        active_chat_process.inner(),
        OpenClawChatStreamEvent {
          session_id: session_id.clone(),
          status: if output_items.is_empty() {
            "Streaming assistant response".to_string()
          } else {
            "Streaming assistant response and tool trace".to_string()
          },
          reply: reply.clone(),
          raw_output: snapshot_output,
        },
      )?;
    }
  }

  set_active_chat_stream(active_chat_process.inner(), None)?;
  set_active_chat_stop_requested(active_chat_process.inner(), false)?;

  let raw_output = response_json.unwrap_or_else(|| build_openresponses_stream_snapshot(&reply, &output_items));

  Ok(OpenClawChatResponse {
    session_id,
    reply,
    raw_output,
  })
}

#[tauri::command]
fn stop_openclaw_message(active_chat_process: tauri::State<'_, ActiveChatProcessState>) -> Result<bool, String> {
  let current_pid = {
    let guard = active_chat_process
      .pid
      .lock()
      .map_err(|_| "无法锁定当前聊天进程状态".to_string())?;
    *guard
  };

  let Some(pid) = current_pid else {
    let has_stream = {
      let guard = active_chat_process
        .stream
        .lock()
        .map_err(|_| "无法锁定当前聊天流状态".to_string())?;
      guard.is_some()
    };

    if has_stream {
      set_active_chat_stop_requested(active_chat_process.inner(), true)?;
      return Ok(true);
    }

    return Ok(false);
  };

  let stopped = terminate_process(pid)?;
  if stopped {
    clear_active_chat_pid(active_chat_process.inner(), pid)?;
  }

  Ok(stopped)
}

#[tauri::command]
fn get_openclaw_active_stream(
  active_chat_process: tauri::State<'_, ActiveChatProcessState>,
) -> Result<Option<OpenClawChatStreamEvent>, String> {
  let guard = active_chat_process
    .stream
    .lock()
    .map_err(|_| "无法锁定当前聊天流状态".to_string())?;

  let snapshot = guard.clone();

  match serde_json::to_string(&snapshot) {
    Ok(serialized) => {
      println!("[get_openclaw_active_stream] {serialized}");
    },
    Err(error) => {
      eprintln!("[get_openclaw_active_stream] 序列化失败: {error}");
    },
  }

  Ok(snapshot)
}

#[tauri::command]
async fn install_bundled_openclaw_runtime(app: AppHandle) -> Result<InstallOpenClawResult, String> {
  let prefix = bundled_prefix(&app)?;
  ensure_bundled_layout(&prefix)?;
  sync_openclaw_skills_extra_dir(&app)?;
  let prefix_string = prefix.to_string_lossy().to_string();
  let wrapper_command_path = bundled_command_path(&prefix);

  let install_result = tauri::async_runtime::spawn_blocking(move || -> Result<Option<String>, String> {
        if cfg!(target_os = "windows") {
            let script = r#"
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
& ([scriptblock]::Create((Invoke-WebRequest -UseBasicParsing https://openclaw.ai/install.ps1))) -NoOnboard
$npmPrefix = ''
try {
  $npmPrefix = (npm prefix -g | Select-Object -Last 1).Trim()
} catch {}
$candidates = @()
if ($npmPrefix) {
  $candidates += (Join-Path $npmPrefix 'openclaw.cmd')
  $candidates += (Join-Path $npmPrefix 'openclaw')
}
if ($env:USERPROFILE) {
  $candidates += (Join-Path $env:USERPROFILE '.local\bin\openclaw.cmd')
  $candidates += (Join-Path $env:USERPROFILE '.local\bin\openclaw')
}
foreach ($candidate in $candidates) {
  if ($candidate -and (Test-Path $candidate)) {
    Write-Output ('__OPENCLAW_CMD__=' + $candidate)
    exit 0
  }
}
$cmd = Get-Command openclaw.cmd -ErrorAction SilentlyContinue
if (-not $cmd) { $cmd = Get-Command openclaw -ErrorAction SilentlyContinue }
if (-not $cmd) { throw 'OpenClaw 安装完成，但未能定位 openclaw 命令' }
Write-Output ('__OPENCLAW_CMD__=' + $cmd.Source)
"#;

            let output = Command::new("powershell")
                .arg("-NoProfile")
                .arg("-ExecutionPolicy")
                .arg("Bypass")
                .arg("-Command")
                .arg(script)
                .output()
                .map_err(|error| {
                    classify_windows_install_failure(
                        &format!("无法执行 Windows OpenClaw 安装脚本: {error}"),
                        "",
                    )
                })?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                return Err(classify_windows_install_failure(&stderr, &stdout));
            }

            let stdout = String::from_utf8_lossy(&output.stdout);
            let command_path = parse_marker_line(&stdout, "__OPENCLAW_CMD__=")
                .ok_or_else(|| "Windows 安装完成，但无法解析 openclaw 命令路径".to_string())?;

            return Ok(Some(command_path));
        }

        let shell = env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        let script = format!(
            "curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install-cli.sh | bash -s -- --prefix '{}' --version latest",
            prefix_string.replace('\'', "'\"'\"'")
        );

        let output = Command::new(shell)
            .arg("-lc")
            .arg(script)
            .output()
            .map_err(|error| format!("无法执行 OpenClaw 安装脚本: {error}"))?;

        if output.status.success() {
            Ok(None)
        } else {
            Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
        }
    })
    .await
    .map_err(|error| format!("安装任务失败: {error}"))?;
  let install_result = install_result?;

  if let Some(windows_command_path) = install_result {
    if cfg!(target_os = "windows") {
      write_windows_command_shim(&wrapper_command_path, &windows_command_path)?;
    }
  }

  let command_path = wrapper_command_path;
  validate_bundled_command(&command_path).map_err(|error| {
    if cfg!(target_os = "windows") {
      format!("{error}。如果你在 Windows 原生环境里仍然失败，优先考虑使用 WSL2 安装和运行 OpenClaw。")
    } else {
      error
    }
  })?;
  let config = write_config(
    &app,
    SaveConfigPayload {
      enabled: true,
      display_name: "Bundled OpenClaw".to_string(),
      base_url: bundled_gateway_base_url(),
      health_path: DEFAULT_OPENCLAW_HEALTH_PATH.to_string(),
      model: "anthropic/claude-opus-4-6".to_string(),
      command: command_path.to_string_lossy().to_string(),
      args: build_gateway_run_args(BUNDLED_GATEWAY_PORT),
      working_directory: prefix.to_string_lossy().to_string(),
    },
  )?;

  let status = OpenClawStatus {
    configured: true,
    bundled: true,
    executable_found: command_path.exists(),
    reachable: false,
    launchable: command_path.exists(),
    endpoint: build_endpoint(&config.base_url, &config.health_path),
    command_path: config.command.clone(),
    message: "内置 OpenClaw 已安装，下一步可直接启动 runtime".to_string(),
    http_status: None,
  };

  Ok(InstallOpenClawResult {
    prefix: prefix.to_string_lossy().to_string(),
    config,
    status,
  })
}

fn build_version_read_suggestion(command_path: &str) -> String {
  if cfg!(target_os = "windows") {
    format!(
      "确认命令路径可执行，并在 PowerShell 或 CMD 中手动运行 `\"{command_path}\" --version`；如果 Windows 原生环境下仍然失败，优先改用 WSL2。"
    )
  } else {
    format!("确认命令路径可执行，并手动运行 `{command_path} --version`。")
  }
}

fn read_openclaw_version(command_path: &str) -> Result<String, String> {
  if !executable_exists(command_path) {
    return Ok("未安装".to_string());
  }

  let mut command = build_openclaw_command(command_path);
  let output = command
    .arg("--version")
    .output()
    .map_err(|error| format!("无法读取 OpenClaw 版本: {error}"))?;

  if !output.status.success() {
    return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
  }

  Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn build_runtime_info(app: &AppHandle, config: &OpenClawConfig) -> Result<RuntimeInfoResult, String> {
  let install_dir = bundled_prefix(&app)?;
  ensure_bundled_layout(&install_dir)?;
  sync_openclaw_skills_extra_dir(&app)?;
  let skills_dir = bundled_skills_dir(&install_dir);
  let version_result = read_openclaw_version(&config.command);
  let (version, version_error) = match version_result {
    Ok(version) => (version, None),
    Err(error) => ("读取失败".to_string(), Some(error)),
  };

  Ok(RuntimeInfoResult {
    installed: executable_exists(&config.command),
    bundled: is_bundled_command(&app, &config.command),
    version,
    version_error,
    command_path: config.command.clone(),
    install_dir: install_dir.to_string_lossy().to_string(),
    skills_dir: skills_dir.to_string_lossy().to_string(),
    local_skills_dirs: read_openclaw_skills_extra_dirs(app)?,
  })
}

#[tauri::command]
fn get_openclaw_runtime_info(app: AppHandle) -> Result<RuntimeInfoResult, String> {
  let config = read_config(&app)?;
  build_runtime_info(&app, &config)
}

#[tauri::command]
async fn run_openclaw_self_check(app: AppHandle) -> Result<OpenClawSelfCheckResult, String> {
  let config = read_config(&app)?;
  let runtime_info = build_runtime_info(&app, &config)?;
  let runtime_status = probe_status(&app, &config).await;
  let checked_at = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|duration| duration.as_millis() as i64)
    .unwrap_or(0);
  let working_directory_ok = if config.working_directory.trim().is_empty() {
    None
  } else {
    Some(Path::new(&config.working_directory).exists())
  };
  let skills_dir_write_result = skills_dir_writable(Path::new(&runtime_info.skills_dir));
  let skills_dir_write_ok = skills_dir_write_result.is_ok();
  let skills_dir_write_detail = match &skills_dir_write_result {
    Ok(_) => format!("技能目录可写：{}", runtime_info.skills_dir),
    Err(error) => error.clone(),
  };

  let items = vec![
    OpenClawSelfCheckItem {
      key: "command".to_string(),
      label: "CLI 命令路径".to_string(),
      status: if runtime_info.installed { "pass" } else { "fail" }.to_string(),
      detail: if runtime_info.installed {
        runtime_info.command_path.clone()
      } else {
        format!("尚未找到可执行命令：{}", runtime_info.command_path)
      },
      suggestion: if runtime_info.installed {
        None
      } else {
        Some("先执行内置安装，或检查设置页里的启动命令是否指向真实的 openclaw 可执行文件。".to_string())
      },
    },
    OpenClawSelfCheckItem {
      key: "version".to_string(),
      label: "版本读取".to_string(),
      status: if runtime_info.version_error.is_some() { "fail" } else { "pass" }.to_string(),
      detail: runtime_info
        .version_error
        .clone()
        .map(|error| format!("版本读取失败：{error}"))
        .unwrap_or_else(|| runtime_info.version.clone()),
      suggestion: runtime_info
        .version_error
        .as_ref()
        .map(|_| build_version_read_suggestion(&runtime_info.command_path)),
    },
    OpenClawSelfCheckItem {
      key: "bundled".to_string(),
      label: "内置托管".to_string(),
      status: if runtime_info.bundled { "pass" } else { "warn" }.to_string(),
      detail: if runtime_info.bundled {
        "当前正在使用 Kadaclaw 管理的内置 runtime".to_string()
      } else {
        "当前命令可能来自系统环境或外部自定义路径".to_string()
      },
      suggestion: if runtime_info.bundled {
        None
      } else {
        Some("如果你希望 Kadaclaw 全权托管 runtime，重新执行“安装内置 OpenClaw”并保留默认命令路径。".to_string())
      },
    },
    OpenClawSelfCheckItem {
      key: "http".to_string(),
      label: "HTTP 探测".to_string(),
      status: if runtime_status.reachable { "pass" } else { "fail" }.to_string(),
      detail: format!("{} ({})", runtime_status.message, runtime_status.endpoint),
      suggestion: if runtime_status.reachable {
        None
      } else {
        Some("先点击“启动已安装 Runtime”或检查端口/健康检查路径是否与当前 OpenClaw 配置一致。".to_string())
      },
    },
    OpenClawSelfCheckItem {
      key: "working-directory".to_string(),
      label: "工作目录".to_string(),
      status: match working_directory_ok {
        Some(true) => "pass",
        Some(false) => "fail",
        None => "warn",
      }
      .to_string(),
      detail: match working_directory_ok {
        Some(true) => format!("工作目录存在：{}", config.working_directory),
        Some(false) => format!("工作目录不存在：{}", config.working_directory),
        None => "当前未设置 working directory，OpenClaw 将使用默认工作目录".to_string(),
      },
      suggestion: match working_directory_ok {
        Some(false) => {
          Some("把 working directory 改成真实存在的目录，或清空此项让 OpenClaw 使用默认工作目录。".to_string())
        },
        None => Some("如果你需要固定相对路径资源，再显式设置 working directory；否则留空即可。".to_string()),
        Some(true) => None,
      },
    },
    OpenClawSelfCheckItem {
      key: "skills-dir".to_string(),
      label: "技能目录写入".to_string(),
      status: if skills_dir_write_ok { "pass" } else { "fail" }.to_string(),
      detail: skills_dir_write_detail,
      suggestion: if skills_dir_write_ok {
        None
      } else {
        Some("检查应用数据目录权限，确认 Kadaclaw 对 skills 目录有写入权限后再重试。".to_string())
      },
    },
  ];

  Ok(OpenClawSelfCheckResult {
    runtime_info,
    runtime_status,
    checked_at,
    items,
  })
}

#[tauri::command]
fn get_openclaw_auth_config(app: AppHandle) -> Result<OpenClawAuthConfig, String> {
  read_openclaw_auth_config(&app)
}

#[tauri::command]
fn get_openclaw_local_skills_dirs(app: AppHandle) -> Result<OpenClawLocalSkillsDirsConfig, String> {
  Ok(OpenClawLocalSkillsDirsConfig {
    directories: read_openclaw_skills_extra_dirs(&app)?,
  })
}

#[tauri::command]
fn pick_openclaw_local_skills_dir() -> Result<Option<String>, String> {
  pick_openclaw_local_skills_dir_native()
}

#[tauri::command]
fn save_openclaw_local_skills_dirs(
  app: AppHandle,
  payload: SaveOpenClawLocalSkillsDirsPayload,
) -> Result<OpenClawLocalSkillsDirsConfig, String> {
  Ok(OpenClawLocalSkillsDirsConfig {
    directories: save_openclaw_local_skills_dirs_impl(&app, payload.directories)?,
  })
}

#[tauri::command]
fn save_openclaw_auth_config(app: AppHandle, payload: SaveOpenClawAuthPayload) -> Result<OpenClawAuthConfig, String> {
  save_openclaw_auth_config_impl(&app, payload)
}

#[tauri::command]
fn get_chat_history(app: AppHandle) -> Result<Option<ChatHistoryState>, String> {
  read_chat_history(&app)
}

#[tauri::command]
fn save_chat_history(app: AppHandle, payload: ChatHistoryState) -> Result<bool, String> {
  write_chat_history(&app, &payload)
}

#[tauri::command]
fn list_installed_skills(app: AppHandle) -> Result<Vec<InstalledSkillRecord>, String> {
  sync_openclaw_skills_extra_dir(&app)?;
  list_installed_skill_records(&app)
}

#[tauri::command]
fn list_recognized_skills(app: AppHandle) -> Result<Vec<OpenClawSkillEntry>, String> {
  sync_openclaw_skills_extra_dir(&app)?;
  read_openclaw_skill_registry(&app)
}

#[tauri::command]
fn remove_skill(app: AppHandle, skill_id: String) -> Result<bool, String> {
  let manifest_path = skill_manifest_path(&app, &skill_id)?;
  let target_dir = manifest_path
    .parent()
    .ok_or_else(|| "无法定位技能目录".to_string())?
    .to_path_buf();

  if !target_dir.exists() {
    return Ok(false);
  }

  fs::remove_dir_all(&target_dir).map_err(|error| format!("无法删除技能目录 {}: {error}", target_dir.display()))?;
  Ok(true)
}

#[tauri::command]
fn install_skill_from_directory(
  app: AppHandle,
  payload: InstallSkillFromDirectoryPayload,
) -> Result<InstalledSkillRecord, String> {
  let directory = payload.directory.trim();
  if directory.is_empty() {
    return Err("技能目录不能为空".to_string());
  }

  install_managed_skill_from_directory(&app, Path::new(directory))
}

#[tauri::command]
async fn install_skill_from_url(
  app: AppHandle,
  payload: InstallSkillFromUrlPayload,
) -> Result<InstalledSkillRecord, String> {
  install_skill_from_url_impl(&app, payload).await
}

#[tauri::command]
async fn upgrade_bundled_openclaw_runtime(app: AppHandle) -> Result<InstallOpenClawResult, String> {
  install_bundled_openclaw_runtime(app).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(ActiveChatProcessState::default())
    .invoke_handler(tauri::generate_handler![
      get_openclaw_config,
      save_openclaw_config,
      probe_openclaw_runtime,
      launch_openclaw_runtime,
      ensure_openclaw_runtime,
      get_openclaw_dashboard_url,
      open_openclaw_dashboard,
      get_openclaw_runtime_info,
      run_openclaw_self_check,
      get_openclaw_auth_config,
      get_openclaw_local_skills_dirs,
      pick_openclaw_local_skills_dir,
      save_openclaw_auth_config,
      save_openclaw_local_skills_dirs,
      get_chat_history,
      save_chat_history,
      send_openclaw_message,
      stop_openclaw_message,
      get_openclaw_active_stream,
      list_installed_skills,
      list_recognized_skills,
      remove_skill,
      install_skill_from_directory,
      install_skill_from_url,
      install_bundled_openclaw_runtime,
      upgrade_bundled_openclaw_runtime
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
