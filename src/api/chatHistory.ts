import { type ChatJsonValue, type ChatRole } from "~/types";
import { invoke, isTauri } from "@tauri-apps/api/core";

export interface StoredChatMessage {
  id: string;
  role: ChatRole;
  content: ChatJsonValue;
  rawContent?: ChatJsonValue;
  createdAt: string;
}

export interface StoredChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredChatMessage[];
}

export interface ChatHistoryState {
  activeChatSessionId: string;
  chatSessions: StoredChatSession[];
}

export const getChatHistory = async () => {
  if (!isTauri()) {
    return null;
  }

  return await invoke<ChatHistoryState | null>("get_chat_history");
};

export const saveChatHistory = async (payload: ChatHistoryState) => {
  if (!isTauri()) {
    return false;
  }

  return await invoke<boolean>("save_chat_history", { payload });
};
