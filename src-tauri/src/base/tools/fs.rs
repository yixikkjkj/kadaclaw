use async_trait::async_trait;
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};

use crate::util::error::{KadaError, Result};

use super::{Tool, ToolContext};

// ── Path helpers ──────────────────────────────────────────────────────────────

fn resolve_path(raw: &str, work_dir: &Path) -> PathBuf {
  if raw.starts_with("~/") {
    dirs_next::home_dir()
      .map(|h| h.join(&raw[2..]))
      .unwrap_or_else(|| PathBuf::from(raw))
  } else if Path::new(raw).is_absolute() {
    PathBuf::from(raw)
  } else {
    work_dir.join(raw)
  }
}

// ── read_file ─────────────────────────────────────────────────────────────────

pub struct ReadFileTool;

#[async_trait]
impl Tool for ReadFileTool {
  fn name(&self) -> &str {
    "read_file"
  }

  fn description(&self) -> &str {
    "Read the contents of a local file. Returns the raw text content."
  }

  fn parameters_schema(&self) -> Value {
    json!({
        "type": "object",
        "properties": {
            "path": { "type": "string", "description": "Absolute or workspace-relative file path" }
        },
        "required": ["path"]
    })
  }

  async fn call(&self, ctx: &ToolContext, args: Value) -> Result<String> {
    let path_str = args["path"]
      .as_str()
      .ok_or_else(|| KadaError::Tool("Missing required parameter: path".to_string()))?;
    let path = resolve_path(path_str, &ctx.work_dir);

    if !path.exists() {
      return Err(KadaError::NotFound(format!("File not found: {}", path.display())));
    }
    if !path.is_file() {
      return Err(KadaError::Tool(format!("Not a regular file: {}", path.display())));
    }

    let content = fs::read_to_string(&path)?;
    let lines = content.lines().count();
    Ok(format!("File: {}\nLines: {}\n\n{}", path.display(), lines, content))
  }
}

// ── write_file ────────────────────────────────────────────────────────────────

pub struct WriteFileTool;

#[async_trait]
impl Tool for WriteFileTool {
  fn name(&self) -> &str {
    "write_file"
  }

  fn description(&self) -> &str {
    "Write content to a file. Creates the file and parent directories if they don't exist."
  }

  fn parameters_schema(&self) -> Value {
    json!({
        "type": "object",
        "properties": {
            "path": { "type": "string", "description": "Absolute or workspace-relative file path" },
            "content": { "type": "string", "description": "Content to write to the file" }
        },
        "required": ["path", "content"]
    })
  }

  async fn call(&self, ctx: &ToolContext, args: Value) -> Result<String> {
    let path_str = args["path"]
      .as_str()
      .ok_or_else(|| KadaError::Tool("Missing required parameter: path".to_string()))?;
    let content = args["content"]
      .as_str()
      .ok_or_else(|| KadaError::Tool("Missing required parameter: content".to_string()))?;

    let path = resolve_path(path_str, &ctx.work_dir);

    if let Some(parent) = path.parent() {
      if !parent.exists() {
        fs::create_dir_all(parent)?;
      }
    }

    fs::write(&path, content)?;
    Ok(format!("Written {} bytes to {}", content.len(), path.display()))
  }
}

// ── edit_file (string replacement) ───────────────────────────────────────────

pub struct EditFileTool;

#[async_trait]
impl Tool for EditFileTool {
  fn name(&self) -> &str {
    "edit_file"
  }

  fn description(&self) -> &str {
    "Replace a specific string in a file with new content. Use exact, unique strings to identify the location."
  }

  fn parameters_schema(&self) -> Value {
    json!({
        "type": "object",
        "properties": {
            "path": { "type": "string", "description": "Absolute or workspace-relative file path" },
            "old_string": { "type": "string", "description": "Exact string to replace (must appear exactly once)" },
            "new_string": { "type": "string", "description": "Replacement string" }
        },
        "required": ["path", "old_string", "new_string"]
    })
  }

  async fn call(&self, ctx: &ToolContext, args: Value) -> Result<String> {
    let path_str = args["path"]
      .as_str()
      .ok_or_else(|| KadaError::Tool("Missing required parameter: path".to_string()))?;
    let old_string = args["old_string"]
      .as_str()
      .ok_or_else(|| KadaError::Tool("Missing required parameter: old_string".to_string()))?;
    let new_string = args["new_string"]
      .as_str()
      .ok_or_else(|| KadaError::Tool("Missing required parameter: new_string".to_string()))?;

    let path = resolve_path(path_str, &ctx.work_dir);
    if !path.exists() {
      return Err(KadaError::NotFound(format!("File not found: {}", path.display())));
    }

    let content = fs::read_to_string(&path)?;
    let count = content.matches(old_string).count();
    if count == 0 {
      return Err(KadaError::Tool(format!("String not found in {}: {}", path.display(), old_string)));
    }
    if count > 1 {
      return Err(KadaError::Tool(format!(
        "String found {} times in {} (must be unique). Add more context.",
        count,
        path.display()
      )));
    }

    let new_content = content.replacen(old_string, new_string, 1);
    fs::write(&path, &new_content)?;
    Ok(format!("Replaced 1 occurrence in {}", path.display()))
  }
}

// ── list_dir ──────────────────────────────────────────────────────────────────

pub struct ListDirTool;

#[async_trait]
impl Tool for ListDirTool {
  fn name(&self) -> &str {
    "list_dir"
  }

  fn description(&self) -> &str {
    "List the contents of a directory. Returns file names, sizes, and modification times."
  }

  fn parameters_schema(&self) -> Value {
    json!({
        "type": "object",
        "properties": {
            "path": { "type": "string", "description": "Directory path (absolute or workspace-relative). Defaults to working directory if omitted." }
        },
        "required": []
    })
  }

  async fn call(&self, ctx: &ToolContext, args: Value) -> Result<String> {
    let path = if let Some(p) = args["path"].as_str() {
      resolve_path(p, &ctx.work_dir)
    } else {
      ctx.work_dir.clone()
    };

    if !path.exists() {
      return Err(KadaError::NotFound(format!("Directory not found: {}", path.display())));
    }
    if !path.is_dir() {
      return Err(KadaError::Tool(format!("Not a directory: {}", path.display())));
    }

    let mut entries: Vec<String> = Vec::new();
    for entry in fs::read_dir(&path)? {
      let entry = entry?;
      let meta = entry.metadata()?;
      let name = entry.file_name().to_string_lossy().to_string();
      if meta.is_dir() {
        entries.push(format!("{}/", name));
      } else {
        let size = meta.len();
        entries.push(format!("{} ({}B)", name, size));
      }
    }
    entries.sort();

    Ok(format!("Directory: {}\n{}", path.display(), entries.join("\n")))
  }
}

// ── exec_skill_script ─────────────────────────────────────────────────────────
#[allow(dead_code)]
pub struct ExecSkillScriptTool;

#[async_trait]
impl Tool for ExecSkillScriptTool {
  fn name(&self) -> &str {
    "exec_skill_script"
  }

  fn description(&self) -> &str {
    "Execute a skill's script file. Provides access to the skill's working directory."
  }

  fn parameters_schema(&self) -> Value {
    json!({
        "type": "object",
        "properties": {
            "script_path": { "type": "string", "description": "Path to the script file to execute" },
            "args": { "type": "string", "description": "Arguments to pass to the script (optional)" }
        },
        "required": ["script_path"]
    })
  }

  async fn call(&self, ctx: &ToolContext, args: Value) -> Result<String> {
    let script_path_str = args["script_path"]
      .as_str()
      .ok_or_else(|| KadaError::Tool("Missing required parameter: script_path".to_string()))?;
    let script_args = args["args"].as_str().unwrap_or("");
    let script_path = resolve_path(script_path_str, &ctx.work_dir);

    if !script_path.exists() {
      return Err(KadaError::NotFound(format!("Script not found: {}", script_path.display())));
    }

    let cmd_str = if script_args.is_empty() {
      script_path.to_string_lossy().to_string()
    } else {
      format!("{} {}", script_path.display(), script_args)
    };

    super::exec::run_shell_command(&cmd_str, &ctx.work_dir, 30).await
  }
}
