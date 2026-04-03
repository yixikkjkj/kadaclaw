import { Alert, Avatar, Button, Card, Flex, Select, Spin, Tag, Typography } from "antd";
import { useEffect, useRef, useState } from "react";
import { type OpenClawAuthConfig, getOpenClawAuthConfig } from "~/api";
import { ChatComposer } from "~/components/ChatComposer";
import {
  BUSINESS_OBJECT_OPTIONS,
  COMMERCE_PLATFORM_OPTIONS,
  PRIMARY_SKILL_BLUEPRINTS,
  QUICK_CHAT_PROMPTS,
  TIME_RANGE_OPTIONS,
  getBusinessObjectOption,
  getCommercePlatformOption,
  getCommerceSceneBlueprint,
  getTimeRangeOption,
} from "~/common/ecommerce";
import { selectActiveChatSession, useChatStore, useCommerceContextStore, useRuntimeStore } from "~/store";
import styles from "./index.css";

const { Paragraph, Text, Title } = Typography;

export const ChatPage = () => {
  const runtimeStatus = useRuntimeStore((state) => state.runtimeStatus);
  const activeChatSession = useChatStore(selectActiveChatSession);
  const chatError = useChatStore((state) => state.chatError);
  const streamingReply = useChatStore((state) => state.streamingReply);
  const streamingRunning = useChatStore((state) => state.streamingRunning);
  const streamingSessionId = useChatStore((state) => state.streamingSessionId);
  const selectedPlatform = useCommerceContextStore((state) => state.selectedPlatform);
  const selectedScene = useCommerceContextStore((state) => state.selectedScene);
  const selectedObject = useCommerceContextStore((state) => state.selectedObject);
  const selectedRange = useCommerceContextStore((state) => state.selectedRange);
  const [authConfig, setAuthConfig] = useState<OpenClawAuthConfig | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const selectedPlatformOption = getCommercePlatformOption(selectedPlatform);
  const selectedSceneOption = getCommerceSceneBlueprint(selectedScene);
  const selectedObjectOption = getBusinessObjectOption(selectedObject);
  const selectedRangeOption = getTimeRangeOption(selectedRange);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [activeChatSession, chatError, streamingReply, streamingRunning]);

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
            <Tag color="blue">{selectedPlatformOption.label}</Tag>
            <Title level={5} style={{ margin: 0 }}>
              当前场景：{selectedSceneOption.title}
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {selectedSceneOption.summary}
            </Paragraph>
            <Flex gap={8} wrap>
              <Tag>{selectedObjectOption.label}</Tag>
              <Tag>{selectedRangeOption.label}</Tag>
              <Tag>{selectedPlatformOption.description}</Tag>
            </Flex>
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
              <div className={styles.chatMeta}>
                <Text type="secondary">
                  {message.role === "user"
                    ? "你"
                    : message.role === "assistant"
                      ? "助手"
                      : "系统"}
                </Text>
              </div>
              <Paragraph className={styles.chatContent}>{message.content}</Paragraph>
            </div>
          </div>
        ))}

        {streamingRunning && streamingSessionId === activeChatSession?.id ? (
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
                  <Text>助手正在生成回复</Text>
                </Flex>
              </div>
            )}
          </div>
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
