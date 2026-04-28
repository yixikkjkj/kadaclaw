import { Channel, invoke } from "@tauri-apps/api/core";
import type { AgentStreamEvent } from "./agent";

export type PlanStatus =
  | "planning"
  | "running"
  | "paused"
  | "completed"
  | "failed";

export type StepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "awaiting_approval";

export interface TaskStep {
  id: string;
  index: number;
  description: string;
  status: StepStatus;
  output: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  requires_approval: boolean;
}

export interface TaskPlan {
  id: string;
  title: string;
  created_at: string;
  status: PlanStatus;
  steps: TaskStep[];
  result_summary: string | null;
}

export function createPlan(task: string) {
  return invoke<TaskPlan>("create_plan", { task });
}

export function executePlanStep(
  planId: string,
  stepId: string,
  onEvent: (event: AgentStreamEvent) => void,
): Promise<void> {
  const channel = new Channel<AgentStreamEvent>();
  channel.onmessage = onEvent;
  return invoke<void>("execute_plan_step", { planId, stepId, channel });
}

export function approvePlanStep(planId: string, stepId: string) {
  return invoke<boolean>("approve_plan_step", { planId, stepId });
}

export function skipPlanStep(planId: string, stepId: string) {
  return invoke<boolean>("skip_plan_step", { planId, stepId });
}

export function listPlans() {
  return invoke<TaskPlan[]>("list_plans");
}

export function getPlan(planId: string) {
  return invoke<TaskPlan | null>("get_plan", { planId });
}
