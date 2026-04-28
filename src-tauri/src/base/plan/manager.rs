use std::collections::HashMap;
use std::path::{Path, PathBuf};

use super::types::{PlanStatus, StepStatus, TaskPlan};

pub struct PlanManager {
  data_dir: PathBuf,
  pub plans: HashMap<String, TaskPlan>,
}

impl PlanManager {
  pub fn new(data_dir: &Path) -> Self {
    let mut mgr = Self {
      data_dir: data_dir.join("plans"),
      plans: HashMap::new(),
    };
    mgr.load_all();
    mgr
  }

  fn load_all(&mut self) {
    std::fs::create_dir_all(&self.data_dir).ok();
    if let Ok(entries) = std::fs::read_dir(&self.data_dir) {
      for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("json") {
          if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(plan) = serde_json::from_str::<TaskPlan>(&content) {
              self.plans.insert(plan.id.clone(), plan);
            }
          }
        }
      }
    }
  }

  fn save_plan(&self, plan: &TaskPlan) -> Result<(), String> {
    std::fs::create_dir_all(&self.data_dir).map_err(|e| e.to_string())?;
    let path = self.data_dir.join(format!("{}.json", plan.id));
    let content = serde_json::to_string_pretty(plan).map_err(|e| e.to_string())?;
    std::fs::write(path, content).map_err(|e| e.to_string())
  }

  /// Save plan by id (useful when caller already has a mutable reference to the plan map).
  pub fn save_plan_direct(&self, plan_id: &str) -> Result<(), String> {
    let plan = self
      .plans
      .get(plan_id)
      .ok_or_else(|| format!("Plan not found: {plan_id}"))?;
    self.save_plan(plan)
  }

  pub fn insert(&mut self, plan: TaskPlan) -> Result<(), String> {
    self.save_plan(&plan)?;
    self.plans.insert(plan.id.clone(), plan);
    Ok(())
  }

  pub fn get(&self, id: &str) -> Option<&TaskPlan> {
    self.plans.get(id)
  }

  pub fn list(&self) -> Vec<TaskPlan> {
    let mut plans: Vec<_> = self.plans.values().cloned().collect();
    plans.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    plans
  }

  pub fn update_step_status(&mut self, plan_id: &str, step_id: &str, status: StepStatus) -> Result<(), String> {
    {
      let plan = self
        .plans
        .get_mut(plan_id)
        .ok_or_else(|| format!("Plan not found: {plan_id}"))?;
      let step = plan
        .steps
        .iter_mut()
        .find(|s| s.id == step_id)
        .ok_or_else(|| format!("Step not found: {step_id}"))?;
      step.status = status;
    }
    self.save_plan_direct(plan_id)
  }

  pub fn update_step_output(
    &mut self,
    plan_id: &str,
    step_id: &str,
    output: String,
    status: StepStatus,
    completed_at: String,
  ) -> Result<(), String> {
    {
      let plan = self
        .plans
        .get_mut(plan_id)
        .ok_or_else(|| format!("Plan not found: {plan_id}"))?;
      let step = plan
        .steps
        .iter_mut()
        .find(|s| s.id == step_id)
        .ok_or_else(|| format!("Step not found: {step_id}"))?;
      step.output = Some(output);
      step.status = status;
      step.completed_at = Some(completed_at);
    }
    self.save_plan_direct(plan_id)
  }

  pub fn update_plan_status(&mut self, plan_id: &str, status: PlanStatus) -> Result<(), String> {
    {
      let plan = self
        .plans
        .get_mut(plan_id)
        .ok_or_else(|| format!("Plan not found: {plan_id}"))?;
      plan.status = status;
    }
    self.save_plan_direct(plan_id)
  }

  pub fn set_result_summary(&mut self, plan_id: &str, summary: String) -> Result<(), String> {
    {
      let plan = self
        .plans
        .get_mut(plan_id)
        .ok_or_else(|| format!("Plan not found: {plan_id}"))?;
      plan.result_summary = Some(summary);
    }
    self.save_plan_direct(plan_id)
  }
}
