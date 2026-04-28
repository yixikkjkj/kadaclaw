use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

// ---- Chat History types (kept for UI compatibility) ----

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChatHistoryMessage {
  pub id: String,
  pub role: String,
  pub content: Value,
  pub raw_content: Option<Value>,
  pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChatHistorySession {
  pub id: String,
  pub title: String,
  pub created_at: String,
  pub updated_at: String,
  pub messages: Vec<ChatHistoryMessage>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatHistoryState {
  pub active_chat_session_id: String,
  pub chat_sessions: Vec<ChatHistorySession>,
}

// ---- Provider config ----

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
  #[serde(default)]
  pub api_key: Option<String>,
  #[serde(default)]
  pub api_base: Option<String>,
  #[serde(default)]
  pub model: String,
}

// ---- Web search config ----

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WebSearchConfig {
  /// "duckduckgo" or "tavily"
  #[serde(default = "default_search_provider")]
  pub provider: String,
  #[serde(default)]
  pub tavily_api_key: Option<String>,
}

fn default_search_provider() -> String {
  "duckduckgo".to_string()
}

impl Default for WebSearchConfig {
  fn default() -> Self {
    Self {
      provider: default_search_provider(),
      tavily_api_key: None,
    }
  }
}

// ---- Browser config ----

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BrowserConfig {
  #[serde(default)]
  pub chrome_executable: Option<String>,
  #[serde(default = "default_connect_timeout")]
  pub connect_timeout_secs: u64,
  #[serde(default = "default_cdp_port")]
  pub cdp_port: u16,
}

fn default_connect_timeout() -> u64 {
  10
}
fn default_cdp_port() -> u16 {
  9222
}

impl Default for BrowserConfig {
  fn default() -> Self {
    Self {
      chrome_executable: None,
      connect_timeout_secs: default_connect_timeout(),
      cdp_port: default_cdp_port(),
    }
  }
}

// ---- MCP server config ----

fn bool_true() -> bool {
  true
}
fn default_call_timeout() -> u64 {
  60
}
fn default_startup_timeout() -> u64 {
  30
}

/// MCP server configuration — supports both stdio child-process and HTTP transports.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum McpServerConfig {
  Stdio {
    command: String,
    #[serde(default)]
    args: Vec<String>,
    #[serde(default)]
    env: HashMap<String, String>,
    /// Launch the process automatically on app start (default: true).
    #[serde(default = "bool_true")]
    auto_start: bool,
    #[serde(default = "bool_true")]
    enabled: bool,
    #[serde(default = "default_call_timeout")]
    call_timeout_secs: u64,
    #[serde(default = "default_startup_timeout")]
    startup_timeout_secs: u64,
  },
  Http {
    url: String,
    /// Extra request headers (e.g. Authorization).
    #[serde(default)]
    headers: HashMap<String, String>,
    #[serde(default = "bool_true")]
    enabled: bool,
    #[serde(default = "default_call_timeout")]
    call_timeout_secs: u64,
  },
}

impl McpServerConfig {
  pub fn is_enabled(&self) -> bool {
    match self {
      Self::Stdio { enabled, .. } => *enabled,
      Self::Http { enabled, .. } => *enabled,
    }
  }
  pub fn call_timeout_secs(&self) -> u64 {
    match self {
      Self::Stdio { call_timeout_secs, .. } => *call_timeout_secs,
      Self::Http { call_timeout_secs, .. } => *call_timeout_secs,
    }
  }
}

// ---- Agent config (top-level) ----

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AgentConfig {
  #[serde(default)]
  pub providers: HashMap<String, ProviderConfig>,
  #[serde(default = "default_active_provider")]
  pub active_provider: String,
  #[serde(default = "default_system_prompt")]
  pub system_prompt: String,
  #[serde(default = "default_max_tool_rounds")]
  pub max_tool_rounds: u32,
  #[serde(default = "default_enabled_tools")]
  pub enabled_tools: Vec<String>,
  #[serde(default)]
  pub web_search: WebSearchConfig,
  #[serde(default)]
  pub browser: BrowserConfig,
  #[serde(default)]
  pub mcp_servers: HashMap<String, McpServerConfig>,
  /// Hard token budget – compaction triggers when prompt tokens exceed `token_budget * compact_threshold`.
  #[serde(default = "default_token_budget")]
  pub token_budget: usize,
  /// Fraction of `token_budget` at which compaction kicks in (0.0 – 1.0).
  #[serde(default = "default_compact_threshold")]
  pub compact_threshold: f64,
}

fn default_active_provider() -> String {
  "openai".to_string()
}
fn default_system_prompt() -> String {
  "You are a helpful AI assistant. Use the available tools when needed to answer questions and complete tasks."
    .to_string()
}
fn default_max_tool_rounds() -> u32 {
  10
}
fn default_token_budget() -> usize {
  100_000
}
fn default_compact_threshold() -> f64 {
  0.8
}
fn default_enabled_tools() -> Vec<String> {
  vec![
    "read_file", "write_file", "edit_file", "list_dir", "web_fetch", "web_search", "exec",
  ]
  .into_iter()
  .map(String::from)
  .collect()
}

impl Default for AgentConfig {
  fn default() -> Self {
    Self {
      providers: HashMap::new(),
      active_provider: default_active_provider(),
      system_prompt: default_system_prompt(),
      max_tool_rounds: default_max_tool_rounds(),
      enabled_tools: default_enabled_tools(),
      web_search: WebSearchConfig::default(),
      browser: BrowserConfig::default(),
      mcp_servers: HashMap::new(),
      token_budget: default_token_budget(),
      compact_threshold: default_compact_threshold(),
    }
  }
}

// ---- Skill record types (for UI) ----

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SkillManifest {
  pub id: String,
  pub name: String,
  pub category: String,
  pub summary: String,
  pub author: String,
  pub version: String,
  pub entry: String,
  /// 始终注入此技能，不受对话语境影响（适用于个性化规则类技能）
  #[serde(default)]
  pub always: bool,
  /// 此技能激活时允许使用的工具白名单（空列表 = 不限制）
  #[serde(default)]
  pub tools: Vec<String>,
  /// 输出格式提示（如 "markdown" / "json" / "table"）
  #[serde(default)]
  pub output_format: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstalledSkillRecord {
  pub id: String,
  pub name: String,
  pub category: String,
  pub summary: String,
  pub author: String,
  pub version: String,
  pub enabled: bool,
  pub manifest_path: String,
  pub directory: String,
  pub source_label: String,
  pub source_type: String,
  pub removable: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallSkillFromDirectoryPayload {
  pub directory: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallSkillFromUrlPayload {
  pub url: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecognizedSkillRecord {
  pub name: String,
  pub description: String,
  pub eligible: bool,
  pub disabled: bool,
  pub blocked_by_allowlist: bool,
  pub source: String,
  pub bundled: bool,
}
