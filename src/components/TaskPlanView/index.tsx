import { Button, Spin, Tag, Tooltip, Typography } from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  LoadingOutlined,
  MinusCircleOutlined,
  ExclamationCircleOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import type { TaskPlan, TaskStep, StepStatus } from "~/api/plan";
import styles from "./index.css";

const { Text } = Typography;

const STEP_ICONS: Record<StepStatus, React.ReactNode> = {
  pending: (
    <ClockCircleOutlined
      style={{ color: "var(--ant-color-text-quaternary)" }}
    />
  ),
  running: (
    <LoadingOutlined style={{ color: "var(--ant-color-primary)" }} spin />
  ),
  completed: (
    <CheckCircleOutlined style={{ color: "var(--ant-color-success)" }} />
  ),
  failed: <CloseCircleOutlined style={{ color: "var(--ant-color-error)" }} />,
  skipped: (
    <MinusCircleOutlined
      style={{ color: "var(--ant-color-text-quaternary)" }}
    />
  ),
  awaiting_approval: (
    <ExclamationCircleOutlined style={{ color: "var(--ant-color-warning)" }} />
  ),
};

const STATUS_CLASS: Record<StepStatus, string | undefined> = {
  pending: undefined,
  running: styles.stepRunning,
  completed: styles.stepCompleted,
  failed: styles.stepFailed,
  skipped: styles.stepSkipped,
  awaiting_approval: undefined,
};

const PLAN_STATUS_COLOR: Record<string, string> = {
  planning: "processing",
  running: "processing",
  paused: "warning",
  completed: "success",
  failed: "error",
};

interface StepRowProps {
  step: TaskStep;
  isExecuting: boolean;
  executingStepId: string | null;
  streamingText: string;
  onExecute: (stepId: string) => void;
  onApprove: (stepId: string) => void;
  onSkip: (stepId: string) => void;
}

const StepRow = ({
  step,
  isExecuting,
  executingStepId,
  streamingText,
  onExecute,
  onApprove,
  onSkip,
}: StepRowProps) => {
  const stepClass = [styles.step, STATUS_CLASS[step.status]]
    .filter(Boolean)
    .join(" ");
  const isThisRunning = executingStepId === step.id;

  return (
    <div className={stepClass}>
      <span className={styles.stepIcon}>{STEP_ICONS[step.status]}</span>
      <div className={styles.stepBody}>
        <div className={styles.stepDesc}>
          {step.index + 1}. {step.description}
          {step.requires_approval && (
            <Tag color="orange" style={{ marginLeft: 6, fontSize: 10 }}>
              需审批
            </Tag>
          )}
        </div>
        {isThisRunning && streamingText && (
          <div className={styles.streamingText}>{streamingText}</div>
        )}
        {step.output && !isThisRunning && (
          <div className={styles.stepOutput}>{step.output}</div>
        )}
        {step.error && (
          <div className={styles.stepError}>错误: {step.error}</div>
        )}
      </div>
      <div className={styles.stepActions}>
        {step.status === "awaiting_approval" && (
          <>
            <Tooltip title="批准并执行">
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => onApprove(step.id)}
                disabled={isExecuting}
              />
            </Tooltip>
            <Tooltip title="跳过">
              <Button
                size="small"
                icon={<MinusCircleOutlined />}
                onClick={() => onSkip(step.id)}
                disabled={isExecuting}
              />
            </Tooltip>
          </>
        )}
        {(step.status === "pending" || step.status === "failed") && (
          <>
            <Tooltip title={step.status === "failed" ? "重试" : "执行此步骤"}>
              <Button
                size="small"
                icon={
                  isThisRunning ? <LoadingOutlined /> : <PlayCircleOutlined />
                }
                onClick={() => onExecute(step.id)}
                disabled={isExecuting}
                loading={isThisRunning}
              />
            </Tooltip>
            <Tooltip title="跳过">
              <Button
                size="small"
                icon={<MinusCircleOutlined />}
                onClick={() => onSkip(step.id)}
                disabled={isExecuting}
              />
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
};

export interface TaskPlanViewProps {
  plan: TaskPlan;
  isExecuting: boolean;
  executingStepId: string | null;
  streamingText: string;
  onExecuteStep: (stepId: string) => void;
  onApproveStep: (stepId: string) => void;
  onSkipStep: (stepId: string) => void;
  onExecuteNext: () => void;
}

export const TaskPlanView = ({
  plan,
  isExecuting,
  executingStepId,
  streamingText,
  onExecuteStep,
  onApproveStep,
  onSkipStep,
  onExecuteNext,
}: TaskPlanViewProps) => {
  const nextPendingStep = plan.steps.find(
    (s) => s.status === "pending" || s.status === "failed",
  );
  const hasApprovalPending = plan.steps.some(
    (s) => s.status === "awaiting_approval",
  );

  return (
    <div className={styles.planCard}>
      <div className={styles.planHeader}>
        <Text className={styles.planTitle}>{plan.title}</Text>
        <Tag color={PLAN_STATUS_COLOR[plan.status] ?? "default"}>
          {plan.status}
        </Tag>
        <span className={styles.planMeta}>
          {new Date(plan.created_at).toLocaleString()}
        </span>
      </div>

      <div className={styles.stepList}>
        {plan.steps.map((step) => (
          <StepRow
            key={step.id}
            step={step}
            isExecuting={isExecuting}
            executingStepId={executingStepId}
            streamingText={streamingText}
            onExecute={onExecuteStep}
            onApprove={onApproveStep}
            onSkip={onSkipStep}
          />
        ))}
      </div>

      {plan.result_summary && (
        <div className={styles.resultSummary}>{plan.result_summary}</div>
      )}

      {plan.status !== "completed" && !hasApprovalPending && (
        <div className={styles.planActions}>
          <Button
            type="primary"
            icon={isExecuting ? <Spin size="small" /> : <PlayCircleOutlined />}
            onClick={onExecuteNext}
            disabled={isExecuting || !nextPendingStep}
          >
            {nextPendingStep ? "执行下一步" : "全部完成"}
          </Button>
        </div>
      )}
    </div>
  );
};
