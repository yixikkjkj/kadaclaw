import { create } from "zustand";
import { type RuntimeStatus } from "~/types";

interface RuntimeState {
  runtimeStatus: RuntimeStatus;
  runtimeMessage: string;
  agentConfigured: boolean;
  setRuntimeState: (status: RuntimeStatus, message: string) => void;
  setAgentConfigured: (configured: boolean) => void;
}

export const useRuntimeStore = create<RuntimeState>((set) => ({
  runtimeStatus: "idle",
  runtimeMessage: "Agent 后端尚未初始化",
  agentConfigured: false,
  setRuntimeState: (status, message) =>
    set({
      runtimeStatus: status,
      runtimeMessage: message,
    }),
  setAgentConfigured: (configured) =>
    set({
      agentConfigured: configured,
    }),
}));
