import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  type BusinessObjectType,
  type CommercePlatform,
  type CommerceSceneKey,
  type CommerceTimeRange,
} from "~/types";

interface CommerceContextState {
  selectedPlatform: CommercePlatform;
  selectedScene: CommerceSceneKey;
  selectedObject: BusinessObjectType;
  selectedRange: CommerceTimeRange;
  draftMessage: string | null;
  draftVersion: number;
  setSelectedPlatform: (platform: CommercePlatform) => void;
  setSelectedScene: (scene: CommerceSceneKey) => void;
  setSelectedObject: (target: BusinessObjectType) => void;
  setSelectedRange: (range: CommerceTimeRange) => void;
  queueDraftMessage: (message: string) => void;
  clearDraftMessage: () => void;
}

export const useCommerceContextStore = create<CommerceContextState>()(
  persist(
    (set) => ({
      selectedPlatform: "taobao",
      selectedScene: "listing-copilot",
      selectedObject: "product",
      selectedRange: "7d",
      draftMessage: null,
      draftVersion: 0,
      setSelectedPlatform: (platform) =>
        set({
          selectedPlatform: platform,
        }),
      setSelectedScene: (scene) =>
        set({
          selectedScene: scene,
        }),
      setSelectedObject: (target) =>
        set({
          selectedObject: target,
        }),
      setSelectedRange: (range) =>
        set({
          selectedRange: range,
        }),
      queueDraftMessage: (message) =>
        set({
          draftMessage: message,
          draftVersion: Date.now(),
        }),
      clearDraftMessage: () =>
        set({
          draftMessage: null,
        }),
    }),
    {
      name: "kadaclaw-commerce-context-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedPlatform: state.selectedPlatform,
        selectedScene: state.selectedScene,
        selectedObject: state.selectedObject,
        selectedRange: state.selectedRange,
      }),
    },
  ),
);
