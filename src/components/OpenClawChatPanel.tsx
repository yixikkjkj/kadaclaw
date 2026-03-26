import { Alert, Avatar, Button, Card, Input, Space, Spin, Tag, Typography } from "antd";
import { useEffect, useRef, useState } from "react";
import { getOpenClawAuthConfig, sendOpenClawMessage, type OpenClawAuthConfig } from "../lib/openclaw";
import { useAppStore } from "../store/appStore";

const { Paragraph, Text, Title } = Typography;

function buildMessageId(role: "user" | "assistant" | "system") {
  return `${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function OpenClawChatPanel() {
  const runtimeStatus = useAppStore((state) => state.runtimeStatus);
  const runtimeMessage = useAppStore((state) => state.runtimeMessage);
  const chatSessionId = useAppStore((state) => state.chatSessionId);
  const chatMessages = useAppStore((state) => state.chatMessages);
  const setChatSessionId = useAppStore((state) => state.setChatSessionId);
  const appendChatMessage = useAppStore((state) => state.appendChatMessage);
  const resetChatSession = useAppStore((state) => state.resetChatSession);
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
  }, [chatMessages, sending, error]);

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

    appendChatMessage({
      id: buildMessageId("user"),
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    });
    setInput("");
    setError(null);
    setSending(true);

    try {
      const result = await sendOpenClawMessage({
        sessionId: chatSessionId,
        message,
      });
      setChatSessionId(result.sessionId);
      appendChatMessage({
        id: buildMessageId("assistant"),
        role: "assistant",
        content: result.reply || "OpenClaw 未返回可显示内容。",
        createdAt: new Date().toISOString(),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "发送失败，请检查 OpenClaw runtime 和模型授权。");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card
      className="panel-card chat-shell"
      title="和 OpenClaw 聊天"
      extra={
        <Space size={10}>
          <Tag color={runtimeStatus === "ready" ? "green" : "orange"}>
            {runtimeStatus === "ready" ? "Runtime 在线" : "等待连接"}
          </Tag>
          <Button onClick={resetChatSession}>新会话</Button>
        </Space>
      }
    >
      <div className="chat-panel">
        <div className="chat-panel-head">
          <div>
            <Title level={4}>主会话窗口</Title>
            <Paragraph type="secondary">
              这里直接调用本地 OpenClaw agent，会话 ID 会持续复用，保持上下文连续。
            </Paragraph>
            <Space size={[8, 8]} wrap>
              <Tag color="blue">{authConfig?.provider ?? "provider 未知"}</Tag>
              <Tag>{authConfig?.model ?? "模型未配置"}</Tag>
              <Tag color={authConfig?.apiKeyConfigured ? "green" : "orange"}>
                {authConfig?.apiKeyConfigured ? "授权已配置" : "授权未配置"}
              </Tag>
            </Space>
          </div>
          <div className="chat-session-chip">
            <Text type="secondary">Session</Text>
            <strong>{chatSessionId}</strong>
          </div>
        </div>

        {authConfig && !authConfig.apiKeyConfigured ? (
          <Alert
            className="chat-auth-alert"
            type="warning"
            showIcon
            message="当前模型授权尚未配置"
            description={`OpenClaw 当前使用 ${authConfig.model}，需要在设置页补充 ${authConfig.apiKeyEnvName}。`}
          />
        ) : null}

        <div className="chat-message-list" ref={scrollRef}>
          {chatMessages.map((message) => (
            <div key={message.id} className={`chat-row ${message.role}`}>
              <Avatar className="chat-avatar">
                {message.role === "user" ? "你" : message.role === "assistant" ? "OC" : "!"}
              </Avatar>
              <div className="chat-bubble">
                <div className="chat-meta">
                  <Text type="secondary">
                    {message.role === "user"
                      ? "你"
                      : message.role === "assistant"
                        ? "OpenClaw"
                        : "系统"}
                  </Text>
                </div>
                <Paragraph className="chat-content">{message.content}</Paragraph>
              </div>
            </div>
          ))}

          {sending ? (
            <div className="chat-row assistant">
              <Avatar className="chat-avatar">OC</Avatar>
              <div className="chat-bubble chat-bubble-loading">
                <Space>
                  <Spin size="small" />
                  <Text>OpenClaw 正在思考并生成回复</Text>
                </Space>
              </div>
            </div>
          ) : null}
        </div>

        {error ? (
          <Alert
            className="chat-alert"
            type="error"
            showIcon
            message="当前消息未成功送达 OpenClaw"
            description={error}
          />
        ) : null}

        <div className="chat-composer">
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
          <div className="chat-composer-footer">
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
