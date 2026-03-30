import { create } from "zustand";

interface RuntimeState {
  runtimeStatus: "idle" | "checking" | "ready" | "error";
  runtimeMessage: string;
  setRuntimeState: (status: RuntimeState["runtimeStatus"], message: string) => void;
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
