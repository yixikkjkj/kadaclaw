use async_trait::async_trait;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Arc;

use crate::util::error::Result;

// ── Tool context (per-call) ───────────────────────────────────────────────────

#[derive(Clone)]
#[allow(dead_code)]
pub struct ToolContext {
  /// Working directory for relative paths
  pub work_dir: PathBuf,
  /// App data directory (reserved for future use)
  pub data_dir: PathBuf,
  /// Web search provider ("duckduckgo" | "tavily")
  pub web_search_provider: String,
  /// Tavily API key (if provider == "tavily")
  pub tavily_api_key: Option<String>,
  /// Chrome CDP port
  pub cdp_port: u16,
  /// Chrome executable path override (reserved for future use)
  pub chrome_executable: Option<String>,
}

// ── Tool trait ────────────────────────────────────────────────────────────────

#[async_trait]
pub trait Tool: Send + Sync {
  fn name(&self) -> &str;
  fn description(&self) -> &str;
  fn parameters_schema(&self) -> Value;

  /// Full OpenAI-style function schema
  fn schema(&self) -> Value {
    json!({
        "type": "function",
        "function": {
            "name": self.name(),
            "description": self.description(),
            "parameters": self.parameters_schema()
        }
    })
  }

  async fn call(&self, ctx: &ToolContext, args: Value) -> Result<String>;
}

pub type DynTool = Arc<dyn Tool>;

pub mod browser;
pub mod exec;
pub mod fs;
pub mod mcp;
pub mod memory;
pub mod registry;
pub mod web;

pub use registry::ToolRegistry;
