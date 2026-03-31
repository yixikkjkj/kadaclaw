import { Alert, Avatar, Button, Flex, Input, Spin, Tag, Typography } from "antd";
import { useEffect, useRef, useState } from "react";
import { getOpenClawAuthConfig, type OpenClawAuthConfig } from "~/api";
import { selectActiveChatSession, useChatStore, useRuntimeStore } from "~/store";
import styles from "./index.css";

const { Paragraph, Text } = Typography;

export function OpenClawChatPanel() {
  const runtimeStatus = useRuntimeStore((state) => state.runtimeStatus);
  const runtimeMessage = useRuntimeStore((state) => state.runtimeMessage);
  const activeChatSession = useChatStore(selectActiveChatSession);
  const chatError = useChatStore((state) => state.chatError);
  const streamingReply = useChatStore((state) => state.streamingReply);
  const streamingRunning = useChatStore((state) => state.streamingRunning);
  const streamingSessionId = useChatStore((state) => state.streamingSessionId);
  const streamingStopping = useChatStore((state) => state.streamingStopping);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const setChatError = useChatStore((state) => state.setChatError);
  const stopStreamingMessage = useChatStore((state) => state.stopStreamingMessage);
  const [input, setInput] = useState("");
  const [authConfig, setAuthConfig] = useState<OpenClawAuthConfig | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

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

  const handleSend = async () => {
    if (!input.trim() || streamingRunning) {
      return;
    }

    const nextInput = input;
    setInput("");
    setChatError(null);
    await sendMessage(nextInput);
  };

  const handleStop = async () => {
    if (!streamingRunning || streamingStopping) {
      return;
    }

    await stopStreamingMessage();
  };

  return (
    <>
      <Flex vertical className={styles.chatPanel}>
        <Flex gap={8} wrap>
          <Tag color="blue">{authConfig?.provider ?? "provider 未知"}</Tag>
          <Tag>{authConfig?.model ?? "模型未配置"}</Tag>
          <Tag color={authConfig?.apiKeyConfigured ? "green" : "orange"}>
            {authConfig?.apiKeyConfigured ? "授权已配置" : "授权未配置"}
          </Tag>
        </Flex>

        {authConfig && !authConfig.apiKeyConfigured ? (
          <Alert
            className={styles.chatAuthAlert}
            type="warning"
            showIcon
            title="当前模型授权尚未配置"
            description={`OpenClaw 当前使用 ${authConfig.model}，需要在设置页补充 ${authConfig.apiKeyEnvName}。`}
          />
        ) : null}

        <div className={styles.chatMessageList} ref={scrollRef}>
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
                {message.role === "user" ? "你" : message.role === "assistant" ? "OC" : "!"}
              </Avatar>
              <div className={styles.chatBubble}>
                <div className={styles.chatMeta}>
                  <Text type="secondary">
                    {message.role === "user"
                      ? "你"
                      : message.role === "assistant"
                        ? "OpenClaw"
                        : "系统"}
                  </Text>
                </div>
                <Paragraph className={styles.chatContent}>{message.content}</Paragraph>
              </div>
            </div>
          ))}

          {streamingRunning && streamingSessionId === activeChatSession?.id ? (
            <div className={[styles.chatRow, styles.assistantRow].join(" ")}>
              <Avatar className={styles.chatAvatar}>OC</Avatar>
              {streamingReply ? (
                <div className={[styles.chatBubble, styles.chatBubbleStreaming].join(" ")}>
                  <div className={styles.chatMeta}>
                    <Text type="secondary">OpenClaw</Text>
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
                    <Text>OpenClaw 正在思考并逐段生成回复</Text>
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
            title="当前消息未成功送达 OpenClaw"
            description={chatError}
          />
        ) : null}

        <div className={styles.chatComposer}>
          <Input.TextArea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onPressEnter={(event) => {
              if (!event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            placeholder="输入你的问题，Enter 发送，Shift + Enter 换行"
            autoSize={{ minRows: 3, maxRows: 6 }}
            disabled={streamingRunning}
          />
          <div className={styles.chatComposerFooter}>
            <Text type="secondary">{runtimeMessage}</Text>
            <Flex gap={12}>
              {streamingRunning ? (
                <Button
                  danger
                  size="large"
                  onClick={() => void handleStop()}
                  loading={streamingStopping}
                >
                  停止生成
                </Button>
              ) : null}
              <Button
                type="primary"
                size="large"
                onClick={() => void handleSend()}
                loading={streamingRunning && !streamingStopping}
              >
                发送给 OpenClaw
              </Button>
            </Flex>
          </div>
        </div>
      </Flex>
    </>
  );
}
