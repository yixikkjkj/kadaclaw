use serde::Deserialize;

use crate::base::memory::{chrono_now_pub, new_memory_id};
use crate::base::providers::{ChatMessage, Provider};

use super::types::{PlanStatus, StepStatus, TaskPlan, TaskStep};

const PLANNER_SYSTEM: &str = r#"You are a planning assistant. Break down complex tasks into ordered, executable steps.
Return ONLY a JSON object (no markdown, no code fences) with this exact structure:
{
  "title": "Brief task title",
  "steps": [
    {"description": "Step description", "requires_approval": false}
  ]
}
Rules:
- Mark requires_approval=true for irreversible operations (delete, send, publish, modify shared data, payment)
- Keep steps concrete, independently verifiable, and actionable
- Maximum 10 steps
- No extra text or explanation outside the JSON"#;

#[derive(Deserialize)]
struct PlannerStep {
  description: String,
  #[serde(default)]
  requires_approval: bool,
}

#[derive(Deserialize)]
struct PlannerResponse {
  title: String,
  steps: Vec<PlannerStep>,
}

/// Generate a TaskPlan from a natural language task description using the LLM.
pub async fn generate_plan(provider: &dyn Provider, task: &str) -> Result<TaskPlan, String> {
  let messages = vec![
    ChatMessage::system(PLANNER_SYSTEM),
    ChatMessage::user(format!("Task: {task}")),
  ];

  let response = provider.chat(&messages, &[]).await.map_err(|e| e.to_string())?;

  let raw = response.content.unwrap_or_default();
  let json_str = extract_json(&raw);

  let parsed: PlannerResponse =
    serde_json::from_str(json_str).map_err(|e| format!("Failed to parse plan JSON: {e}\nRaw response: {json_str}"))?;

  let now = chrono_now_pub();
  let plan_id = new_memory_id().replace("mem-", "plan-");

  let steps = parsed
    .steps
    .into_iter()
    .enumerate()
    .map(|(i, s)| TaskStep {
      id: new_memory_id().replace("mem-", "step-"),
      index: i,
      description: s.description,
      status: StepStatus::Pending,
      output: None,
      error: None,
      started_at: None,
      completed_at: None,
      requires_approval: s.requires_approval,
    })
    .collect();

  Ok(TaskPlan {
    id: plan_id,
    title: parsed.title,
    created_at: now,
    status: PlanStatus::Running,
    steps,
    result_summary: None,
  })
}

fn extract_json(raw: &str) -> &str {
  let trimmed = raw.trim();
  if let Some(start) = trimmed.find('{') {
    if let Some(end) = trimmed.rfind('}') {
      if end >= start {
        return &trimmed[start..=end];
      }
    }
  }
  trimmed
}
