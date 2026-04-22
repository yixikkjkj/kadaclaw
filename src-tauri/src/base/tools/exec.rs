use async_trait::async_trait;
use serde_json::{json, Value};
use std::path::Path;
use std::time::Duration;
use tokio::process::Command;

use crate::util::error::{KadaError, Result};

use super::{Tool, ToolContext};

// ── Dangerous pattern deny-list ───────────────────────────────────────────────

const DENY_PATTERNS: &[&str] = &[
  "rm -rf /",
  "del /s /q %systemroot%",
  "format c:",
  ":(){:|:&};:",
  "mkfs",
  "dd if=/dev/zero",
  "sudo rm -rf",
  "chmod -R 777 /",
  "mv /* ",
];

fn is_dangerous(cmd: &str) -> bool {
  let lower = cmd.to_lowercase();
  DENY_PATTERNS.iter().any(|p| lower.contains(p))
}

/// Run a shell command and return its stdout+stderr output.
/// `timeout_secs` hard-kills the process after the limit.
pub async fn run_shell_command(cmd: &str, work_dir: &Path, timeout_secs: u64) -> Result<String> {
  if is_dangerous(cmd) {
    return Err(KadaError::PermissionDenied(
      "This command matches a dangerous pattern and is not allowed.".to_string(),
    ));
  }

  #[cfg(target_os = "windows")]
  let child = Command::new("cmd")
    .args(["/C", cmd])
    .current_dir(work_dir)
    .stdout(std::process::Stdio::piped())
    .stderr(std::process::Stdio::piped())
    .kill_on_drop(true)
    .spawn()
    .map_err(|e| KadaError::Tool(format!("Failed to spawn process: {e}")))?;

  #[cfg(not(target_os = "windows"))]
  let child = Command::new("sh")
    .args(["-c", cmd])
    .current_dir(work_dir)
    .stdout(std::process::Stdio::piped())
    .stderr(std::process::Stdio::piped())
    .kill_on_drop(true)
    .spawn()
    .map_err(|e| KadaError::Tool(format!("Failed to spawn process: {e}")))?;

  let timeout = Duration::from_secs(timeout_secs);

  let output = tokio::time::timeout(timeout, child.wait_with_output())
    .await
    .map_err(|_| KadaError::Timeout(format!("Command timed out after {}s: {}", timeout_secs, cmd)))?
    .map_err(|e| KadaError::Tool(format!("Process error: {e}")))?;

  let stdout = String::from_utf8_lossy(&output.stdout);
  let stderr = String::from_utf8_lossy(&output.stderr);
  let exit_code = output.status.code().unwrap_or(-1);

  if exit_code != 0 {
    if stderr.is_empty() {
      return Err(KadaError::Tool(format!(
        "Command exited with code {}: {}\nOutput: {}",
        exit_code,
        cmd,
        stdout.trim()
      )));
    }
    return Err(KadaError::Tool(format!(
      "Command exited with code {}: {}\nStderr: {}",
      exit_code,
      cmd,
      stderr.trim()
    )));
  }

  let out = if stderr.is_empty() {
    stdout.to_string()
  } else {
    format!("{}\nStderr: {}", stdout, stderr)
  };

  Ok(out.trim().to_string())
}

// ── exec tool ─────────────────────────────────────────────────────────────────

pub struct ExecTool;

#[async_trait]
impl Tool for ExecTool {
  fn name(&self) -> &str {
    "exec"
  }

  fn description(&self) -> &str {
    "Execute a shell command in the working directory and return its output. \
         Use for file operations, build commands, data processing, etc."
  }

  fn parameters_schema(&self) -> Value {
    json!({
        "type": "object",
        "properties": {
            "command": {
                "type": "string",
                "description": "Shell command to execute"
            },
            "timeout_secs": {
                "type": "integer",
                "description": "Max seconds to wait (default: 30, max: 120)",
                "minimum": 1,
                "maximum": 120
            }
        },
        "required": ["command"]
    })
  }

  async fn call(&self, ctx: &ToolContext, args: Value) -> Result<String> {
    let cmd = args["command"]
      .as_str()
      .ok_or_else(|| KadaError::Tool("Missing required parameter: command".to_string()))?;

    let timeout_secs = args["timeout_secs"].as_u64().unwrap_or(30).min(120);

    run_shell_command(cmd, &ctx.work_dir, timeout_secs).await
  }
}
