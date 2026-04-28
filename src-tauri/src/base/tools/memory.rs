use std::sync::Arc;

use async_trait::async_trait;
use serde_json::{json, Value};

use crate::base::memory::{new_memory_id, MemoryEntry, MemoryScope, MemoryStore, MemoryType};
use crate::base::tools::{DynTool, Tool, ToolContext};
use crate::util::error::Result;

// ── memory_query ──────────────────────────────────────────────────────────────

pub struct MemoryQueryTool {
  store: Arc<MemoryStore>,
}

#[async_trait]
impl Tool for MemoryQueryTool {
  fn name(&self) -> &str {
    "memory_query"
  }

  fn description(&self) -> &str {
    "Search the long-term memory store for relevant information. Use this before answering questions that may benefit from past context or user preferences."
  }

  fn parameters_schema(&self) -> Value {
    json!({
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "Search query string"
        },
        "memory_type": {
          "type": "string",
          "description": "Optional filter: fact, preference, project, task, glossary, contact, snippet, policy, note, session_summary"
        },
        "scope": {
          "type": "string",
          "description": "Optional filter: long_term or short_term"
        },
        "top_k": {
          "type": "integer",
          "description": "Maximum number of results (default 5)"
        },
        "stats": {
          "type": "boolean",
          "description": "Return memory statistics instead of search results"
        }
      },
      "required": ["query"]
    })
  }

  async fn call(&self, _ctx: &ToolContext, args: Value) -> Result<String> {
    // Return stats if requested
    if args.get("stats").and_then(|v| v.as_bool()).unwrap_or(false) {
      let stats = self.store.stats().map_err(|e| crate::util::error::KadaError::Tool(e))?;
      return Ok(serde_json::to_string_pretty(&stats).unwrap_or_default());
    }

    let query = args.get("query").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let memory_type = args.get("memory_type").and_then(|v| v.as_str()).map(String::from);
    let scope = args.get("scope").and_then(|v| v.as_str()).map(String::from);
    let top_k = args.get("top_k").and_then(|v| v.as_u64()).unwrap_or(5) as usize;

    let entries = self
      .store
      .search(&query, scope.as_deref(), memory_type.as_deref(), top_k)
      .map_err(|e| crate::util::error::KadaError::Tool(e))?;

    if entries.is_empty() {
      return Ok("No relevant memories found.".to_string());
    }

    let result = entries
      .iter()
      .map(|e| format!("[{}] (id:{}) {}", e.memory_type, e.id, e.content))
      .collect::<Vec<_>>()
      .join("\n");

    Ok(result)
  }
}

// ── memory_upsert ─────────────────────────────────────────────────────────────

pub struct MemoryUpsertTool {
  store: Arc<MemoryStore>,
}

#[async_trait]
impl Tool for MemoryUpsertTool {
  fn name(&self) -> &str {
    "memory_upsert"
  }

  fn description(&self) -> &str {
    "Save or update a memory entry. Use this when the user confirms important preferences, project backgrounds, or conclusions that should be remembered across sessions."
  }

  fn parameters_schema(&self) -> Value {
    json!({
      "type": "object",
      "properties": {
        "content": {
          "type": "string",
          "description": "The memory content to save"
        },
        "memory_type": {
          "type": "string",
          "description": "Type: fact, preference, project, task, glossary, contact, snippet, policy, note"
        },
        "tags": {
          "type": "string",
          "description": "Comma-separated tags for the memory"
        },
        "importance": {
          "type": "number",
          "description": "Importance score 0.0-1.0 (default 0.5)"
        }
      },
      "required": ["content"]
    })
  }

  async fn call(&self, _ctx: &ToolContext, args: Value) -> Result<String> {
    let content = match args.get("content").and_then(|v| v.as_str()) {
      Some(c) if !c.trim().is_empty() => c.trim().to_string(),
      _ => return Err(crate::util::error::KadaError::Tool("content is required".to_string())),
    };

    let memory_type_str = args.get("memory_type").and_then(|v| v.as_str()).unwrap_or("note");
    let tags = args.get("tags").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let importance = args.get("importance").and_then(|v| v.as_f64()).unwrap_or(0.5);
    let now = crate::base::memory::chrono_now_pub();

    let entry = MemoryEntry {
      id: new_memory_id(),
      memory_type: MemoryType::from_str(memory_type_str),
      scope: MemoryScope::LongTerm,
      content,
      tags,
      session_id: None,
      importance,
      access_count: 0,
      deleted: false,
      created_at: now.clone(),
      accessed_at: now,
    };

    let id = self
      .store
      .upsert(&entry)
      .map_err(|e| crate::util::error::KadaError::Tool(e))?;
    Ok(format!("Memory saved with id: {id}"))
  }
}

// ── memory_forget ─────────────────────────────────────────────────────────────

pub struct MemoryForgetTool {
  store: Arc<MemoryStore>,
}

#[async_trait]
impl Tool for MemoryForgetTool {
  fn name(&self) -> &str {
    "memory_forget"
  }

  fn description(&self) -> &str {
    "Soft-delete a memory entry by its id. Use when the user asks to forget specific information."
  }

  fn parameters_schema(&self) -> Value {
    json!({
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "The id of the memory entry to delete"
        }
      },
      "required": ["id"]
    })
  }

  async fn call(&self, _ctx: &ToolContext, args: Value) -> Result<String> {
    let id = match args.get("id").and_then(|v| v.as_str()) {
      Some(id) if !id.trim().is_empty() => id.trim().to_string(),
      _ => return Err(crate::util::error::KadaError::Tool("id is required".to_string())),
    };

    let deleted = self
      .store
      .soft_delete(&id)
      .map_err(|e| crate::util::error::KadaError::Tool(e))?;
    if deleted {
      Ok(format!("Memory {id} has been forgotten."))
    } else {
      Ok(format!("No memory found with id: {id}"))
    }
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

pub fn build_memory_tools(store: Arc<MemoryStore>) -> Vec<DynTool> {
  vec![
    Arc::new(MemoryQueryTool { store: Arc::clone(&store) }),
    Arc::new(MemoryUpsertTool { store: Arc::clone(&store) }),
    Arc::new(MemoryForgetTool { store: Arc::clone(&store) }),
  ]
}
