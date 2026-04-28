import { useCallback, useEffect, useState } from "react";
import { App, Button, Input, Spin, Typography } from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { TaskPlanView } from "~/components";
import type { TaskPlan } from "~/api/plan";
import { useTaskStore } from "~/store";
import styles from "./index.css";

const { Text } = Typography;

export const TasksPage = () => {
  const { message } = App.useApp();
  const plans = useTaskStore((s) => s.plans);
  const executing = useTaskStore((s) => s.executing);
  const executingStepId = useTaskStore((s) => s.executingStepId);
  const streamingText = useTaskStore((s) => s.streamingText);
  const loadPlans = useTaskStore((s) => s.loadPlans);
  const createTaskPlan = useTaskStore((s) => s.createTaskPlan);
  const executeStep = useTaskStore((s) => s.executeStep);
  const approveStep = useTaskStore((s) => s.approveStep);
  const skipStep = useTaskStore((s) => s.skipStep);

  const [taskInput, setTaskInput] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const handleCreate = async () => {
    if (!taskInput.trim()) return;
    setCreating(true);
    try {
      await createTaskPlan(taskInput.trim());
      setTaskInput("");
    } catch (e) {
      void message.error(`创建计划失败: ${String(e)}`);
    } finally {
      setCreating(false);
    }
  };

  const handleExecuteStep = useCallback(
    (planId: string) => async (stepId: string) => {
      try {
        await executeStep(planId, stepId);
      } catch (e) {
        void message.error(`执行步骤失败: ${String(e)}`);
      }
    },
    [executeStep, message],
  );

  const handleApproveStep = useCallback(
    (planId: string) => async (stepId: string) => {
      await approveStep(planId, stepId);
    },
    [approveStep],
  );

  const handleSkipStep = useCallback(
    (planId: string) => async (stepId: string) => {
      await skipStep(planId, stepId);
    },
    [skipStep],
  );

  const handleExecuteNext = useCallback(
    (plan: TaskPlan) => async () => {
      const nextStep = plan.steps.find(
        (s) => s.status === "pending" || s.status === "failed",
      );
      if (nextStep) {
        try {
          await executeStep(plan.id, nextStep.id);
        } catch (e) {
          void message.error(`执行步骤失败: ${String(e)}`);
        }
      }
    },
    [executeStep, message],
  );

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <Text className={styles.title}>计划任务</Text>
        <Button
          icon={<ReloadOutlined />}
          size="small"
          onClick={() => loadPlans()}
        >
          刷新
        </Button>
      </div>

      <div className={styles.newPlanArea}>
        <div className={styles.newPlanRow}>
          <Input
            placeholder="描述一个复杂任务，AI 将为您制定执行计划..."
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            onPressEnter={handleCreate}
            disabled={creating}
          />
          <Button
            type="primary"
            icon={creating ? <Spin size="small" /> : <PlusOutlined />}
            onClick={handleCreate}
            disabled={creating || !taskInput.trim()}
          >
            创建计划
          </Button>
        </div>
      </div>

      <div className={styles.planList}>
        {plans.length === 0 ? (
          <div className={styles.emptyState}>
            <Text type="secondary">暂无任务计划</Text>
          </div>
        ) : (
          plans.map((plan) => (
            <TaskPlanView
              key={plan.id}
              plan={plan}
              isExecuting={executing}
              executingStepId={executingStepId}
              streamingText={streamingText}
              onExecuteStep={handleExecuteStep(plan.id)}
              onApproveStep={handleApproveStep(plan.id)}
              onSkipStep={handleSkipStep(plan.id)}
              onExecuteNext={handleExecuteNext(plan)}
            />
          ))
        )}
      </div>
    </div>
  );
};
