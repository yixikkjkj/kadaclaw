import { type BadgeProps } from "antd";
import { type RuntimeStatus } from "~/types";

export const getRuntimeLabel = (runtimeStatus: RuntimeStatus) => {
  if (runtimeStatus === "ready") {
    return "Runtime 已就绪";
  }
  if (runtimeStatus === "checking") {
    return "Runtime 检测中";
  }
  if (runtimeStatus === "error") {
    return "Runtime 异常";
  }

  return "Runtime 待启动";
};

export const getRuntimeBadgeStatus = (runtimeStatus: RuntimeStatus): BadgeProps["status"] => {
  if (runtimeStatus === "ready") {
    return "success";
  }
  if (runtimeStatus === "checking") {
    return "processing";
  }
  if (runtimeStatus === "error") {
    return "error";
  }

  return "default";
};

export const getRuntimeProgressPercent = (runtimeStatus: RuntimeStatus) => {
  if (runtimeStatus === "ready") {
    return 100;
  }
  if (runtimeStatus === "checking") {
    return 68;
  }

  return 32;
};
