import { create } from "zustand";
import dayjs from "dayjs";

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

const initialChatSessionId = "kadaclaw-main";

const createInitialChatMessages = (timestamp: string): ChatMessage[] => [
  {
    id: `welcome-${timestamp}`,
    role: "assistant",
    content:
      "这里是 Kadaclaw 内置的 OpenClaw 聊天窗口。发送消息后，应用会直接把当前会话交给本地 OpenClaw runtime。",
    createdAt: timestamp,
  },
];

const createChatTitle = (messages: ChatMessage[]) => {
  const firstUserMessage = messages.find((message) => message.role === "user");

  if (!firstUserMessage) {
    return "新对话";
  }

  return firstUserMessage.content.length > 18
    ? `${firstUserMessage.content.slice(0, 18)}...`
    : firstUserMessage.content;
};

const createChatSession = (sessionId: string, timestamp = dayjs().toISOString()): ChatSession => {
  const messages = createInitialChatMessages(timestamp);

  return {
    id: sessionId,
    title: createChatTitle(messages),
    createdAt: timestamp,
    updatedAt: timestamp,
    messages,
  };
};

interface ChatState {
  activeChatSessionId: string;
  chatSessions: ChatSession[];
  syncActiveSessionId: (sessionId: string) => void;
  activateSession: (sessionId: string) => void;
  appendMessage: (message: ChatMessage) => void;
  createSession: () => void;
}

const initialSession = createChatSession(initialChatSessionId);

export const useChatStore = create<ChatState>((set) => ({
  activeChatSessionId: initialSession.id,
  chatSessions: [initialSession],
  syncActiveSessionId: (sessionId) =>
    set((state) => ({
      activeChatSessionId: sessionId,
      chatSessions: state.chatSessions.map((session) =>
        session.id === state.activeChatSessionId
          ? {
              ...session,
              id: sessionId,
            }
          : session,
      ),
    })),
  activateSession: (sessionId) =>
    set({
      activeChatSessionId: sessionId,
    }),
  appendMessage: (message) =>
    set((state) => ({
      chatSessions: state.chatSessions.map((session) =>
        session.id === state.activeChatSessionId
          ? {
              ...session,
              messages: [...session.messages, message],
              title: createChatTitle([...session.messages, message]),
              updatedAt: message.createdAt,
            }
          : session,
      ),
    })),
  createSession: () =>
    set((state) => {
      const sessionId = `kadaclaw-${Date.now().toString(36)}`;
      const nextSession = createChatSession(sessionId);

      return {
        activeChatSessionId: sessionId,
        chatSessions: [nextSession, ...state.chatSessions],
      };
    }),
}));

export const selectActiveChatSession = (state: ChatState) =>
  state.chatSessions.find((session) => session.id === state.activeChatSessionId) ?? state.chatSessions[0];
