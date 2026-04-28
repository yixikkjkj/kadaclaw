use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use tauri::ipc::Channel;

use crate::base::agent::{AgentRuntime, AgentStreamEvent, ConversationContext};
use crate::base::providers::Provider;
use crate::base::tools::{DynTool, ToolContext};

use super::types::{TaskPlan, TaskStep};

/// Execute a single plan step using an isolated AgentRuntime session.
/// Returns the text output produced by the agent.
pub async fn execute_step(
  plan: &TaskPlan,
  step: &TaskStep,
  provider: Arc<dyn Provider>,
  tools: Vec<DynTool>,
  tool_ctx: ToolContext,
  channel: Channel<AgentStreamEvent>,
  max_tool_rounds: u32,
  token_budget: usize,
  compact_threshold: f64,
) -> Result<String, String> {
  // Build context summary from previously completed steps
  let prev_context: String = plan.steps[..step.index]
    .iter()
    .filter(|s| s.output.is_some())
    .map(|s| format!("### Step {}: {}\n{}", s.index + 1, s.description, s.output.as_deref().unwrap_or("(no output)")))
    .collect::<Vec<_>>()
    .join("\n\n");

  let system_prompt = if prev_context.is_empty() {
    format!(
      "You are executing step {} of {} in a task plan.\nOverall task: {}\n\nComplete this specific step and provide a clear result.",
      step.index + 1,
      plan.steps.len(),
      plan.title
    )
  } else {
    format!(
      "You are executing step {} of {} in a task plan.\nOverall task: {}\n\n# Context from previous steps\n\n{}\n\nNow complete step {} and provide a clear result.",
      step.index + 1,
      plan.steps.len(),
      plan.title,
      prev_context,
      step.index + 1,
    )
  };

  let runtime =
    AgentRuntime::new(provider, tools, tool_ctx, system_prompt, max_tool_rounds, token_budget, compact_threshold);

  let stop_flag = Arc::new(AtomicBool::new(false));
  let mut ctx = ConversationContext::new(format!("plan-step-{}", step.id));

  runtime.run(&mut ctx, &step.description, channel, stop_flag).await;

  // Extract final assistant message as output
  let output = ctx
    .messages
    .iter()
    .rev()
    .find(|m| m.role == "assistant")
    .and_then(|m| m.content.as_ref())
    .and_then(|c| c.as_str())
    .filter(|s| !s.is_empty())
    .unwrap_or("(step completed)")
    .to_string();

  Ok(output)
}
