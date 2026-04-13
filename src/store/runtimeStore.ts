import { create } from "zustand";
import { getOpenClawAuthConfig, type OpenClawAuthConfig } from "~/api";
import { type RuntimeStatus } from "~/types";

interface RuntimeState {
  runtimeStatus: RuntimeStatus;
  runtimeMessage: string;
  authConfig: OpenClawAuthConfig | null;
  authConfigLoaded: boolean;
  setRuntimeState: (status: RuntimeStatus, message: string) => void;
  setAuthConfig: (config: OpenClawAuthConfig | null) => void;
  refreshAuthConfig: () => Promise<void>;
}

export const useRuntimeStore = create<RuntimeState>((set) => ({
  runtimeStatus: "idle",
  runtimeMessage: "尚未检测 OpenClaw runtime",
  authConfig: null,
  authConfigLoaded: false,
  setRuntimeState: (status, message) =>
    set({
      runtimeStatus: status,
      runtimeMessage: message,
    }),
  setAuthConfig: (config) =>
    set({
      authConfig: config,
      authConfigLoaded: true,
    }),
  refreshAuthConfig: async () => {
    try {
      const config = await getOpenClawAuthConfig();
      set({
        authConfig: config,
        authConfigLoaded: true,
      });
    } catch {
      set({
        authConfig: null,
        authConfigLoaded: true,
      });
    }
  },
}));
