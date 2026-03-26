use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeInfoResult {
    installed: bool,
    bundled: bool,
    version: String,
    command_path: String,
    install_dir: String,
    skills_dir: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenClawAuthConfig {
    provider: String,
    model: String,
    api_key_env_name: String,
    api_key_configured: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveOpenClawAuthPayload {
    provider: String,
    model: String,
    api_key: String,
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
    raw_output: String,
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstallSkillPayload {
    id: String,
    name: String,
    category: String,
    summary: String,
    author: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct InstalledSkillRecord {
    id: String,
    manifest_path: String,
    directory: String,
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

impl Default for OpenClawConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            display_name: "OpenClaw Runtime".to_string(),
            base_url: "http://127.0.0.1:18789".to_string(),
            health_path: "/".to_string(),
            model: "anthropic/claude-opus-4-6".to_string(),
            command: "openclaw".to_string(),
            args: vec![
                "gateway".to_string(),
                "run".to_string(),
                "--allow-unconfigured".to_string(),
                "--auth".to_string(),
                "none".to_string(),
                "--port".to_string(),
                "18789".to_string(),
                "--force".to_string(),
            ],
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
        let content = fs::read_to_string(path)
            .map_err(|error| format!("无法读取配置文件 {}: {error}", path.display()))?;
        Ok(serde_json::from_str::<Value>(&content).unwrap_or_else(|_| Value::Object(Map::new())))
    } else {
        Ok(Value::Object(Map::new()))
    }
}

fn write_runtime_config_value(path: &Path, root: &Value) -> Result<(), String> {
    let body = serde_json::to_string_pretty(root)
        .map_err(|error| format!("无法序列化 OpenClaw 配置: {error}"))?;
    fs::write(path, body)
        .map_err(|error| format!("无法更新 OpenClaw 配置 {}: {error}", path.display()))
}

fn ensure_runtime_config_object(path: &Path) -> Result<Value, String> {
    let mut root = read_runtime_config_value(path)?;
    if !root.is_object() {
        root = Value::Object(Map::new());
    }
    Ok(root)
}

fn read_config(app: &AppHandle) -> Result<OpenClawConfig, String> {
    let path = config_path(app)?;
    if !path.exists() {
        return Ok(OpenClawConfig::default());
    }

    let content = fs::read_to_string(&path).map_err(|error| format!("无法读取配置: {error}"))?;
    let mut config: OpenClawConfig =
        serde_json::from_str(&content).map_err(|error| format!("配置文件格式错误: {error}"))?;

    if is_legacy_bundled_probe_config(app, &config) {
        config.base_url = "http://127.0.0.1:18789".to_string();
        let body = serde_json::to_string_pretty(&config)
            .map_err(|error| format!("无法序列化迁移后的配置: {error}"))?;
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
    let body = serde_json::to_string_pretty(&config)
        .map_err(|error| format!("无法序列化配置: {error}"))?;
    fs::write(path, body).map_err(|error| format!("无法写入配置: {error}"))?;
    sync_openclaw_skills_extra_dir(app)?;
    Ok(config)
}

fn normalize_health_path(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        "/".to_string()
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
    let endpoint = build_endpoint(&config.base_url, &config.health_path);
    let bundled = is_bundled_command(app, &config.command);

    let response = reqwest::Client::new()
        .get(&endpoint)
        .timeout(Duration::from_secs(2))
        .send()
        .await;
    let (reachable, http_status, message) = match response {
        Ok(response) => {
            let status = response.status();
            let ok = status.is_success() || status == StatusCode::NOT_FOUND;
            let message = if ok {
                format!("OpenClaw runtime 已响应 {}", status.as_u16())
            } else {
                format!("OpenClaw runtime 返回状态 {}", status.as_u16())
            };
            (ok, Some(status.as_u16()), message)
        }
        Err(error) => (
            false,
            None,
            format!("无法连接到 OpenClaw runtime: {error}"),
        ),
    };

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

fn is_legacy_bundled_probe_config(app: &AppHandle, config: &OpenClawConfig) -> bool {
    is_bundled_command(app, &config.command) && config.base_url.trim() == "http://127.0.0.1:18791"
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
        prefix.join("state"),
        prefix.join("config"),
        bundled_skills_dir(prefix),
    ];

    for dir in dirs {
        if !dir.exists() {
            fs::create_dir_all(&dir)
                .map_err(|error| format!("无法创建目录 {}: {error}", dir.display()))?;
        }
    }

    Ok(())
}

fn skills_dir_for_app(app: &AppHandle) -> Result<PathBuf, String> {
    let prefix = bundled_prefix(app)?;
    ensure_bundled_layout(&prefix)?;
    Ok(bundled_skills_dir(&prefix))
}

fn sync_openclaw_skills_extra_dir(app: &AppHandle) -> Result<(), String> {
    let skills_dir = skills_dir_for_app(app)?;
    let path = runtime_config_path(&bundled_prefix(app)?);
    let mut root = ensure_runtime_config_object(&path)?;

    let root_obj = root
        .as_object_mut()
        .ok_or_else(|| "配置文件对象无效".to_string())?;
    let skills_value = root_obj
        .entry("skills".to_string())
        .or_insert_with(|| json!({}));
    if !skills_value.is_object() {
        *skills_value = json!({});
    }

    let skills_obj = skills_value
        .as_object_mut()
        .ok_or_else(|| "skills 配置无效".to_string())?;
    let load_value = skills_obj
        .entry("load".to_string())
        .or_insert_with(|| json!({}));
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
    if !extra_dirs.iter().any(|item| item.as_str() == Some(&skills_dir_string)) {
        extra_dirs.push(Value::String(skills_dir_string));
    }

    write_runtime_config_value(&path, &root)
}

fn provider_env_name(provider: &str) -> Option<&'static str> {
    match provider {
        "anthropic" => Some("ANTHROPIC_API_KEY"),
        "openai" => Some("OPENAI_API_KEY"),
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
    let provider = provider_from_model(&model);
    let api_key_env_name = provider_env_name(&provider)
        .unwrap_or("ANTHROPIC_API_KEY")
        .to_string();
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

    let root_obj = root
        .as_object_mut()
        .ok_or_else(|| "配置文件对象无效".to_string())?;

    let env_value = root_obj
        .entry("env".to_string())
        .or_insert_with(|| json!({}));
    if !env_value.is_object() {
        *env_value = json!({});
    }
    let env_obj = env_value
        .as_object_mut()
        .ok_or_else(|| "env 配置无效".to_string())?;

    let api_key = payload.api_key.trim().to_string();
    if !api_key.is_empty() {
        env_obj.insert(api_key_env_name.clone(), Value::String(api_key));
    }

    let agents_value = root_obj
        .entry("agents".to_string())
        .or_insert_with(|| json!({}));
    if !agents_value.is_object() {
        *agents_value = json!({});
    }
    let agents_obj = agents_value
        .as_object_mut()
        .ok_or_else(|| "agents 配置无效".to_string())?;
    let defaults_value = agents_obj
        .entry("defaults".to_string())
        .or_insert_with(|| json!({}));
    if !defaults_value.is_object() {
        *defaults_value = json!({});
    }
    let defaults_obj = defaults_value
        .as_object_mut()
        .ok_or_else(|| "agents.defaults 配置无效".to_string())?;
    let model_value = defaults_obj
        .entry("model".to_string())
        .or_insert_with(|| json!({}));
    if !model_value.is_object() {
        *model_value = json!({});
    }
    let model_obj = model_value
        .as_object_mut()
        .ok_or_else(|| "agents.defaults.model 配置无效".to_string())?;
    model_obj.insert("primary".to_string(), Value::String(model.clone()));

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
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect()
}

fn skill_manifest_path(app: &AppHandle, skill_id: &str) -> Result<PathBuf, String> {
    let skills_dir = skills_dir_for_app(app)?;
    Ok(skills_dir.join(skill_dir_name(skill_id)).join("skill.json"))
}

fn list_installed_skill_records(app: &AppHandle) -> Result<Vec<InstalledSkillRecord>, String> {
    let skills_dir = skills_dir_for_app(app)?;
    let mut records = Vec::new();

    let entries = fs::read_dir(&skills_dir)
        .map_err(|error| format!("无法读取技能目录 {}: {error}", skills_dir.display()))?;

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

        let content = fs::read_to_string(&manifest_path)
            .map_err(|error| format!("无法读取技能清单 {}: {error}", manifest_path.display()))?;
        let manifest: SkillManifest = serde_json::from_str(&content)
            .map_err(|error| format!("技能清单格式错误 {}: {error}", manifest_path.display()))?;

        records.push(InstalledSkillRecord {
            id: manifest.id,
            manifest_path: manifest_path.to_string_lossy().to_string(),
            directory: path.to_string_lossy().to_string(),
        });
    }

    records.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(records)
}

fn build_skill_markdown(payload: &InstallSkillPayload) -> String {
    format!(
        "---\nname: {id}\ndescription: {summary}\nmetadata: {{\"openclaw\":{{\"skillKey\":\"{id}\",\"kadaclaw\":true,\"category\":\"{category}\",\"author\":\"{author}\"}}}}\n---\n\n# {name}\n\n{summary}\n\n## Usage\n\nUse this skill when the user's request matches the {category} capability described above.\n\n## Notes\n\n- Installed by Kadaclaw into the managed local skills directory.\n- This is a generated local skill scaffold intended to be expanded into a richer OpenClaw skill package.\n",
        id = payload.id,
        name = payload.name,
        summary = payload.summary,
        author = payload.author,
        category = payload.category
    )
}

fn run_command_with_timeout(
    command: &mut Command,
    timeout: Duration,
    description: &str,
) -> Result<Output, String> {
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
            }
            Ok(None) => {
                if started_at.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(format!(
                        "{description} 超时（>{} 秒）",
                        timeout.as_secs()
                    ));
                }
                thread::sleep(Duration::from_millis(100));
            }
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("无法检查 {description} 状态: {error}"));
            }
        }
    }
}

fn read_openclaw_skill_registry(app: &AppHandle) -> Result<Vec<OpenClawSkillEntry>, String> {
    let config = read_config(app)?;
    let attempts = 3;

    for attempt in 0..attempts {
        let mut command = Command::new(&config.command);
        command.args(["skills", "list", "--json"]);
        if !config.working_directory.is_empty() {
            command.current_dir(&config.working_directory);
        }
        apply_openclaw_env(&mut command, &config);

        let output = run_command_with_timeout(
            &mut command,
            Duration::from_secs(6),
            "OpenClaw 技能列表命令",
        )?;

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
    let mut command = Command::new(&config.command);
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

async fn wait_for_runtime_ready(
    app: &AppHandle,
    config: &OpenClawConfig,
    timeout: Duration,
) -> OpenClawStatus {
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
fn save_openclaw_config(
    app: AppHandle,
    payload: SaveConfigPayload,
) -> Result<OpenClawConfig, String> {
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

    spawn_runtime_process(&config)?;

    let mut status = wait_for_runtime_ready(&app, &config, Duration::from_secs(10)).await;
    status.message = if status.reachable {
        "OpenClaw runtime 已启动并连接".to_string()
    } else {
        "已发起 OpenClaw runtime 启动命令，但等待就绪超时".to_string()
    };
    Ok(status)
}

#[tauri::command]
fn get_openclaw_dashboard_url(app: AppHandle) -> Result<DashboardUrlResult, String> {
    let config = read_config(&app)?;
    let mut command = Command::new(&config.command);
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

    let app_clone = app.clone();
    let config_clone = config.clone();
    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        spawn_runtime_process(&config_clone)?;
        let _ = app_clone;
        Ok(())
    })
    .await
    .map_err(|error| format!("自动启动任务失败: {error}"))??;

    let mut status = wait_for_runtime_ready(&app, &config, Duration::from_secs(10)).await;
    if status.reachable {
        status.message = "OpenClaw runtime 已自动启动并连接".to_string();
    } else {
        status.message = "已尝试自动启动 OpenClaw runtime，但等待就绪超时".to_string();
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

    let status = probe_status(&app, &config).await;
    if !status.reachable && executable_exists(&config.command) {
        let config_clone = config.clone();
        tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
            spawn_runtime_process(&config_clone)?;
            thread::sleep(Duration::from_secs(2));
            Ok(())
        })
        .await
        .map_err(|error| format!("自动启动聊天 runtime 失败: {error}"))??;
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
    let config_clone = config.clone();

    tauri::async_runtime::spawn_blocking(move || -> Result<OpenClawChatResponse, String> {
        let mut command = Command::new(&config_clone.command);
        command
            .arg("agent")
            .arg("--session-id")
            .arg(&session_id)
            .arg("--message")
            .arg(&message);
        if let Some(thinking) = thinking {
            command.arg("--thinking").arg(thinking);
        }
        if !config_clone.working_directory.is_empty() {
            command.current_dir(&config_clone.working_directory);
        }
        apply_openclaw_env(&mut command, &config_clone);

        let output = command
            .output()
            .map_err(|error| format!("无法向 OpenClaw 发送消息: {error}"))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let detail = if !stderr.is_empty() {
                stderr
            } else if !stdout.is_empty() {
                stdout
            } else {
                "OpenClaw 未返回错误信息".to_string()
            };
            return Err(detail);
        }

        let raw_output = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let reply = raw_output
            .lines()
            .filter(|line| !line.trim_start().starts_with("MEDIA:"))
            .collect::<Vec<_>>()
            .join("\n")
            .trim()
            .to_string();

        if reply.is_empty() {
            return Err("OpenClaw 未返回可显示的文本回复".to_string());
        }

        Ok(OpenClawChatResponse {
            session_id,
            reply,
            raw_output,
        })
    })
    .await
    .map_err(|error| format!("聊天任务失败: {error}"))?
}

#[tauri::command]
async fn install_bundled_openclaw_runtime(app: AppHandle) -> Result<InstallOpenClawResult, String> {
    let prefix = bundled_prefix(&app)?;
    ensure_bundled_layout(&prefix)?;
    sync_openclaw_skills_extra_dir(&app)?;
    let prefix_string = prefix.to_string_lossy().to_string();

    let install_result = tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        if cfg!(target_os = "windows") {
            return Err("当前内置安装器暂未实现 Windows 版本；macOS / Linux 可直接使用".to_string());
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
            Ok(())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
        }
    })
    .await
    .map_err(|error| format!("安装任务失败: {error}"))?;

    install_result?;

    let command_path = bundled_command_path(&prefix);
    let config = write_config(
        &app,
        SaveConfigPayload {
            enabled: true,
            display_name: "Bundled OpenClaw".to_string(),
            base_url: "http://127.0.0.1:18789".to_string(),
            health_path: "/".to_string(),
            model: "anthropic/claude-opus-4-6".to_string(),
            command: command_path.to_string_lossy().to_string(),
            args: vec![
                "gateway".to_string(),
                "run".to_string(),
                "--allow-unconfigured".to_string(),
                "--auth".to_string(),
                "none".to_string(),
                "--port".to_string(),
                "18789".to_string(),
                "--force".to_string(),
            ],
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

fn read_openclaw_version(command_path: &str) -> Result<String, String> {
    if !executable_exists(command_path) {
        return Ok("未安装".to_string());
    }

    let output = Command::new(command_path)
        .arg("--version")
        .output()
        .map_err(|error| format!("无法读取 OpenClaw 版本: {error}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[tauri::command]
fn get_openclaw_runtime_info(app: AppHandle) -> Result<RuntimeInfoResult, String> {
    let config = read_config(&app)?;
    let install_dir = bundled_prefix(&app)?;
    ensure_bundled_layout(&install_dir)?;
    sync_openclaw_skills_extra_dir(&app)?;
    let skills_dir = bundled_skills_dir(&install_dir);

    Ok(RuntimeInfoResult {
        installed: executable_exists(&config.command),
        bundled: is_bundled_command(&app, &config.command),
        version: read_openclaw_version(&config.command)?,
        command_path: config.command,
        install_dir: install_dir.to_string_lossy().to_string(),
        skills_dir: skills_dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn get_openclaw_auth_config(app: AppHandle) -> Result<OpenClawAuthConfig, String> {
    read_openclaw_auth_config(&app)
}

#[tauri::command]
fn save_openclaw_auth_config(
    app: AppHandle,
    payload: SaveOpenClawAuthPayload,
) -> Result<OpenClawAuthConfig, String> {
    save_openclaw_auth_config_impl(&app, payload)
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
fn install_skill(app: AppHandle, payload: InstallSkillPayload) -> Result<InstalledSkillRecord, String> {
    let skills_dir = skills_dir_for_app(&app)?;
    sync_openclaw_skills_extra_dir(&app)?;
    let target_dir = skills_dir.join(skill_dir_name(&payload.id));
    if !target_dir.exists() {
        fs::create_dir_all(&target_dir)
            .map_err(|error| format!("无法创建技能目录 {}: {error}", target_dir.display()))?;
    }

    let skill_markdown = build_skill_markdown(&payload);
    let manifest = SkillManifest {
        id: payload.id,
        name: payload.name,
        category: payload.category,
        summary: payload.summary,
        author: payload.author,
        version: "0.1.0".to_string(),
        entry: "SKILL.md".to_string(),
    };

    let manifest_path = target_dir.join("skill.json");
    let manifest_body = serde_json::to_string_pretty(&manifest)
        .map_err(|error| format!("无法序列化技能清单: {error}"))?;
    fs::write(&manifest_path, manifest_body)
        .map_err(|error| format!("无法写入技能清单 {}: {error}", manifest_path.display()))?;
    let skill_markdown_path = target_dir.join("SKILL.md");
    fs::write(&skill_markdown_path, skill_markdown)
        .map_err(|error| format!("无法写入技能说明 {}: {error}", skill_markdown_path.display()))?;

    Ok(InstalledSkillRecord {
        id: manifest.id,
        manifest_path: manifest_path.to_string_lossy().to_string(),
        directory: target_dir.to_string_lossy().to_string(),
    })
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

    fs::remove_dir_all(&target_dir)
        .map_err(|error| format!("无法删除技能目录 {}: {error}", target_dir.display()))?;
    Ok(true)
}

#[tauri::command]
async fn upgrade_bundled_openclaw_runtime(app: AppHandle) -> Result<InstallOpenClawResult, String> {
    install_bundled_openclaw_runtime(app).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_openclaw_config,
            save_openclaw_config,
            probe_openclaw_runtime,
            launch_openclaw_runtime,
            ensure_openclaw_runtime,
            get_openclaw_dashboard_url,
            get_openclaw_runtime_info,
            get_openclaw_auth_config,
            save_openclaw_auth_config,
            send_openclaw_message,
            list_installed_skills,
            list_recognized_skills,
            install_skill,
            remove_skill,
            install_bundled_openclaw_runtime,
            upgrade_bundled_openclaw_runtime
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
