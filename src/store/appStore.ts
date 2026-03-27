import { create } from "zustand";
import type { InstalledSkillRecord, MarketSkillSummary, MarketSkillSort } from "~/api";

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

const initialChatSessionId = "kadaclaw-main";
const initialChatMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "这里是 Kadaclaw 内置的 OpenClaw 聊天窗口。发送消息后，应用会直接把当前会话交给本地 OpenClaw runtime。",
    createdAt: new Date().toISOString(),
  },
];

interface AppState {
  search: string;
  marketSort: MarketSkillSort;
  installedSkillIds: string[];
  installedSkills: InstalledSkillRecord[];
  recognizedSkillIds: string[];
  readySkillIds: string[];
  marketSkills: MarketSkillSummary[];
  skillOperations: Record<string, "installing" | "removing">;
  skillOperationError: string | null;
  selectedSkillId: string | null;
  skillDrawerOpen: boolean;
  runtimeStatus: "idle" | "checking" | "ready" | "error";
  runtimeMessage: string;
  chatSessionId: string;
  chatMessages: ChatMessage[];
  setSearch: (search: string) => void;
  setMarketSort: (sort: MarketSkillSort) => void;
  setInstalledSkills: (skills: InstalledSkillRecord[]) => void;
  setRecognizedSkills: (recognizedSkillIds: string[], readySkillIds: string[]) => void;
  setMarketSkills: (skills: MarketSkillSummary[]) => void;
  startSkillOperation: (skillId: string, action: "installing" | "removing") => void;
  finishSkillOperation: (skillId: string) => void;
  setSkillOperationError: (message: string | null) => void;
  setChatSessionId: (sessionId: string) => void;
  appendChatMessage: (message: ChatMessage) => void;
  resetChatSession: () => void;
  openSkill: (skillId: string) => void;
  closeSkill: () => void;
  setRuntimeState: (status: AppState["runtimeStatus"], message: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  search: "",
  marketSort: "updated",
  installedSkillIds: [],
  installedSkills: [],
  recognizedSkillIds: [],
  readySkillIds: [],
  marketSkills: [],
  skillOperations: {},
  skillOperationError: null,
  selectedSkillId: null,
  skillDrawerOpen: false,
  runtimeStatus: "idle",
  runtimeMessage: "尚未检测 OpenClaw runtime",
  chatSessionId: initialChatSessionId,
  chatMessages: initialChatMessages,
  setSearch: (search) => set({ search }),
  setMarketSort: (marketSort) => set({ marketSort }),
  setInstalledSkills: (installedSkills) =>
    set({
      installedSkills,
      installedSkillIds: installedSkills.map((skill) => skill.id),
    }),
  setRecognizedSkills: (recognizedSkillIds, readySkillIds) =>
    set({
      recognizedSkillIds,
      readySkillIds,
    }),
  setMarketSkills: (marketSkills) =>
    set({
      marketSkills,
    }),
  startSkillOperation: (skillId, action) =>
    set((state) => ({
      skillOperations: {
        ...state.skillOperations,
        [skillId]: action,
      },
      skillOperationError: null,
    })),
  finishSkillOperation: (skillId) =>
    set((state) => {
      const nextOperations = { ...state.skillOperations };
      delete nextOperations[skillId];
      return {
        skillOperations: nextOperations,
      };
    }),
  setSkillOperationError: (skillOperationError) =>
    set({
      skillOperationError,
    }),
  setChatSessionId: (sessionId) =>
    set({
      chatSessionId: sessionId,
    }),
  appendChatMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    })),
  resetChatSession: () =>
    set({
      chatSessionId: `kadaclaw-${Date.now().toString(36)}`,
      chatMessages: initialChatMessages.map((message) => ({
        ...message,
        id: `${message.id}-${Date.now().toString(36)}`,
        createdAt: new Date().toISOString(),
      })),
    }),
  openSkill: (skillId) =>
    set({
      selectedSkillId: skillId,
      skillDrawerOpen: true,
    }),
  closeSkill: () =>
    set({
      skillDrawerOpen: false,
    }),
  setRuntimeState: (status, message) =>
    set({
      runtimeStatus: status,
      runtimeMessage: message,
    }),
}));
