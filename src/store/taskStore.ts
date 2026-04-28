import { create } from "zustand";
import type { AgentStreamEvent } from "~/api/agent";
import {
  approvePlanStep,
  createPlan,
  executePlanStep,
  getPlan,
  listPlans,
  skipPlanStep,
  type TaskPlan,
  type StepStatus,
} from "~/api/plan";

interface TaskState {
  plans: TaskPlan[];
  activePlanId: string | null;
  executing: boolean;
  executingStepId: string | null;
  streamingText: string;

  loadPlans: () => Promise<void>;
  createTaskPlan: (task: string) => Promise<TaskPlan>;
  executeStep: (
    planId: string,
    stepId: string,
    onEvent?: (event: AgentStreamEvent) => void,
  ) => Promise<void>;
  approveStep: (planId: string, stepId: string) => Promise<void>;
  skipStep: (planId: string, stepId: string) => Promise<void>;
  setActivePlan: (planId: string | null) => void;
  refreshPlan: (planId: string) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  plans: [],
  activePlanId: null,
  executing: false,
  executingStepId: null,
  streamingText: "",

  loadPlans: async () => {
    const plans = await listPlans();
    set({ plans });
  },

  createTaskPlan: async (task: string) => {
    const plan = await createPlan(task);
    set((state) => ({
      plans: [plan, ...state.plans.filter((p) => p.id !== plan.id)],
      activePlanId: plan.id,
    }));
    return plan;
  },

  executeStep: async (planId, stepId, onEvent) => {
    set({ executing: true, executingStepId: stepId, streamingText: "" });

    // Optimistically mark step as running
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id !== planId
          ? p
          : {
              ...p,
              steps: p.steps.map((s) =>
                s.id === stepId ? { ...s, status: "running" as StepStatus } : s,
              ),
            },
      ),
    }));

    try {
      await executePlanStep(planId, stepId, (event) => {
        if (event.type === "text_delta") {
          set((state) => ({
            streamingText: state.streamingText + event.delta,
          }));
        }
        onEvent?.(event);
      });
    } finally {
      set({ executing: false, executingStepId: null, streamingText: "" });
      // Refresh plan from backend to get accurate status
      await get().refreshPlan(planId);
    }
  },

  approveStep: async (planId, stepId) => {
    await approvePlanStep(planId, stepId);
    await get().refreshPlan(planId);
  },

  skipStep: async (planId, stepId) => {
    await skipPlanStep(planId, stepId);
    await get().refreshPlan(planId);
  },

  setActivePlan: (planId) => {
    set({ activePlanId: planId });
  },

  refreshPlan: async (planId) => {
    const updated = await getPlan(planId);
    if (updated) {
      set((state) => ({
        plans: state.plans.map((p) => (p.id === planId ? updated : p)),
      }));
    }
  },
}));
