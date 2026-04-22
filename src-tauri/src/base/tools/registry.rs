use std::collections::HashMap;
use std::sync::Arc;

use super::{
  browser::BrowseTool,
  exec::ExecTool,
  fs::{EditFileTool, ListDirTool, ReadFileTool, WriteFileTool},
  web::{WebFetchTool, WebSearchTool},
  DynTool, Tool,
};

/// Central registry for all available tools.
pub struct ToolRegistry {
  tools: HashMap<String, DynTool>,
}

impl ToolRegistry {
  /// Build a registry with all built-in tools registered.
  pub fn new() -> Self {
    let mut reg = Self { tools: HashMap::new() };

    reg.register(ReadFileTool);
    reg.register(WriteFileTool);
    reg.register(EditFileTool);
    reg.register(ListDirTool);
    reg.register(ExecTool);
    reg.register(WebFetchTool::new());
    reg.register(WebSearchTool::new());
    reg.register(BrowseTool::new());

    reg
  }

  pub fn register<T: Tool + 'static>(&mut self, tool: T) {
    self.tools.insert(tool.name().to_string(), Arc::new(tool));
  }

  #[allow(dead_code)]
  pub fn register_arc(&mut self, tool: DynTool) {
    self.tools.insert(tool.name().to_string(), tool);
  }

  #[allow(dead_code)]
  pub fn get(&self, name: &str) -> Option<&DynTool> {
    self.tools.get(name)
  }

  pub fn all(&self) -> Vec<&DynTool> {
    self.tools.values().collect()
  }

  /// Get tools filtered by allowed list (None = all tools).
  pub fn get_tools_for_session(&self, allowed: Option<&[String]>) -> Vec<DynTool> {
    match allowed {
      None => self.tools.values().cloned().collect(),
      Some(names) => names.iter().filter_map(|n| self.tools.get(n).cloned()).collect(),
    }
  }

  #[allow(dead_code)]
  pub fn names(&self) -> Vec<String> {
    self.tools.keys().cloned().collect()
  }
}

impl Default for ToolRegistry {
  fn default() -> Self {
    Self::new()
  }
}
