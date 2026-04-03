import { create } from "zustand";
import { type RuntimeStatus } from "~/types";

interface RuntimeState {
  runtimeStatus: RuntimeStatus;
  runtimeMessage: string;
  setRuntimeState: (status: RuntimeStatus, message: string) => void;
}

export const useRuntimeStore = create<RuntimeState>((set) => ({
  runtimeStatus: "idle",
  runtimeMessage: "尚未检测 OpenClaw runtime",
  setRuntimeState: (status, message) =>
    set({
      runtimeStatus: status,
      runtimeMessage: message,
    }),
}));
