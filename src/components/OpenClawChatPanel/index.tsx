import { Alert, Avatar, Button, Card, Flex, Input, Spin, Tag, Typography } from "antd";
import dayjs from "dayjs";
import { useEffect, useRef, useState } from "react";
import { getOpenClawAuthConfig, sendOpenClawMessage, type OpenClawAuthConfig } from "~/api";
import { selectActiveChatSession, useChatStore, useRuntimeStore } from "~/store";
import styles from "./index.css";

const { Paragraph, Text, Title } = Typography;

function buildMessageId(role: "user" | "assistant" | "system") {
  return `${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function OpenClawChatPanel() {
  const runtimeStatus = useRuntimeStore((state) => state.runtimeStatus);
  const runtimeMessage = useRuntimeStore((state) => state.runtimeMessage);
  const activeChatSession = useChatStore(selectActiveChatSession);
  const syncActiveSessionId = useChatStore((state) => state.syncActiveSessionId);
  const appendMessage = useChatStore((state) => state.appendMessage);
  const createSession = useChatStore((state) => state.createSession);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authConfig, setAuthConfig] = useState<OpenClawAuthConfig | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [activeChatSession, sending, error]);

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
    const message = input.trim();
    if (!message || sending) {
      return;
    }

    if (!activeChatSession) {
      return;
    }

    appendMessage({
      id: buildMessageId("user"),
      role: "user",
      content: message,
      createdAt: dayjs().toISOString(),
    });
    setInput("");
    setError(null);
    setSending(true);

    try {
      const result = await sendOpenClawMessage({
        sessionId: activeChatSession.id,
        message,
      });
      syncActiveSessionId(result.sessionId);
      appendMessage({
        id: buildMessageId("assistant"),
        role: "assistant",
        content: result.reply || "OpenClaw 未返回可显示内容。",
        createdAt: dayjs().toISOString(),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "发送失败，请检查 OpenClaw runtime 和模型授权。");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card
      title="和 OpenClaw 聊天"
      extra={
        <Flex gap={10}>
          <Tag color={runtimeStatus === "ready" ? "green" : "orange"}>
            {runtimeStatus === "ready" ? "Runtime 在线" : "等待连接"}
          </Tag>
          <Button onClick={createSession}>新会话</Button>
        </Flex>
      }
    >
      <div className={styles.chatPanel}>
        <div className={styles.chatPanelHead}>
          <div>
            <Title level={4}>主会话窗口</Title>
            <Paragraph type="secondary">
              这里直接调用本地 OpenClaw agent，会话 ID 会持续复用，保持上下文连续。
            </Paragraph>
            <Flex gap={8} wrap>
              <Tag color="blue">{authConfig?.provider ?? "provider 未知"}</Tag>
              <Tag>{authConfig?.model ?? "模型未配置"}</Tag>
              <Tag color={authConfig?.apiKeyConfigured ? "green" : "orange"}>
                {authConfig?.apiKeyConfigured ? "授权已配置" : "授权未配置"}
              </Tag>
            </Flex>
          </div>
          <div className={styles.chatSessionChip}>
            <Text type="secondary">Session</Text>
            <strong>{activeChatSession?.id ?? "--"}</strong>
          </div>
        </div>

        {authConfig && !authConfig.apiKeyConfigured ? (
          <Alert
            className={styles.chatAuthAlert}
            type="warning"
            showIcon
            message="当前模型授权尚未配置"
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

          {sending ? (
            <div className={[styles.chatRow, styles.assistantRow].join(" ")}>
              <Avatar className={styles.chatAvatar}>OC</Avatar>
              <div className={[styles.chatBubble, styles.chatBubbleLoading].join(" ")}>
                <Flex align="center" gap={8}>
                  <Spin size="small" />
                  <Text>OpenClaw 正在思考并生成回复</Text>
                </Flex>
              </div>
            </div>
          ) : null}
        </div>

        {error ? (
          <Alert
            className={styles.chatAlert}
            type="error"
            showIcon
            message="当前消息未成功送达 OpenClaw"
            description={error}
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
            disabled={sending}
          />
          <div className={styles.chatComposerFooter}>
            <Text type="secondary">{runtimeMessage}</Text>
            <Button type="primary" size="large" onClick={() => void handleSend()} loading={sending}>
              发送给 OpenClaw
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
