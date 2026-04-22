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

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct McpServerConfig {
  pub command: String,
  #[serde(default)]
  pub args: Vec<String>,
  #[serde(default)]
  pub env: HashMap<String, String>,
  #[serde(default)]
  pub startup_timeout_secs: Option<u64>,
  #[serde(default)]
  pub call_timeout_secs: Option<u64>,
  #[serde(default = "bool_true")]
  pub enabled: bool,
}

fn bool_true() -> bool {
  true
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
