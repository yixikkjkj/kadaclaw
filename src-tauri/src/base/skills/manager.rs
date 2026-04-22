use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use crate::base::models::SkillManifest;
use crate::util::error::{KadaError, Result};

use super::engine::RhaiEngine;

/// A loaded skill ready for execution.
#[derive(Clone, Debug)]
pub struct LoadedSkill {
  pub id: String,
  pub manifest: SkillManifest,
  pub dir: PathBuf,
  /// Primary script source (if any)
  pub script_source: Option<String>,
  pub enabled: bool,
}

pub struct SkillManager {
  skills: Mutex<HashMap<String, LoadedSkill>>,
  engine: Arc<RhaiEngine>,
}

impl SkillManager {
  pub fn new() -> Self {
    Self {
      skills: Mutex::new(HashMap::new()),
      engine: Arc::new(RhaiEngine::new()),
    }
  }

  /// Scan a directory for skills (each subdirectory with a skill.json / SKILL.md).
  pub fn load_from_dir(&self, skills_dir: &Path) {
    if !skills_dir.is_dir() {
      return;
    }

    let read = match std::fs::read_dir(skills_dir) {
      Ok(r) => r,
      Err(e) => {
        tracing::warn!("Cannot read skills dir {:?}: {e}", skills_dir);
        return;
      },
    };

    for entry in read.flatten() {
      let path = entry.path();
      if !path.is_dir() {
        continue;
      }

      // Try skill.json manifest
      let manifest_path = path.join("skill.json");
      if !manifest_path.exists() {
        continue;
      }

      let manifest: SkillManifest = match std::fs::read_to_string(&manifest_path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
      {
        Some(m) => m,
        None => {
          tracing::warn!("Invalid skill manifest: {:?}", manifest_path);
          continue;
        },
      };

      let id = manifest.id.clone();

      // Load primary script if present (entry field points to the main script/doc file)
      let script_source = {
        let script_path = path.join(&manifest.entry);
        std::fs::read_to_string(&script_path).ok()
      };

      let skill = LoadedSkill {
        id: id.clone(),
        manifest,
        dir: path,
        script_source,
        enabled: true,
      };

      let mut skills = self.skills.lock().unwrap();
      skills.insert(id, skill);
    }
  }

  pub fn list(&self) -> Vec<LoadedSkill> {
    self.skills.lock().unwrap().values().cloned().collect()
  }

  pub fn get(&self, id: &str) -> Option<LoadedSkill> {
    self.skills.lock().unwrap().get(id).cloned()
  }

  pub fn set_enabled(&self, id: &str, enabled: bool) -> Result<()> {
    let mut skills = self.skills.lock().unwrap();
    let skill = skills
      .get_mut(id)
      .ok_or_else(|| KadaError::NotFound(format!("Skill not found: {id}")))?;
    skill.enabled = enabled;
    Ok(())
  }

  pub fn remove(&self, id: &str) -> Result<()> {
    let mut skills = self.skills.lock().unwrap();
    if skills.remove(id).is_none() {
      return Err(KadaError::NotFound(format!("Skill not found: {id}")));
    }
    Ok(())
  }

  /// Execute a skill's Rhai script with the given input.
  pub fn execute_skill(&self, id: &str, input: Value) -> Result<String> {
    let skill = self
      .get(id)
      .ok_or_else(|| KadaError::NotFound(format!("Skill not found: {id}")))?;

    if !skill.enabled {
      return Err(KadaError::Skill(format!("Skill '{}' is disabled", id)));
    }

    let script = skill
      .script_source
      .as_ref()
      .ok_or_else(|| KadaError::Skill(format!("Skill '{}' has no runnable script", id)))?;

    self.engine.execute_script(script, input)
  }
}

impl Default for SkillManager {
  fn default() -> Self {
    Self::new()
  }
}
