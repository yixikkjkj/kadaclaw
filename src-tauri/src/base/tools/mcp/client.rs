use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::Mutex;
use tokio::time::timeout;

use crate::util::error::{KadaError, Result};

// ── MCP JSON-RPC Client ───────────────────────────────────────────────────────

pub struct McpClient {
  stdin: Arc<Mutex<ChildStdin>>,
  stdout: Arc<Mutex<BufReader<ChildStdout>>>,
  id_counter: Arc<AtomicU64>,
  call_timeout_secs: u64,
  _child: Child, // keep alive
}

impl McpClient {
  /// Start an MCP server as a child process and perform the initialize handshake.
  pub async fn start(
    command: &str,
    args: &[String],
    env: &HashMap<String, String>,
    startup_timeout_secs: u64,
    call_timeout_secs: u64,
  ) -> Result<Self> {
    let mut cmd = Command::new(command);
    cmd
      .args(args)
      .stdin(std::process::Stdio::piped())
      .stdout(std::process::Stdio::piped())
      .stderr(std::process::Stdio::null())
      .kill_on_drop(true);

    for (k, v) in env {
      cmd.env(k, v);
    }

    let mut child = cmd
      .spawn()
      .map_err(|e| KadaError::Tool(format!("Failed to spawn MCP server '{}': {e}", command)))?;

    let stdin = child
      .stdin
      .take()
      .ok_or_else(|| KadaError::Tool("Failed to capture MCP stdin".to_string()))?;
    let stdout = child
      .stdout
      .take()
      .ok_or_else(|| KadaError::Tool("Failed to capture MCP stdout".to_string()))?;

    let stdin = Arc::new(Mutex::new(stdin));
    let stdout = Arc::new(Mutex::new(BufReader::new(stdout)));
    let id_counter = Arc::new(AtomicU64::new(1));

    let client = McpClient {
      stdin,
      stdout,
      id_counter,
      call_timeout_secs,
      _child: child,
    };

    // Perform initialize handshake
    let init_timeout = Duration::from_secs(startup_timeout_secs);
    timeout(init_timeout, client.initialize())
      .await
      .map_err(|_| KadaError::Timeout(format!("MCP server '{}' startup timed out", command)))?
      .map_err(|e| KadaError::Tool(format!("MCP initialize failed: {e}")))?;

    Ok(client)
  }

  async fn initialize(&self) -> Result<()> {
    let _result = self
      .call_raw(
        "initialize",
        json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": { "name": "kada", "version": "1.0" }
        }),
      )
      .await?;

    // Send initialized notification
    self.notify("notifications/initialized", json!({})).await?;
    Ok(())
  }

  /// Send a JSON-RPC request and wait for the matching response.
  pub async fn call_raw(&self, method: &str, params: Value) -> Result<Value> {
    let id = self.id_counter.fetch_add(1, Ordering::Relaxed);
    let msg = json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": method,
        "params": params
    });

    let text = serde_json::to_string(&msg)? + "\n";
    {
      let mut stdin = self.stdin.lock().await;
      stdin
        .write_all(text.as_bytes())
        .await
        .map_err(|e| KadaError::Tool(format!("MCP write error: {e}")))?;
    }

    // Read response with timeout
    let call_timeout = Duration::from_secs(self.call_timeout_secs);
    timeout(call_timeout, async {
      let mut stdout = self.stdout.lock().await;
      let mut line = String::new();
      loop {
        line.clear();
        stdout
          .read_line(&mut line)
          .await
          .map_err(|e| KadaError::Tool(format!("MCP read error: {e}")))?;

        if line.trim().is_empty() {
          continue;
        }

        let val: Value = serde_json::from_str(line.trim())?;
        if val["id"].as_u64() == Some(id) {
          if let Some(err) = val.get("error") {
            return Err(KadaError::Tool(format!("MCP error: {err}")));
          }
          return Ok(val["result"].clone());
        }
        // Ignore notifications (no "id")
      }
    })
    .await
    .map_err(|_| KadaError::Timeout(format!("MCP call '{}' timed out after {}s", method, self.call_timeout_secs)))?
  }

  /// Send a JSON-RPC notification (no response expected).
  async fn notify(&self, method: &str, params: Value) -> Result<()> {
    let msg = json!({
        "jsonrpc": "2.0",
        "method": method,
        "params": params
    });
    let text = serde_json::to_string(&msg)? + "\n";
    let mut stdin = self.stdin.lock().await;
    stdin
      .write_all(text.as_bytes())
      .await
      .map_err(|e| KadaError::Tool(format!("MCP notify error: {e}")))?;
    Ok(())
  }

  /// List tools provided by this MCP server.
  pub async fn list_tools(&self) -> Result<Vec<McpToolDef>> {
    let result = self.call_raw("tools/list", json!({})).await?;
    let tools = result["tools"]
      .as_array()
      .map(|arr| {
        arr
          .iter()
          .filter_map(|t| {
            Some(McpToolDef {
              name: t["name"].as_str()?.to_string(),
              description: t["description"].as_str().unwrap_or("").to_string(),
              input_schema: t["inputSchema"].clone(),
            })
          })
          .collect()
      })
      .unwrap_or_default();
    Ok(tools)
  }

  /// Call a tool on this MCP server.
  pub async fn call_tool(&self, tool_name: &str, arguments: &Value) -> Result<String> {
    let result = self
      .call_raw("tools/call", json!({ "name": tool_name, "arguments": arguments }))
      .await?;

    // Extract text from MCP content blocks
    let content = result["content"].as_array();
    let text = content
      .map(|arr| {
        arr
          .iter()
          .filter_map(|block| {
            if block["type"].as_str() == Some("text") {
              block["text"].as_str().map(|s| s.to_string())
            } else {
              None
            }
          })
          .collect::<Vec<_>>()
          .join("\n")
      })
      .unwrap_or_else(|| result.to_string());

    Ok(text)
  }
}

#[derive(Clone, Debug)]
pub struct McpToolDef {
  pub name: String,
  pub description: String,
  pub input_schema: Value,
}
