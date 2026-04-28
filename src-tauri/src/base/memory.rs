use std::path::Path;
use std::sync::{Arc, Mutex};

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

// ── Types ──────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MemoryType {
  Fact,
  Preference,
  Project,
  Task,
  Glossary,
  Contact,
  Snippet,
  Policy,
  Note,
  SessionSummary,
}

impl MemoryType {
  pub fn as_str(&self) -> &'static str {
    match self {
      Self::Fact => "fact",
      Self::Preference => "preference",
      Self::Project => "project",
      Self::Task => "task",
      Self::Glossary => "glossary",
      Self::Contact => "contact",
      Self::Snippet => "snippet",
      Self::Policy => "policy",
      Self::Note => "note",
      Self::SessionSummary => "session_summary",
    }
  }

  pub fn from_str(s: &str) -> Self {
    match s {
      "fact" => Self::Fact,
      "preference" => Self::Preference,
      "project" => Self::Project,
      "task" => Self::Task,
      "glossary" => Self::Glossary,
      "contact" => Self::Contact,
      "snippet" => Self::Snippet,
      "policy" => Self::Policy,
      "session_summary" => Self::SessionSummary,
      _ => Self::Note,
    }
  }
}

impl std::fmt::Display for MemoryType {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    f.write_str(self.as_str())
  }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MemoryScope {
  LongTerm,
  ShortTerm,
}

impl MemoryScope {
  pub fn as_str(&self) -> &'static str {
    match self {
      Self::LongTerm => "long_term",
      Self::ShortTerm => "short_term",
    }
  }

  pub fn from_str(s: &str) -> Self {
    match s {
      "short_term" => Self::ShortTerm,
      _ => Self::LongTerm,
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
  pub id: String,
  pub memory_type: MemoryType,
  pub scope: MemoryScope,
  pub content: String,
  pub tags: String,
  pub session_id: Option<String>,
  pub importance: f64,
  pub access_count: i64,
  pub deleted: bool,
  pub created_at: String,
  pub accessed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MemoryStats {
  pub total: i64,
  pub deleted: i64,
  pub by_type: std::collections::HashMap<String, i64>,
}

// ── MemoryStore ────────────────────────────────────────────────────────────────

pub struct MemoryStore {
  conn: Arc<Mutex<Connection>>,
}

impl MemoryStore {
  pub fn open(data_dir: &Path) -> Result<Self, String> {
    let db_path = data_dir.join("memories.db");
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open DB: {e}"))?;

    conn
      .execute_batch(
        r"
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS memories (
            id           TEXT PRIMARY KEY,
            type         TEXT NOT NULL,
            scope        TEXT NOT NULL DEFAULT 'long_term',
            content      TEXT NOT NULL,
            tags         TEXT DEFAULT '',
            session_id   TEXT,
            importance   REAL DEFAULT 0.5,
            access_count INTEGER DEFAULT 0,
            deleted      INTEGER DEFAULT 0,
            created_at   TEXT NOT NULL,
            accessed_at  TEXT NOT NULL
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
            content,
            content=memories,
            content_rowid=rowid
        );

        CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
            INSERT INTO memories_fts(rowid, content) VALUES (new.rowid, new.content);
        END;

        CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
            INSERT INTO memories_fts(memories_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
        END;

        CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
            INSERT INTO memories_fts(memories_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
            INSERT INTO memories_fts(rowid, content) VALUES (new.rowid, new.content);
        END;
        ",
      )
      .map_err(|e| format!("Failed to init DB schema: {e}"))?;

    Ok(Self {
      conn: Arc::new(Mutex::new(conn)),
    })
  }

  /// FTS5 full-text search with optional filters
  pub fn search(
    &self,
    query: &str,
    scope: Option<&str>,
    memory_type: Option<&str>,
    top_k: usize,
  ) -> Result<Vec<MemoryEntry>, String> {
    let conn = self.conn.lock().unwrap();
    let query_trimmed = query.trim();

    if query_trimmed.is_empty() {
      // Return most recent non-deleted entries
      let sql = "SELECT * FROM memories WHERE deleted = 0 ORDER BY accessed_at DESC LIMIT ?1";
      let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
      let entries = stmt
        .query_map(params![top_k as i64], Self::row_to_entry)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
      return Ok(entries);
    }

    // Build FTS query safely — escape special FTS chars
    let fts_query = query_trimmed.replace('"', "\"\"");
    let fts_query = format!("\"{fts_query}\"");

    let mut conditions = vec!["m.deleted = 0".to_string()];
    if let Some(s) = scope {
      conditions.push(format!("m.scope = '{}'", s.replace('\'', "''")));
    }
    if let Some(t) = memory_type {
      conditions.push(format!("m.type = '{}'", t.replace('\'', "''")));
    }
    let where_clause = conditions.join(" AND ");

    let sql = format!(
      r"
        SELECT m.*
        FROM memories m
        JOIN memories_fts fts ON m.rowid = fts.rowid
        WHERE memories_fts MATCH ?1
          AND {where_clause}
        ORDER BY rank, m.importance DESC, m.accessed_at DESC
        LIMIT ?2
      "
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let entries = stmt
      .query_map(params![fts_query, top_k as i64], Self::row_to_entry)
      .map_err(|e| e.to_string())?
      .filter_map(|r| r.ok())
      .collect();

    Ok(entries)
  }

  pub fn upsert(&self, entry: &MemoryEntry) -> Result<String, String> {
    let conn = self.conn.lock().unwrap();
    conn
      .execute(
        r"
        INSERT INTO memories (id, type, scope, content, tags, session_id, importance, access_count, deleted, created_at, accessed_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, ?9, ?10)
        ON CONFLICT(id) DO UPDATE SET
            content = excluded.content,
            tags = excluded.tags,
            importance = excluded.importance,
            access_count = access_count + 1,
            accessed_at = excluded.accessed_at,
            deleted = 0
        ",
        params![
          entry.id,
          entry.memory_type.as_str(),
          entry.scope.as_str(),
          entry.content,
          entry.tags,
          entry.session_id,
          entry.importance,
          entry.access_count,
          entry.created_at,
          entry.accessed_at,
        ],
      )
      .map_err(|e| e.to_string())?;
    Ok(entry.id.clone())
  }

  pub fn soft_delete(&self, id: &str) -> Result<bool, String> {
    let conn = self.conn.lock().unwrap();
    let rows = conn
      .execute("UPDATE memories SET deleted = 1 WHERE id = ?1", params![id])
      .map_err(|e| e.to_string())?;
    Ok(rows > 0)
  }

  pub fn hard_delete(&self, id: &str) -> Result<bool, String> {
    let conn = self.conn.lock().unwrap();
    let rows = conn
      .execute("DELETE FROM memories WHERE id = ?1", params![id])
      .map_err(|e| e.to_string())?;
    Ok(rows > 0)
  }

  pub fn update_content(&self, id: &str, content: &str) -> Result<bool, String> {
    let now = chrono_now_pub();
    let conn = self.conn.lock().unwrap();
    let rows = conn
      .execute(
        "UPDATE memories SET content = ?1, accessed_at = ?2 WHERE id = ?3 AND deleted = 0",
        params![content, now, id],
      )
      .map_err(|e| e.to_string())?;
    Ok(rows > 0)
  }

  pub fn list(&self, query: Option<&str>, limit: usize) -> Result<Vec<MemoryEntry>, String> {
    self.search(query.unwrap_or(""), None, None, limit)
  }

  pub fn clear_all(&self) -> Result<bool, String> {
    let conn = self.conn.lock().unwrap();
    conn
      .execute("UPDATE memories SET deleted = 1", [])
      .map_err(|e| e.to_string())?;
    Ok(true)
  }

  pub fn stats(&self) -> Result<MemoryStats, String> {
    let conn = self.conn.lock().unwrap();
    let total: i64 = conn
      .query_row("SELECT COUNT(*) FROM memories WHERE deleted = 0", [], |row| row.get(0))
      .unwrap_or(0);
    let deleted: i64 = conn
      .query_row("SELECT COUNT(*) FROM memories WHERE deleted = 1", [], |row| row.get(0))
      .unwrap_or(0);
    let mut stmt = conn
      .prepare("SELECT type, COUNT(*) FROM memories WHERE deleted = 0 GROUP BY type")
      .map_err(|e| e.to_string())?;
    let by_type = stmt
      .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)))
      .map_err(|e| e.to_string())?
      .filter_map(|r| r.ok())
      .collect();
    Ok(MemoryStats { total, deleted, by_type })
  }

  fn row_to_entry(row: &rusqlite::Row<'_>) -> rusqlite::Result<MemoryEntry> {
    Ok(MemoryEntry {
      id: row.get(0)?,
      memory_type: MemoryType::from_str(&row.get::<_, String>(1)?),
      scope: MemoryScope::from_str(&row.get::<_, String>(2)?),
      content: row.get(3)?,
      tags: row.get(4)?,
      session_id: row.get(5)?,
      importance: row.get(6)?,
      access_count: row.get(7)?,
      deleted: row.get::<_, i64>(8)? != 0,
      created_at: row.get(9)?,
      accessed_at: row.get(10)?,
    })
  }
}

pub fn chrono_now_pub() -> String {
  use std::time::{SystemTime, UNIX_EPOCH};
  let secs = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap_or_default()
    .as_secs();
  // ISO-8601 approximation without external chrono dep
  let secs_i = secs as i64;
  let days = secs_i / 86400;
  let time = secs_i % 86400;
  let h = time / 3600;
  let m = (time % 3600) / 60;
  let s = time % 60;
  // Compute date from days since epoch (simple algo)
  let (year, month, day) = days_to_ymd(days);
  format!("{year:04}-{month:02}-{day:02}T{h:02}:{m:02}:{s:02}Z")
}

fn days_to_ymd(days: i64) -> (i64, i64, i64) {
  // Algorithm from http://howardhinnant.github.io/date_algorithms.html
  let z = days + 719468;
  let era = if z >= 0 { z } else { z - 146096 } / 146097;
  let doe = z - era * 146097;
  let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
  let y = yoe + era * 400;
  let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
  let mp = (5 * doy + 2) / 153;
  let d = doy - (153 * mp + 2) / 5 + 1;
  let m = if mp < 10 { mp + 3 } else { mp - 9 };
  let y = if m <= 2 { y + 1 } else { y };
  (y, m, d)
}

pub fn new_memory_id() -> String {
  use std::time::{SystemTime, UNIX_EPOCH};
  let ns = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap_or_default()
    .subsec_nanos();
  let t = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap_or_default()
    .as_millis();
  format!("mem-{t:x}-{ns:08x}")
}
