use std::sync::Arc;

use tauri::ipc::Channel;
use tauri::{AppHandle, Manager};
use tokio::sync::Mutex;

use crate::base::agent::AgentStreamEvent;
use crate::base::config::read_agent_config;
use crate::base::memory::{chrono_now_pub, MemoryStore};
use crate::base::plan::executor::execute_step;
use crate::base::plan::planner::generate_plan;
use crate::base::plan::types::{PlanStatus, StepStatus};
use crate::base::plan::{PlanManager, TaskPlan};
use crate::base::providers::factory::create_provider;
use crate::base::tools::mcp::manager::McpManager;
use crate::base::tools::memory::build_memory_tools;
use crate::base::tools::{ToolContext, ToolRegistry};

pub type PlanManagerState = Arc<Mutex<PlanManager>>;

/// Create a task plan from a natural language description.
#[tauri::command]
pub async fn create_plan(
  app: AppHandle,
  plan_manager: tauri::State<'_, PlanManagerState>,
  task: String,
) -> Result<TaskPlan, String> {
  let task = task.trim().to_string();
  if task.is_empty() {
    return Err("任务描述不能为空".to_string());
  }

  let config = read_agent_config(&app)?;
  let provider = create_provider(&config).map_err(|e| e.to_string())?;

  let plan = generate_plan(provider.as_ref(), &task).await?;

  plan_manager.lock().await.insert(plan.clone())?;

  Ok(plan)
}

/// Execute a specific step of a plan.
#[tauri::command]
pub async fn execute_plan_step(
  app: AppHandle,
  plan_manager: tauri::State<'_, PlanManagerState>,
  plan_id: String,
  step_id: String,
  channel: Channel<AgentStreamEvent>,
) -> Result<(), String> {
  // Clone plan data needed for execution (release lock before await)
  let (plan_snapshot, step_index) = {
    let mgr = plan_manager.lock().await;
    let plan = mgr.get(&plan_id).ok_or_else(|| format!("Plan not found: {plan_id}"))?;
    let step_index = plan
      .steps
      .iter()
      .position(|s| s.id == step_id)
      .ok_or_else(|| format!("Step not found: {step_id}"))?;
    // Verify step is executable
    let step = &plan.steps[step_index];
    match step.status {
      StepStatus::Pending => {},
      StepStatus::Failed => {}, // allow retry
      StepStatus::AwaitingApproval => return Err("此步骤正在等待审批，请先批准后再执行".to_string()),
      StepStatus::Skipped => return Err("此步骤已跳过".to_string()),
      StepStatus::Completed => return Err("此步骤已完成".to_string()),
      StepStatus::Running => return Err("此步骤正在运行中".to_string()),
    }
    (plan.clone(), step_index)
  };

  // Mark step as running
  {
    let mut mgr = plan_manager.lock().await;
    mgr.update_step_status(&plan_id, &step_id, StepStatus::Running)?;
  }

  // Build tools
  let config = read_agent_config(&app).map_err(|e| e.to_string())?;
  let provider = create_provider(&config).map_err(|e| e.to_string())?;

  let data_dir = app
    .path()
    .app_data_dir()
    .map_err(|e| format!("Cannot get app data dir: {e}"))?;
  let work_dir = data_dir.join("workspace");

  let tool_ctx = ToolContext {
    work_dir: work_dir.clone(),
    data_dir: data_dir.clone(),
    web_search_provider: config.web_search.provider.clone(),
    tavily_api_key: config.web_search.tavily_api_key.clone(),
    cdp_port: config.browser.cdp_port,
    chrome_executable: config.browser.chrome_executable.clone(),
  };

  let registry = ToolRegistry::new();
  let mut tools = if config.enabled_tools.is_empty() {
    registry.all().into_iter().cloned().collect::<Vec<_>>()
  } else {
    registry.get_tools_for_session(Some(&config.enabled_tools))
  };

  let mcp_manager = app.state::<Arc<Mutex<McpManager>>>();
  let mcp_tools = mcp_manager.lock().await.all_tools().await;
  tools.extend(mcp_tools);

  if let Ok(mem) = MemoryStore::open(&data_dir) {
    tools.extend(build_memory_tools(Arc::new(mem)));
  }

  // Execute the step
  let step = &plan_snapshot.steps[step_index];
  let result = execute_step(
    &plan_snapshot,
    step,
    provider,
    tools,
    tool_ctx,
    channel,
    config.max_tool_rounds,
    config.token_budget,
    config.compact_threshold,
  )
  .await;

  // Update step status based on execution result
  let now = chrono_now_pub();
  match result {
    Ok(output) => {
      let mut mgr = plan_manager.lock().await;
      mgr.update_step_output(&plan_id, &step_id, output, StepStatus::Completed, now)?;

      // Collect completion info while holding immutable borrow
      let completion_info = mgr.get(&plan_id).map(|plan| {
        let all_done = plan
          .steps
          .iter()
          .all(|s| matches!(s.status, StepStatus::Completed | StepStatus::Skipped));
        let summary = plan
          .steps
          .iter()
          .filter_map(|s| s.output.as_deref())
          .last()
          .unwrap_or("所有步骤已完成")
          .to_string();
        (all_done, summary)
      });

      // Now apply mutations (immutable borrow released)
      if let Some((true, summary)) = completion_info {
        mgr.update_plan_status(&plan_id, PlanStatus::Completed)?;
        mgr.set_result_summary(&plan_id, summary)?;
      }
      Ok(())
    },
    Err(e) => {
      let mut mgr = plan_manager.lock().await;
      {
        let plan = mgr
          .plans
          .get_mut(&plan_id)
          .ok_or_else(|| format!("Plan not found after execution: {plan_id}"))?;
        if let Some(step) = plan.steps.iter_mut().find(|s| s.id == step_id) {
          step.status = StepStatus::Failed;
          step.error = Some(e.clone());
          step.completed_at = Some(now);
        }
        plan.status = PlanStatus::Paused;
      }
      mgr.save_plan_direct(&plan_id)?;
      Err(e)
    },
  }
}

/// Approve a step that requires human approval, allowing it to be executed.
#[tauri::command]
pub async fn approve_plan_step(
  plan_manager: tauri::State<'_, PlanManagerState>,
  plan_id: String,
  step_id: String,
) -> Result<bool, String> {
  let mut mgr = plan_manager.lock().await;
  let plan = mgr.get(&plan_id).ok_or_else(|| format!("Plan not found: {plan_id}"))?;
  let current_status = plan
    .steps
    .iter()
    .find(|s| s.id == step_id)
    .map(|s| s.status.clone())
    .ok_or_else(|| format!("Step not found: {step_id}"))?;

  if current_status == StepStatus::AwaitingApproval {
    mgr.update_step_status(&plan_id, &step_id, StepStatus::Pending)?;
    Ok(true)
  } else {
    Ok(false)
  }
}

/// Skip a pending step.
#[tauri::command]
pub async fn skip_plan_step(
  plan_manager: tauri::State<'_, PlanManagerState>,
  plan_id: String,
  step_id: String,
) -> Result<bool, String> {
  let mut mgr = plan_manager.lock().await;
  mgr.update_step_status(&plan_id, &step_id, StepStatus::Skipped)?;
  Ok(true)
}

/// List all plans.
#[tauri::command]
pub async fn list_plans(plan_manager: tauri::State<'_, PlanManagerState>) -> Result<Vec<TaskPlan>, String> {
  Ok(plan_manager.lock().await.list())
}

/// Get a single plan by ID.
#[tauri::command]
pub async fn get_plan(
  plan_manager: tauri::State<'_, PlanManagerState>,
  plan_id: String,
) -> Result<Option<TaskPlan>, String> {
  Ok(plan_manager.lock().await.get(&plan_id).cloned())
}
