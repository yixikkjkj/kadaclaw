import { create } from "zustand";
import dayjs from "dayjs";
import {
  getChatHistory,
  getOpenClawActiveStream,
  saveChatHistory,
  sendOpenClawMessage,
  stopOpenClawMessage,
  type ChatHistoryState,
  type OpenClawChatStreamSnapshot,
} from "~/api";
import { type ChatJsonValue, type ChatMessage, type ChatRole, type ChatSession } from "~/types";

const initialChatSessionId = "kadaclaw-main";

const createInitialChatMessages = (timestamp: string): ChatMessage[] => [
  {
    id: `welcome-${timestamp}`,
    role: "assistant",
    content: "可以直接提问，或调用当前已启用的技能。",
    createdAt: timestamp,
  },
];

const getChatMessageTitleText = (value: ChatJsonValue) => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value) || (value && typeof value === "object")) {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
};

const createChatTitle = (messages: ChatMessage[]) => {
  const firstUserMessage = messages.find((message) => message.role === "user");

  if (!firstUserMessage) {
    return "新对话";
  }

  const titleText = getChatMessageTitleText(firstUserMessage.content);

  return titleText.length > 18 ? `${titleText.slice(0, 18)}...` : titleText || "新对话";
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
  chatHistoryLoaded: boolean;
  chatError: string | null;
  streamingSessionId: string | null;
  streamingStatus: string;
  streamingReply: string;
  streamingRawOutput: ChatJsonValue | null;
  streamingRunning: boolean;
  streamingStopping: boolean;
  streamStopRequested: boolean;
  hydrateChatHistory: () => Promise<void>;
  hydrateActiveStream: () => Promise<void>;
  setChatError: (error: string | null) => void;
  syncActiveSessionId: (sessionId: string) => void;
  syncSessionId: (currentSessionId: string, nextSessionId: string) => void;
  activateSession: (sessionId: string) => void;
  appendMessage: (message: ChatMessage) => void;
  appendMessageToSession: (sessionId: string, message: ChatMessage) => void;
  createSession: () => void;
  deleteSession: (sessionId: string) => void;
  updateStreamingSnapshot: (snapshot: OpenClawChatStreamSnapshot) => void;
  clearStreamingState: () => void;
  sendMessage: (message: string) => Promise<void>;
  stopStreamingMessage: () => Promise<void>;
}

const initialSession = createChatSession(initialChatSessionId);

const getInitialChatHistoryState = (): ChatHistoryState => ({
  activeChatSessionId: initialSession.id,
  chatSessions: [initialSession],
});

const normalizeChatHistoryState = (snapshot: ChatHistoryState | null): ChatHistoryState => {
  if (!snapshot || snapshot.chatSessions.length === 0) {
    return getInitialChatHistoryState();
  }

  const activeChatSessionId = snapshot.chatSessions.some(
    (session) => session.id === snapshot.activeChatSessionId,
  )
    ? snapshot.activeChatSessionId
    : snapshot.chatSessions[0].id;

  return {
    activeChatSessionId,
    chatSessions: snapshot.chatSessions.map((session) => ({
      ...session,
      messages: session.messages ?? [],
    })),
  };
};

const persistChatHistory = (state: Pick<ChatState, "activeChatSessionId" | "chatSessions">) => {
  void saveChatHistory({
    activeChatSessionId: state.activeChatSessionId,
    chatSessions: state.chatSessions,
  }).catch((reason) => {
    console.error("保存聊天记录失败", reason);
  });
};

const buildFallbackSession = () => createChatSession(`kadaclaw-${Date.now().toString(36)}`);

const appendMessageToSessions = (
  chatSessions: ChatSession[],
  sessionId: string,
  message: ChatMessage,
) =>
  chatSessions.map((session) =>
    session.id === sessionId
      ? {
          ...session,
          messages: [...session.messages, message],
          title: createChatTitle([...session.messages, message]),
          updatedAt: message.createdAt,
        }
      : session,
  );

const syncSessionIdInSessions = (
  chatSessions: ChatSession[],
  currentSessionId: string,
  nextSessionId: string,
) =>
  chatSessions.map((session) =>
    session.id === currentSessionId
      ? {
          ...session,
          id: nextSessionId,
        }
      : session,
  );

const buildMessageId = (role: ChatRole) =>
  `${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const useChatStore = create<ChatState>((set, get) => ({
  activeChatSessionId: initialSession.id,
  chatSessions: [initialSession],
  chatHistoryLoaded: false,
  chatError: null,
  streamingSessionId: null,
  streamingStatus: "",
  streamingReply: "",
  streamingRawOutput: null,
  streamingRunning: false,
  streamingStopping: false,
  streamStopRequested: false,
  hydrateChatHistory: async () => {
    if (get().chatHistoryLoaded) {
      return;
    }

    try {
      const snapshot = normalizeChatHistoryState(await getChatHistory());

      set({
        activeChatSessionId: snapshot.activeChatSessionId,
        chatSessions: snapshot.chatSessions,
        chatHistoryLoaded: true,
      });
    } catch (reason) {
      console.error("读取聊天记录失败", reason);
      set({
        chatHistoryLoaded: true,
      });
    }
  },
  hydrateActiveStream: async () => {
    try {
      const snapshot = await getOpenClawActiveStream();
      if (!snapshot) {
        set((state) => ({
          streamingSessionId: null,
          streamingStatus: "",
          streamingReply: "",
          streamingRawOutput: null,
          streamingRunning: state.streamingRunning ? false : state.streamingRunning,
          streamingStopping: false,
          streamStopRequested: false,
        }));
        return;
      }

      set({
        streamingSessionId: snapshot.sessionId,
        streamingStatus: snapshot.status,
        streamingReply: snapshot.reply,
        streamingRawOutput: snapshot.rawOutput,
        streamingRunning: true,
        streamingStopping: false,
        streamStopRequested: false,
      });
    } catch (reason) {
      console.error("重连聊天流失败", reason);
    }
  },
  setChatError: (error) => {
    set({
      chatError: error,
    });
  },
  syncActiveSessionId: (sessionId) => {
    set((state) => ({
      activeChatSessionId: sessionId,
      chatSessions: syncSessionIdInSessions(
        state.chatSessions,
        state.activeChatSessionId,
        sessionId,
      ),
    }));

    if (get().chatHistoryLoaded) {
      persistChatHistory(get());
    }
  },
  syncSessionId: (currentSessionId, nextSessionId) => {
    set((state) => ({
      activeChatSessionId:
        state.activeChatSessionId === currentSessionId ? nextSessionId : state.activeChatSessionId,
      chatSessions: syncSessionIdInSessions(state.chatSessions, currentSessionId, nextSessionId),
      streamingSessionId:
        state.streamingSessionId === currentSessionId ? nextSessionId : state.streamingSessionId,
    }));

    if (get().chatHistoryLoaded) {
      persistChatHistory(get());
    }
  },
  activateSession: (sessionId) => {
    set({
      activeChatSessionId: sessionId,
    });

    if (get().chatHistoryLoaded) {
      persistChatHistory(get());
    }
  },
  appendMessage: (message) => {
    set((state) => ({
      chatSessions: appendMessageToSessions(state.chatSessions, state.activeChatSessionId, message),
    }));

    if (get().chatHistoryLoaded) {
      persistChatHistory(get());
    }
  },
  appendMessageToSession: (sessionId, message) => {
    set((state) => ({
      chatSessions: appendMessageToSessions(state.chatSessions, sessionId, message),
    }));

    if (get().chatHistoryLoaded) {
      persistChatHistory(get());
    }
  },
  createSession: () => {
    set((state) => {
      const sessionId = `kadaclaw-${Date.now().toString(36)}`;
      const nextSession = createChatSession(sessionId);

      return {
        activeChatSessionId: sessionId,
        chatSessions: [nextSession, ...state.chatSessions],
      };
    });

    if (get().chatHistoryLoaded) {
      persistChatHistory(get());
    }
  },
  deleteSession: (sessionId) => {
    set((state) => {
      const remainingSessions = state.chatSessions.filter((session) => session.id !== sessionId);

      if (remainingSessions.length === 0) {
        const fallbackSession = buildFallbackSession();

        return {
          activeChatSessionId: fallbackSession.id,
          chatSessions: [fallbackSession],
        };
      }

      const nextActiveChatSessionId =
        state.activeChatSessionId === sessionId
          ? remainingSessions[0].id
          : state.activeChatSessionId;

      return {
        activeChatSessionId: nextActiveChatSessionId,
        chatSessions: remainingSessions,
      };
    });

    if (get().chatHistoryLoaded) {
      persistChatHistory(get());
    }
  },
  updateStreamingSnapshot: (snapshot) => {
    set((state) => ({
      streamingSessionId: snapshot.sessionId,
      streamingStatus: snapshot.status,
      streamingReply: snapshot.reply,
      streamingRawOutput: snapshot.rawOutput,
      streamingRunning: true,
      streamingStopping:
        state.streamingSessionId === snapshot.sessionId ? state.streamingStopping : false,
      streamStopRequested:
        state.streamingSessionId === snapshot.sessionId ? state.streamStopRequested : false,
    }));
  },
  clearStreamingState: () => {
    set({
      streamingSessionId: null,
      streamingStatus: "",
      streamingReply: "",
      streamingRawOutput: null,
      streamingRunning: false,
      streamingStopping: false,
      streamStopRequested: false,
    });
  },
  sendMessage: async (message) => {
    const content = message.trim();
    if (!content || get().streamingRunning) {
      return;
    }

    const activeChatSession = selectActiveChatSession(get());
    if (!activeChatSession) {
      return;
    }

    const sessionId = activeChatSession.id;
    const createdAt = dayjs().toISOString();
    get().appendMessageToSession(sessionId, {
      id: buildMessageId("user"),
      role: "user",
      content,
      createdAt,
    });
    get().setChatError(null);
    set({
      streamingSessionId: sessionId,
      streamingStatus: "正在执行",
      streamingReply: "",
      streamingRawOutput: null,
      streamingRunning: true,
      streamingStopping: false,
      streamStopRequested: false,
    });

    try {
      const result = await sendOpenClawMessage({
        sessionId,
        message: content,
      });

      if (get().streamStopRequested) {
        get().appendMessageToSession(sessionId, {
          id: buildMessageId("system"),
          role: "system",
          content: "已停止生成",
          createdAt: dayjs().toISOString(),
        });
        get().clearStreamingState();
        return;
      }

      get().syncSessionId(sessionId, result.sessionId);
      get().appendMessageToSession(result.sessionId, {
        id: buildMessageId("assistant"),
        role: "assistant",
        content: result.reply,
        rawContent: result.rawOutput ?? result.reply ?? "未返回可显示内容。",
        createdAt: dayjs().toISOString(),
      });
      get().clearStreamingState();
    } catch (reason) {
      if (get().streamStopRequested) {
        get().appendMessageToSession(sessionId, {
          id: buildMessageId("system"),
          role: "system",
          content: "已停止生成",
          createdAt: dayjs().toISOString(),
        });
      } else {
        get().setChatError(
          reason instanceof Error
            ? reason.message
            : typeof reason === "string"
              ? reason
              : "发送失败，请检查 OpenClaw runtime 和模型授权。",
        );
      }

      get().clearStreamingState();
    }
  },
  stopStreamingMessage: async () => {
    if (!get().streamingRunning || get().streamingStopping) {
      return;
    }

    set({
      streamStopRequested: true,
      streamingStopping: true,
    });

    try {
      await stopOpenClawMessage();
    } catch (reason) {
      set({
        streamStopRequested: false,
        streamingStopping: false,
      });
      get().setChatError(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "停止生成失败，请稍后重试。",
      );
    }
  },
}));

export const selectActiveChatSession = (state: ChatState) =>
  state.chatSessions.find((session) => session.id === state.activeChatSessionId) ??
  state.chatSessions[0];
