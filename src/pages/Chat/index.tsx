import {
  BarChartOutlined,
  RobotOutlined,
  ToolOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Alert, Button, Flex, Tag, Typography } from "antd";
import classNames from "classnames";
import dayjs from "dayjs";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  normalizeChatMessage,
  type ChatMessageDisplayRole,
  type NormalizedChatMessage,
} from "~/common/chatMessage";
import { ROUTE_PATHS } from "~/common/constants";
import { ChatComposer, ChatMessageContent, TraceDrawer } from "~/components";
import {
  selectActiveChatSession,
  useChatStore,
  useRuntimeStore,
  useSkillStore,
} from "~/store";
import styles from "./index.css";

const { Paragraph, Text, Title } = Typography;

const normalizeStreamingStatus = (value: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  const isTransient =
    normalized.length === 0 ||
    normalized === "thinking" ||
    normalized === "waiting" ||
    normalized === "waitingforagentreply" ||
    normalized === "waitingforagentreplay" ||
    normalized === "waitingforgatewayreply" ||
    normalized === "waitingforgatewayagentreply" ||
    normalized === "waitingforassistantreply" ||
    (normalized.startsWith("waitingfor") && normalized.endsWith("reply"));

  if (isTransient) {
    return "正在执行";
  }

  return value.trim() || "正在执行";
};

interface ChatMessageGroup {
  id: string;
  role: ChatMessageDisplayRole;
  messages: NormalizedChatMessage[];
}

const buildMessageGroups = (messages: NormalizedChatMessage[]) => {
  const groups: ChatMessageGroup[] = [];

  messages.forEach((message) => {
    const previousGroup = groups[groups.length - 1];

    if (previousGroup && previousGroup.role === message.displayRole) {
      previousGroup.messages.push(message);
      return;
    }

    groups.push({
      id: message.id,
      role: message.displayRole,
      messages: [message],
    });
  });

  return groups;
};

const formatMessageTime = (value: string) => dayjs(value).format("HH:mm");

const getGroupLabel = (role: ChatMessageDisplayRole) => {
  if (role === "user") {
    return "You";
  }

  if (role === "tool") {
    return "Tool";
  }

  if (role === "system") {
    return "System";
  }

  return "Assistant";
};

const renderGroupAvatar = (role: ChatMessageDisplayRole) => {
  if (role === "user") {
    return <UserOutlined />;
  }

  if (role === "tool") {
    return <ToolOutlined />;
  }

  return <RobotOutlined />;
};

export const ChatPage = () => {
  const navigate = useNavigate();
  const agentConfigured = useRuntimeStore((state) => state.agentConfigured);
  const activeChatSession = useChatStore(selectActiveChatSession);
  const chatError = useChatStore((state) => state.chatError);
  const streamingRunning = useChatStore((state) => state.streamingRunning);
  const streamingSessionId = useChatStore((state) => state.streamingSessionId);
  const streamingStatus = useChatStore((state) => state.streamingStatus);
  const streamingToolName = useChatStore((state) => state.streamingToolName);
  const streamingReply = useChatStore((state) => state.streamingReply);
  const lastTokenUsage = useChatStore((state) => state.lastTokenUsage);
  const readySkillIds = useSkillStore((state) => state.readySkillIds);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [activeChatSession, chatError, streamingRunning, streamingStatus]);

  const executionStatus = streamingToolName
    ? `正在调用 ${streamingToolName}…`
    : normalizeStreamingStatus(streamingStatus);
  const activeSessionTitle = activeChatSession?.title || "New Chat";
  const normalizedMessages = (activeChatSession?.messages ?? []).map(
    (message) => normalizeChatMessage(message),
  );
  const messageGroups = buildMessageGroups(normalizedMessages);
  const streamingPreviewMessage =
    streamingRunning && streamingSessionId === activeChatSession?.id
      ? normalizeChatMessage({
          id: `streaming-${streamingSessionId}`,
          role: "assistant",
          content: streamingReply || executionStatus,
          rawContent: streamingReply || executionStatus,
          createdAt: new Date().toISOString(),
        })
      : null;
  const shouldShowWelcomeCard =
    messageGroups.length === 0 && streamingPreviewMessage === null;

  return (
    <Flex vertical className={styles.chatPanel}>
      {!agentConfigured ? (
        <Alert
          className={styles.chatAuthAlert}
          type="warning"
          showIcon
          title="Agent 尚未配置"
          description="请前往设置页配置 LLM 提供商和 API Key。"
          action={
            <Button
              size="small"
              onClick={() => void navigate(ROUTE_PATHS.settings)}
            >
              去设置
            </Button>
          }
        />
      ) : null}

      <Flex
        className={styles.chatTitleRow}
        align="center"
        justify="space-between"
      >
        <Title level={4} className={styles.workspaceTitle}>
          {activeSessionTitle}
        </Title>
        <Button
          type="text"
          size="small"
          icon={<BarChartOutlined />}
          className={styles.traceButton}
          onClick={() => setTraceOpen(true)}
        >
          Trace
        </Button>
      </Flex>

      {readySkillIds.length > 0 ? (
        <Flex className={styles.activeSkillsBar} align="center" gap={6} wrap>
          <Text className={styles.activeSkillsLabel}>已激活技能：</Text>
          {readySkillIds.map((id) => (
            <Tag
              key={id}
              className={styles.activeSkillTag}
              onClick={() => void navigate(ROUTE_PATHS.skills)}
            >
              {id}
            </Tag>
          ))}
        </Flex>
      ) : null}

      <div className={styles.chatMessageList} ref={scrollRef}>
        <div className={styles.conversationRail}>
          {shouldShowWelcomeCard ? (
            <div className={styles.welcomeCard}>
              <Flex vertical gap={10}>
                <Text className={styles.welcomeEyebrow}>New Chat</Text>
                <Title level={5} className={styles.welcomeTitle}>
                  描述目标，直接开始
                </Title>
                <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  直接描述目标、问题或希望调用的技能，系统会按你的输入继续执行。
                </Paragraph>
              </Flex>
            </div>
          ) : null}

          {messageGroups.map((group) => (
            <div
              key={group.id}
              className={classNames(
                styles.chatGroup,
                group.role === "user"
                  ? styles.userGroup
                  : group.role === "assistant"
                    ? styles.assistantGroup
                    : group.role === "tool"
                      ? styles.toolGroup
                      : styles.systemGroup,
              )}
            >
              <div className={styles.chatAvatar}>
                {renderGroupAvatar(group.role)}
              </div>

              <div className={styles.chatGroupMessages}>
                {group.messages.map((message) => (
                  <div key={message.id} className={styles.chatBubble}>
                    <ChatMessageContent message={message} />
                  </div>
                ))}

                <div className={styles.chatGroupFooter}>
                  <Text className={styles.chatSenderName}>
                    {getGroupLabel(group.role)}
                  </Text>
                  <Text className={styles.chatGroupTimestamp}>
                    {formatMessageTime(
                      group.messages[group.messages.length - 1].createdAt,
                    )}
                  </Text>
                </div>
              </div>
            </div>
          ))}

          {streamingPreviewMessage ? (
            <div
              className={classNames(
                styles.chatGroup,
                streamingPreviewMessage.displayRole === "tool"
                  ? styles.toolGroup
                  : styles.assistantGroup,
              )}
            >
              <div className={styles.chatAvatar}>
                {renderGroupAvatar(streamingPreviewMessage.displayRole)}
              </div>
              <div className={styles.chatGroupMessages}>
                <div
                  className={classNames(
                    styles.chatBubble,
                    styles.streamingBubble,
                  )}
                >
                  <ChatMessageContent
                    message={streamingPreviewMessage}
                    streaming
                    statusText={executionStatus}
                  />
                </div>
                <div className={styles.chatGroupFooter}>
                  <Text className={styles.chatSenderName}>
                    {getGroupLabel(streamingPreviewMessage.displayRole)}
                  </Text>
                  <Text className={styles.chatGroupTimestamp}>live</Text>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {chatError ? (
        <Alert
          className={styles.chatAlert}
          type="error"
          showIcon
          title="当前消息发送失败"
          description={chatError}
        />
      ) : null}

      {!streamingRunning && lastTokenUsage ? (
        <div className={styles.tokenUsageBar}>
          <Text className={styles.tokenUsageText}>
            提示词 {lastTokenUsage.promptTokens.toLocaleString()} tokens
            &nbsp;·&nbsp; 补全{" "}
            {lastTokenUsage.completionTokens.toLocaleString()} tokens
            &nbsp;·&nbsp; 合计 {lastTokenUsage.totalTokens.toLocaleString()}{" "}
            tokens
          </Text>
        </div>
      ) : null}

      <ChatComposer />

      <TraceDrawer
        open={traceOpen}
        session={activeChatSession ?? null}
        onClose={() => setTraceOpen(false)}
      />
    </Flex>
  );
};
