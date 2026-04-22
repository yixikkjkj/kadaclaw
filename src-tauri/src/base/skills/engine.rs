use rhai::{Engine, EvalAltResult, Scope};
use serde_json::Value;
use std::sync::Arc;

use crate::util::error::{KadaError, Result};

/// Rhai-based skill execution engine.
/// Provides a sandboxed scripting environment for skills.
pub struct RhaiEngine {
  engine: Arc<Engine>,
}

impl RhaiEngine {
  pub fn new() -> Self {
    let mut engine = Engine::new();

    // Safety limits
    engine.set_max_operations(100_000);
    engine.set_max_string_size(1_000_000); // 1MB max string
    engine.set_max_array_size(100_000);
    engine.set_max_map_size(100_000);
    engine.set_max_call_levels(50);

    // Disable file I/O (use our fs tools instead)
    engine.disable_symbol("include_str");

    Self { engine: Arc::new(engine) }
  }

  /// Execute a Rhai script with the given input JSON value.
  /// The script receives `input` (Value) and should return a string.
  pub fn execute_script(&self, script: &str, input: Value) -> Result<String> {
    let mut scope = Scope::new();
    scope.push_constant("INPUT", serde_json::to_string(&input).unwrap_or_default());

    let result = self.engine.eval_with_scope::<rhai::Dynamic>(&mut scope, script);

    match result {
      Ok(val) => Ok(val.to_string()),
      Err(err) => {
        let msg = match *err {
          EvalAltResult::ErrorRuntime(msg, _) => format!("Runtime error: {msg}"),
          EvalAltResult::ErrorTooManyOperations(_) => "Script exceeded operation limit (100k ops)".to_string(),
          EvalAltResult::ErrorFunctionNotFound(name, _) => {
            format!("Function not found: {name}")
          },
          other => format!("Script error: {other}"),
        };
        Err(KadaError::Skill(msg))
      },
    }
  }

  /// Validate a Rhai script without executing it (syntax check).
  pub fn validate_script(&self, script: &str) -> Result<()> {
    self
      .engine
      .compile(script)
      .map(|_| ())
      .map_err(|e| KadaError::Skill(format!("Syntax error: {e}")))
  }
}

impl Default for RhaiEngine {
  fn default() -> Self {
    Self::new()
  }
}
