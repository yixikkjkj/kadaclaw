use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::base::models::McpServerConfig;
use crate::util::error::Result;

use super::super::{DynTool, Tool, ToolContext};
use super::client::{AnyMcpClient, McpHttpClient, McpStdioClient, McpToolDef};

// ── McpTool wraps a single MCP server tool ────────────────────────────────────

pub struct McpTool {
  pub tool_name: String,
  pub description: String,
  pub parameters_schema: Value,
  pub client: Arc<AnyMcpClient>,
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
  servers: Mutex<HashMap<String, (Arc<AnyMcpClient>, Vec<McpToolDef>)>>,
}

impl Default for McpManager {
  fn default() -> Self {
    Self::new()
  }
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
      if !cfg.is_enabled() {
        continue;
      }

      let client_result: Result<Arc<AnyMcpClient>> = match cfg {
        McpServerConfig::Stdio {
          command,
          args,
          env,
          auto_start,
          startup_timeout_secs,
          call_timeout_secs,
          ..
        } => {
          if !auto_start {
            continue;
          }
          McpStdioClient::start(command, args, env, *startup_timeout_secs, *call_timeout_secs)
            .await
            .map(|c| Arc::new(AnyMcpClient::Stdio(c)))
        },
        McpServerConfig::Http {
          url,
          headers,
          call_timeout_secs,
          ..
        } => McpHttpClient::connect(url, headers, *call_timeout_secs)
          .await
          .map(|c| Arc::new(AnyMcpClient::Http(c))),
      };

      match client_result {
        Ok(client) => match client.list_tools().await {
          Ok(tools) => {
            tracing::info!("MCP server '{}' started, {} tools available", name, tools.len());
            servers.insert(name.clone(), (client, tools));
          },
          Err(e) => {
            tracing::warn!("MCP server '{}' list_tools failed: {e}", name);
          },
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
    for (_, (client, _)) in servers.iter() {
      client.shutdown().await;
    }
    servers.clear();
  }

  /// Restart a single MCP server by name.
  pub async fn restart_server(&self, name: &str, cfg: &McpServerConfig) {
    // Shut down existing instance if running
    {
      let mut servers = self.servers.lock().await;
      if let Some((client, _)) = servers.remove(name) {
        client.shutdown().await;
      }
    }

    if !cfg.is_enabled() {
      return;
    }

    let client_result: Result<Arc<AnyMcpClient>> = match cfg {
      McpServerConfig::Stdio {
        command,
        args,
        env,
        auto_start,
        startup_timeout_secs,
        call_timeout_secs,
        ..
      } => {
        if !auto_start {
          return;
        }
        McpStdioClient::start(command, args, env, *startup_timeout_secs, *call_timeout_secs)
          .await
          .map(|c| Arc::new(AnyMcpClient::Stdio(c)))
      },
      McpServerConfig::Http {
        url,
        headers,
        call_timeout_secs,
        ..
      } => McpHttpClient::connect(url, headers, *call_timeout_secs)
        .await
        .map(|c| Arc::new(AnyMcpClient::Http(c))),
    };

    match client_result {
      Ok(client) => match client.list_tools().await {
        Ok(tools) => {
          tracing::info!("MCP server '{}' restarted, {} tools", name, tools.len());
          let mut servers = self.servers.lock().await;
          servers.insert(name.to_string(), (client, tools));
        },
        Err(e) => tracing::warn!("MCP server '{}' list_tools failed after restart: {e}", name),
      },
      Err(e) => tracing::warn!("Failed to restart MCP server '{}': {e}", name),
    }
  }

  /// Returns a map of server_name → is_running.
  pub async fn server_statuses(&self) -> HashMap<String, bool> {
    let servers = self.servers.lock().await;
    servers.keys().map(|name| (name.clone(), true)).collect()
  }
}
