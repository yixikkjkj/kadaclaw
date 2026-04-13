import { CopyOutlined, EyeInvisibleOutlined, ToolOutlined } from "@ant-design/icons";
import { Button, message as antMessage, Tooltip, Typography } from "antd";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { type ChatMessageBlock, type NormalizedChatMessage } from "~/common/chatMessage";
import styles from "./index.css";

const { Text } = Typography;

const renderMarkdown = (value: string) =>
  DOMPurify.sanitize(marked.parse(value, { async: false, breaks: true, gfm: true }) as string);

const copyToClipboard = async (value: string, successText: string) => {
  const content = value.trim();
  if (!content) {
    antMessage.info("没有可复制的内容");
    return;
  }

  try {
    await navigator.clipboard.writeText(content);
    antMessage.success(successText);
  } catch {
    antMessage.error("复制失败");
  }
};

const buildJsonSummary = (value: string) => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return `JSON Array (${parsed.length})`;
    }

    if (parsed && typeof parsed === "object") {
      const keys = Object.keys(parsed as Record<string, unknown>);
      if (keys.length <= 4) {
        return `JSON { ${keys.join(", ")} }`;
      }

      return `JSON Object (${keys.length} keys)`;
    }
  } catch {}

  return "JSON";
};

const renderContentBlock = (messageId: string, block: Exclude<ChatMessageBlock, { type: "tool" }>, index: number) => {
  const key = `${messageId}-${block.type}-${index}`;

  if (block.type === "markdown") {
    return (
      <div
        key={key}
        className={styles.textBlock}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(block.text) }}
      />
    );
  }

  if (block.type === "thinking") {
    return (
      <details key={key} className={styles.thinkingCollapse}>
        <summary className={styles.collapseSummary}>
          <span className={styles.collapseTitle}>
            <EyeInvisibleOutlined />
            Reasoning
          </span>
        </summary>
        <div
          className={styles.thinkingBody}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(block.text) }}
        />
      </details>
    );
  }

  return (
    <details key={key} className={styles.jsonCollapse}>
      <summary className={styles.collapseSummary}>
        <span className={styles.collapseTitle}>{buildJsonSummary(block.value)}</span>
      </summary>
      <pre className={styles.codeBlock}>{block.value}</pre>
    </details>
  );
};

const renderToolCard = (messageId: string, block: Extract<ChatMessageBlock, { type: "tool" }>, index: number) => (
  <section key={`${messageId}-tool-${index}`} className={styles.toolCard}>
    <div className={styles.toolHeader}>
      <span className={styles.toolTitle}>
        <ToolOutlined />
        {block.name}
      </span>
      <Text className={styles.toolKind}>{block.kind === "call" ? "Call" : "Result"}</Text>
    </div>
    <Text className={styles.toolLabel}>{block.label}</Text>
    {block.payload ? <pre className={styles.toolPayload}>{block.payload}</pre> : null}
  </section>
);

interface ChatMessageContentProps {
  message: NormalizedChatMessage;
  streaming?: boolean;
  statusText?: string;
}

export const ChatMessageContent = ({
  message,
  streaming = false,
  statusText,
}: ChatMessageContentProps) => {
  const contentBlocks = message.blocks.filter(
    (block): block is Exclude<ChatMessageBlock, { type: "tool" }> => block.type !== "tool",
  );
  const toolBlocks = message.blocks.filter(
    (block): block is Extract<ChatMessageBlock, { type: "tool" }> => block.type === "tool",
  );
  const toolNames = Array.from(new Set(toolBlocks.map((block) => block.name)));
  const toolSummary =
    toolNames.length <= 3
      ? toolNames.join(", ")
      : `${toolNames.slice(0, 2).join(", ")} +${toolNames.length - 2} more`;
  const hasVisibleText = contentBlocks.some((block) => block.type === "markdown");
  const hasVisibleContent = contentBlocks.length > 0;

  return (
    <div className={styles.messageContent}>
      {(message.textContent || message.rawText) && !streaming ? (
        <div className={styles.bubbleActions}>
          {message.textContent ? (
            <Tooltip title="复制正文">
              <Button
                type="text"
                size="small"
                className={styles.iconButton}
                icon={<CopyOutlined />}
                onClick={() => void copyToClipboard(message.textContent, "消息正文已复制")}
              />
            </Tooltip>
          ) : null}
          {message.rawText && message.rawText !== message.textContent ? (
            <Tooltip title="复制原始消息">
              <Button
                type="text"
                size="small"
                className={styles.iconButton}
                icon={<ToolOutlined />}
                onClick={() => void copyToClipboard(message.rawText, "原始消息已复制")}
              />
            </Tooltip>
          ) : null}
        </div>
      ) : null}

      {streaming ? (
        <div className={styles.streamingStatus}>
          <span className={styles.streamingDot} />
          <Text className={styles.streamingLabel}>{statusText || "正在执行"}</Text>
        </div>
      ) : null}

      {hasVisibleContent ? contentBlocks.map((block, index) => renderContentBlock(message.id, block, index)) : null}

      {!hasVisibleContent && toolBlocks.length > 0 ? (
        <details className={styles.toolMessageCollapse} open={streaming}>
          <summary className={styles.collapseSummary}>
            <span className={styles.collapseTitle}>
              <ToolOutlined />
              Tool output
            </span>
            <Text className={styles.collapseMeta}>{toolSummary}</Text>
          </summary>
          <div className={styles.toolList}>
            {toolBlocks.map((block, index) => renderToolCard(message.id, block, index))}
          </div>
        </details>
      ) : null}

      {hasVisibleContent && toolBlocks.length > 0 ? (
        <details className={styles.toolTraceCollapse}>
          <summary className={styles.collapseSummary}>
            <span className={styles.collapseTitle}>
              <ToolOutlined />
              {toolBlocks.length} tool{toolBlocks.length > 1 ? "s" : ""}
            </span>
            <Text className={styles.collapseMeta}>{toolSummary}</Text>
          </summary>
          <div className={styles.toolList}>
            {toolBlocks.map((block, index) => renderToolCard(message.id, block, index))}
          </div>
        </details>
      ) : null}

      {streaming && !hasVisibleText && toolBlocks.length === 0 ? (
        <Text className={styles.streamingPlaceholder}>等待正文输出，当前可能正在调用工具。</Text>
      ) : null}
    </div>
  );
};
