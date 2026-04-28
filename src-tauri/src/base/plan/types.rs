use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PlanStatus {
  Planning,
  Running,
  Paused,
  Completed,
  Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum StepStatus {
  Pending,
  Running,
  Completed,
  Failed,
  Skipped,
  AwaitingApproval,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskStep {
  pub id: String,
  pub index: usize,
  pub description: String,
  pub status: StepStatus,
  pub output: Option<String>,
  pub error: Option<String>,
  pub started_at: Option<String>,
  pub completed_at: Option<String>,
  pub requires_approval: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskPlan {
  pub id: String,
  pub title: String,
  pub created_at: String,
  pub status: PlanStatus,
  pub steps: Vec<TaskStep>,
  pub result_summary: Option<String>,
}
