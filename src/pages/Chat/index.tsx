import { Alert, Avatar, Card, Flex, Spin, Typography } from "antd";
import { useEffect, useRef, useState } from "react";
import { type OpenClawAuthConfig, getOpenClawAuthConfig } from "~/api";
import { ChatComposer } from "~/components/ChatComposer";
import { selectActiveChatSession, useChatStore, useRuntimeStore } from "~/store";
import styles from "./index.css";

const { Paragraph, Text, Title } = Typography;

export const ChatPage = () => {
  const runtimeStatus = useRuntimeStore((state) => state.runtimeStatus);
  const activeChatSession = useChatStore(selectActiveChatSession);
  const chatError = useChatStore((state) => state.chatError);
  const streamingReply = useChatStore((state) => state.streamingReply);
  const streamingRawContent = useChatStore((state) => state.streamingRawContent);
  const streamingStatus = useChatStore((state) => state.streamingStatus);
  const streamingRunning = useChatStore((state) => state.streamingRunning);
  const streamingSessionId = useChatStore((state) => state.streamingSessionId);
  const [authConfig, setAuthConfig] = useState<OpenClawAuthConfig | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [activeChatSession, chatError, streamingRawContent, streamingReply, streamingRunning]);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const config = await getOpenClawAuthConfig();
        if (active) {
          setAuthConfig(config);
        }
      } catch {
        if (active) {
          setAuthConfig(null);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [runtimeStatus]);

  return (
    <Flex vertical className={styles.chatPanel}>
      {authConfig && !authConfig.apiKeyConfigured ? (
        <Alert
          className={styles.chatAuthAlert}
          type="warning"
          showIcon
          title="当前模型授权尚未配置"
          description={`当前使用 ${authConfig.model}，需要前往设置页补充 ${authConfig.apiKeyEnvName}。`}
        />
      ) : null}

      <div className={styles.chatMessageList} ref={scrollRef}>
        <Card className={styles.welcomeCard}>
          <Flex vertical gap={10}>
            <Title level={5} style={{ margin: 0 }}>
              开始一段新的对话
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              直接描述你的目标、问题或希望调用的技能。当前版本不再预置额外业务上下文，所有信息按你的输入为准。
            </Paragraph>
          </Flex>
        </Card>

        {(activeChatSession?.messages ?? []).map((message) => (
          <div
            key={message.id}
            className={[
              styles.chatRow,
              message.role === "user"
                ? styles.userRow
                : message.role === "assistant"
                  ? styles.assistantRow
                  : styles.systemRow,
            ].join(" ")}
          >
            <Avatar className={styles.chatAvatar}>
              {message.role === "user" ? "你" : message.role === "assistant" ? "助" : "!"}
            </Avatar>
            <div className={styles.chatBubble}>
              <Paragraph className={styles.chatContent}>{message.content}</Paragraph>
            </div>
          </div>
        ))}

        {streamingRunning && streamingSessionId === activeChatSession?.id ? (
          <Flex vertical gap={10}>
            <div className={[styles.chatRow, styles.assistantRow].join(" ")}>
              <Avatar className={styles.chatAvatar}>助</Avatar>
              {streamingReply ? (
                <div className={[styles.chatBubble, styles.chatBubbleStreaming].join(" ")}>
                  <div className={styles.chatMeta}>
                    <Text type="secondary">助手</Text>
                  </div>
                  <Paragraph className={styles.chatContent}>
                    {streamingReply}
                    <span className={styles.streamingCursor} />
                  </Paragraph>
                </div>
              ) : (
                <div className={[styles.chatBubble, styles.chatBubbleLoading].join(" ")}>
                  <Flex align="center" gap={8}>
                    <Spin size="small" />
                    <Text>{streamingStatus || "助手正在生成回复"}</Text>
                  </Flex>
                </div>
              )}
            </div>

            <Card className={styles.traceCard}>
              <Flex vertical gap={8}>
                <Flex align="center" justify="space-between" gap={12}>
                  <Text strong>执行进度</Text>
                  <Text type="secondary">{streamingStatus || "OpenClaw 正在处理请求"}</Text>
                </Flex>
                <pre className={styles.traceContent}>
                  {streamingRawContent || "等待 OpenClaw 输出更多执行信息..."}
                </pre>
              </Flex>
            </Card>
          </Flex>
        ) : null}
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

      <ChatComposer
        authConfig={authConfig}
        onAuthConfigChange={setAuthConfig}
      />
    </Flex>
  );
};
