import { create } from "zustand";
import { skills } from "../data/skills";

export type AppView = "workspace" | "market" | "installed" | "settings";
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
  currentView: AppView;
  search: string;
  category: string;
  installedSkillIds: string[];
  recognizedSkillIds: string[];
  readySkillIds: string[];
  selectedSkillId: string | null;
  skillDrawerOpen: boolean;
  runtimeStatus: "idle" | "checking" | "ready" | "error";
  runtimeMessage: string;
  chatSessionId: string;
  chatMessages: ChatMessage[];
  setView: (view: AppView) => void;
  setSearch: (search: string) => void;
  setCategory: (category: string) => void;
  setInstalledSkillIds: (skillIds: string[]) => void;
  setRecognizedSkills: (recognizedSkillIds: string[], readySkillIds: string[]) => void;
  setChatSessionId: (sessionId: string) => void;
  appendChatMessage: (message: ChatMessage) => void;
  resetChatSession: () => void;
  openSkill: (skillId: string) => void;
  closeSkill: () => void;
  setRuntimeState: (status: AppState["runtimeStatus"], message: string) => void;
}

const installedByDefault = skills
  .filter((skill) => skill.installed)
  .map((skill) => skill.id);

export const useAppStore = create<AppState>((set) => ({
  currentView: "market",
  search: "",
  category: "全部",
  installedSkillIds: installedByDefault,
  recognizedSkillIds: [],
  readySkillIds: [],
  selectedSkillId: skills[0]?.id ?? null,
  skillDrawerOpen: false,
  runtimeStatus: "idle",
  runtimeMessage: "尚未检测 OpenClaw runtime",
  chatSessionId: initialChatSessionId,
  chatMessages: initialChatMessages,
  setView: (view) => set({ currentView: view }),
  setSearch: (search) => set({ search }),
  setCategory: (category) => set({ category }),
  setInstalledSkillIds: (skillIds) =>
    set({
      installedSkillIds: skillIds,
    }),
  setRecognizedSkills: (recognizedSkillIds, readySkillIds) =>
    set({
      recognizedSkillIds,
      readySkillIds,
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
