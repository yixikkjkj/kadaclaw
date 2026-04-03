import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { type CommercePlatform, type PlatformConnectionDraft } from "~/types";

interface ConnectorState {
  selectedPlatform: CommercePlatform;
  connections: Partial<Record<CommercePlatform, PlatformConnectionDraft>>;
  setSelectedPlatform: (platform: CommercePlatform) => void;
  saveConnection: (
    payload: Omit<PlatformConnectionDraft, "updatedAt"> & { updatedAt?: number },
  ) => void;
  removeConnection: (platform: CommercePlatform) => void;
}

export const useConnectorStore = create<ConnectorState>()(
  persist(
    (set) => ({
      selectedPlatform: "taobao",
      connections: {},
      setSelectedPlatform: (platform) =>
        set({
          selectedPlatform: platform,
        }),
      saveConnection: (payload) =>
        set((state) => ({
          selectedPlatform: payload.platform,
          connections: {
            ...state.connections,
            [payload.platform]: {
              ...payload,
              updatedAt: payload.updatedAt ?? Date.now(),
            },
          },
        })),
      removeConnection: (platform) =>
        set((state) => {
          const nextConnections = { ...state.connections };
          delete nextConnections[platform];

          return {
            connections: nextConnections,
          };
        }),
    }),
    {
      name: "kadaclaw-connector-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedPlatform: state.selectedPlatform,
        connections: state.connections,
      }),
    },
  ),
);
