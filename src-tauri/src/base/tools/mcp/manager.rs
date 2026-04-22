use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::base::models::McpServerConfig;
use crate::util::error::Result;

use super::super::{DynTool, Tool, ToolContext};
use super::client::{McpClient, McpToolDef};

// ── McpTool wraps a single MCP server tool ────────────────────────────────────

pub struct McpTool {
  pub tool_name: String,
  pub description: String,
  pub parameters_schema: Value,
  pub client: Arc<McpClient>,
}

#[async_trait]
impl Tool for McpTool {
  fn name(&self) -> &str {
    &self.tool_name
  }
  fn description(&self) -> &str {
    &self.description
  }
  fn parameters_schema(&self) -> Value {
    self.parameters_schema.clone()
  }

  async fn call(&self, _ctx: &ToolContext, args: Value) -> Result<String> {
    self.client.call_tool(&self.tool_name, &args).await
  }
}

// ── McpManager manages lifecycle of all MCP servers ──────────────────────────

pub struct McpManager {
  /// server_name -> (client, tool defs)
  servers: Mutex<HashMap<String, (Arc<McpClient>, Vec<McpToolDef>)>>,
}

impl McpManager {
  pub fn new() -> Self {
    Self {
      servers: Mutex::new(HashMap::new()),
    }
  }

  /// Start all enabled MCP servers and discover their tools.
  pub async fn start_all(&self, configs: &HashMap<String, McpServerConfig>) {
    let mut servers = self.servers.lock().await;
    for (name, cfg) in configs {
      if !cfg.enabled {
        continue;
      }
      match McpClient::start(
        &cfg.command,
        &cfg.args,
        &cfg.env,
        cfg.startup_timeout_secs.unwrap_or(30),
        cfg.call_timeout_secs.unwrap_or(60),
      )
      .await
      {
        Ok(client) => {
          let client = Arc::new(client);
          match client.list_tools().await {
            Ok(tools) => {
              tracing::info!("MCP server '{}' started, {} tools available", name, tools.len());
              servers.insert(name.clone(), (client, tools));
            },
            Err(e) => {
              tracing::warn!("MCP server '{}' list_tools failed: {e}", name);
            },
          }
        },
        Err(e) => {
          tracing::warn!("Failed to start MCP server '{}': {e}", name);
        },
      }
    }
  }

  /// Get all tools from all running MCP servers as Arc<dyn Tool>.
  pub async fn all_tools(&self) -> Vec<DynTool> {
    let servers = self.servers.lock().await;
    let mut tools: Vec<DynTool> = Vec::new();
    for (_, (client, defs)) in servers.iter() {
      for def in defs {
        tools.push(Arc::new(McpTool {
          tool_name: def.name.clone(),
          description: def.description.clone(),
          parameters_schema: def.input_schema.clone(),
          client: Arc::clone(client),
        }));
      }
    }
    tools
  }

  /// Shutdown all MCP server connections (drop clients).
  pub async fn shutdown(&self) {
    let mut servers = self.servers.lock().await;
    servers.clear();
  }
}
