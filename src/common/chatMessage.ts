import { type ChatJsonValue, type ChatMessage, type ChatRole } from "~/types";

export type ChatMessageDisplayRole = "user" | "assistant" | "system" | "tool";

export type ChatMessageBlock =
  | {
      type: "markdown";
      text: string;
    }
  | {
      type: "thinking";
      text: string;
    }
  | {
      type: "json";
      label: string;
      value: string;
    }
  | {
      type: "tool";
      kind: "call" | "result";
      label: string;
      name: string;
      payload?: string;
    };

export interface NormalizedChatMessage {
  id: string;
  sourceRole: ChatRole;
  displayRole: ChatMessageDisplayRole;
  blocks: ChatMessageBlock[];
  createdAt: string;
  textContent: string;
  rawText: string;
  toolCount: number;
}

const THINKING_PATTERN = /<thinking>([\s\S]*?)<\/thinking>/gi;
const REASONING_DETAILS_PATTERN =
  /<details[^>]*type=["']reasoning["'][^>]*>([\s\S]*?)<\/details>/gi;
const TOOL_STATUS_PATTERN = /^(Calling|Running|Using|Opening)\s+(.+)$/i;
const ESCAPE_CHARACTER = String.fromCharCode(27);
const ANSI_ESCAPE_PATTERN = new RegExp(
  `${ESCAPE_CHARACTER}\\[[0-9;?]*[ -/]*[@-~]`,
  "g",
);
const ANSI_SINGLE_ESCAPE_PATTERN = new RegExp(`${ESCAPE_CHARACTER}[@-_]`, "g");

const TOOL_TYPE_SET = new Set([
  "tool-call",
  "toolcall",
  "tool-result",
  "toolresult",
]);

const THINKING_TYPE_SET = new Set(["thinking", "reasoning"]);
const TEXT_TYPE_SET = new Set([
  "text",
  "output-text",
  "input-text",
  "markdown",
]);
const RESPONSE_ITEM_TYPE_SET = new Set([
  "message",
  "function-call",
  "functioncall",
  "function-call-output",
  "functioncalloutput",
]);

const normalizeText = (value: string) => value.replace(/\r\n/g, "\n").trim();

const normalizeStringValue = (value: unknown) =>
  typeof value === "string" ? normalizeText(value) : "";

const stripHtml = (value: string) =>
  value
    .replace(/<summary[\s\S]*?<\/summary>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const stripTerminalControlSequences = (value: string) =>
  value
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(ANSI_SINGLE_ESCAPE_PATTERN, "");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseJson = (value: string) => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
};

const stringifyBlockValue = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
};

const stringifyStructuredValue = (value: ChatJsonValue | undefined) => {
  if (value === undefined) {
    return "";
  }

  return typeof value === "string"
    ? normalizeText(value)
    : stringifyBlockValue(value);
};

const extractThinking = (value: string) => {
  const thinkingBlocks: string[] = [];
  let visibleText = value;

  visibleText = visibleText.replace(
    THINKING_PATTERN,
    (_match, content: string) => {
      const normalized = normalizeText(content);
      if (normalized) {
        thinkingBlocks.push(normalized);
      }

      return "\n";
    },
  );

  visibleText = visibleText.replace(
    REASONING_DETAILS_PATTERN,
    (_match, content: string) => {
      const normalized = normalizeText(stripHtml(content));
      if (normalized) {
        thinkingBlocks.push(normalized);
      }

      return "\n";
    },
  );

  return {
    thinkingBlocks,
    visibleText: normalizeText(visibleText),
  };
};

const appendTextBlock = (blocks: ChatMessageBlock[], value: string) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return;
  }

  const jsonValue = parseJson(normalized);
  if (jsonValue && (Array.isArray(jsonValue) || isRecord(jsonValue))) {
    blocks.push({
      type: "json",
      label: "JSON",
      value: stringifyBlockValue(jsonValue),
    });
    return;
  }

  const { thinkingBlocks, visibleText } = extractThinking(normalized);

  thinkingBlocks.forEach((thinking) => {
    blocks.push({
      type: "thinking",
      text: thinking,
    });
  });

  if (visibleText) {
    blocks.push({
      type: "markdown",
      text: visibleText,
    });
  }
};

const resolveToolName = (value: Record<string, unknown>) => {
  if (typeof value.name === "string" && value.name.trim()) {
    return value.name.trim();
  }

  if (typeof value.toolName === "string" && value.toolName.trim()) {
    return value.toolName.trim();
  }

  if (typeof value.tool === "string" && value.tool.trim()) {
    return value.tool.trim();
  }

  if (isRecord(value.function) && typeof value.function.name === "string") {
    return value.function.name;
  }

  return "Unnamed Tool";
};

const resolveToolPayload = (value: Record<string, unknown>) => {
  const candidates = [
    value.arguments,
    value.args,
    value.input,
    value.result,
    value.output,
    value.data,
    isRecord(value.function) ? value.function.arguments : undefined,
  ];

  const payload = candidates.find(
    (candidate) => candidate !== undefined && candidate !== null,
  );
  return payload === undefined ? undefined : stringifyBlockValue(payload);
};

const appendStructuredItem = (blocks: ChatMessageBlock[], item: unknown) => {
  if (typeof item === "string") {
    appendTextBlock(blocks, item);
    return;
  }

  if (!isRecord(item)) {
    return;
  }

  const rawType = typeof item.type === "string" ? item.type.trim() : "";
  const normalizedType = rawType.replace(/_/g, "-").toLowerCase();

  if (
    normalizedType === "message" &&
    (Array.isArray(item.content) || isRecord(item.content))
  ) {
    extractStructuredBlocks(item.content)?.forEach((block) => {
      blocks.push(block);
    });
    return;
  }

  if (TEXT_TYPE_SET.has(normalizedType) && typeof item.text === "string") {
    appendTextBlock(blocks, item.text);
    return;
  }

  if (THINKING_TYPE_SET.has(normalizedType) && typeof item.text === "string") {
    blocks.push({
      type: "thinking",
      text: normalizeText(item.text),
    });
    return;
  }

  if (TOOL_TYPE_SET.has(normalizedType)) {
    blocks.push({
      type: "tool",
      kind: normalizedType.includes("result") ? "result" : "call",
      label: normalizedType.includes("result") ? "Tool Result" : "Tool Call",
      name: resolveToolName(item),
      payload: resolveToolPayload(item),
    });
    return;
  }

  if (normalizedType === "function-call" || normalizedType === "functioncall") {
    blocks.push({
      type: "tool",
      kind: "call",
      label: "Tool Call",
      name: resolveToolName(item),
      payload: resolveToolPayload(item),
    });
    return;
  }

  if (
    normalizedType === "function-call-output" ||
    normalizedType === "functioncalloutput"
  ) {
    blocks.push({
      type: "tool",
      kind: "result",
      label: "Tool Result",
      name: resolveToolName(item),
      payload: resolveToolPayload(item),
    });
    return;
  }

  if (isRecord(item.content) || Array.isArray(item.content)) {
    extractStructuredBlocks(item.content)?.forEach((block) => {
      blocks.push(block);
    });
    return;
  }

  if (typeof item.text === "string") {
    appendTextBlock(blocks, item.text);
    return;
  }

  blocks.push({
    type: "json",
    label: rawType ? rawType.replace(/[_-]/g, " ") : "Block",
    value: stringifyBlockValue(item),
  });
};

const extractStructuredBlocks = (value: unknown): ChatMessageBlock[] | null => {
  const items = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.content)
      ? value.content
      : isRecord(value) && Array.isArray(value.output)
        ? value.output
        : null;

  if (!items) {
    return null;
  }

  const blocks: ChatMessageBlock[] = [];
  items.forEach((item) => {
    appendStructuredItem(blocks, item);
  });

  return blocks.length > 0 ? blocks : null;
};

const extractToolStatusBlocks = (value: string) => {
  const blocks: ChatMessageBlock[] = [];

  value.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    const matched = trimmed.match(TOOL_STATUS_PATTERN);
    if (!matched) {
      return;
    }

    blocks.push({
      type: "tool",
      kind: matched[1].toLowerCase() === "calling" ? "call" : "result",
      label: matched[1],
      name: matched[2],
    });
  });

  return blocks;
};

const looksLikeStructuredResponse = (value: unknown) =>
  isRecord(value) &&
  Array.isArray(value.output) &&
  value.output.some(
    (item) =>
      isRecord(item) &&
      typeof item.type === "string" &&
      RESPONSE_ITEM_TYPE_SET.has(item.type.replace(/_/g, "-").toLowerCase()),
  );

const resolveDisplayRole = (
  message: ChatMessage,
  blocks: ChatMessageBlock[],
): ChatMessageDisplayRole => {
  if (message.role === "user" || message.role === "system") {
    return message.role;
  }

  const hasToolBlock = blocks.some((block) => block.type === "tool");
  const hasVisibleText = blocks.some(
    (block) => block.type === "markdown" || block.type === "thinking",
  );

  if (hasToolBlock && !hasVisibleText) {
    return "tool";
  }

  return "assistant";
};

const getBlockCopyText = (block: ChatMessageBlock) => {
  if (block.type === "markdown") {
    return block.text;
  }

  if (block.type === "json") {
    return `${block.label}\n${block.value}`;
  }

  if (block.type === "thinking") {
    return block.text;
  }

  return "";
};

export const getNormalizedChatMessageCopyText = (
  message: NormalizedChatMessage,
) =>
  message.blocks
    .map((block) => getBlockCopyText(block))
    .filter(Boolean)
    .join("\n\n")
    .trim();

export const normalizeChatMessage = (
  message: ChatMessage,
): NormalizedChatMessage => {
  let blocks: ChatMessageBlock[] = [];
  const structuredSource = message.rawContent ?? message.content;
  const sourceText = normalizeStringValue(structuredSource);

  if (isRecord(structuredSource) || Array.isArray(structuredSource)) {
    const structuredBlocks = extractStructuredBlocks(structuredSource);
    if (structuredBlocks) {
      blocks = structuredBlocks;
    } else {
      blocks = [
        {
          type: "json",
          label: "JSON",
          value: stringifyBlockValue(structuredSource),
        },
      ];
    }
  } else if (sourceText) {
    const parsedJson = parseJson(sourceText);
    if (parsedJson) {
      const structuredBlocks = extractStructuredBlocks(parsedJson);
      if (structuredBlocks) {
        blocks = structuredBlocks;
      } else if (
        looksLikeStructuredResponse(parsedJson) ||
        Array.isArray(parsedJson) ||
        isRecord(parsedJson)
      ) {
        blocks = [
          {
            type: "json",
            label: "JSON",
            value: stringifyBlockValue(parsedJson),
          },
        ];
      }
    }

    if (blocks.length === 0) {
      const normalizedPlainText = stripTerminalControlSequences(
        sourceText,
      ).replace(/\r/g, "");
      const toolStatusBlocks = extractToolStatusBlocks(normalizedPlainText);
      const visibleText = normalizedPlainText
        .split("\n")
        .filter((line) => !TOOL_STATUS_PATTERN.test(line.trim()))
        .join("\n");

      blocks.push(...toolStatusBlocks);
      appendTextBlock(blocks, visibleText);
    }
  }

  if (blocks.length === 0) {
    const contentText = normalizeStringValue(message.content);
    if (contentText) {
      appendTextBlock(blocks, contentText);
    }
  }

  const displayRole = resolveDisplayRole(message, blocks);
  const rawText = stringifyStructuredValue(
    structuredSource as ChatJsonValue | undefined,
  );
  const toolCount = blocks.filter((block) => block.type === "tool").length;
  const textContent = getNormalizedChatMessageCopyText({
    id: message.id,
    sourceRole: message.role,
    displayRole,
    blocks,
    createdAt: message.createdAt,
    textContent: "",
    rawText,
    toolCount,
  });

  return {
    id: message.id,
    sourceRole: message.role,
    displayRole,
    blocks,
    createdAt: message.createdAt,
    textContent,
    rawText,
    toolCount,
  };
};

export const getChatRoleLabel = (role: ChatMessageDisplayRole) => {
  if (role === "user") {
    return "You";
  }

  if (role === "assistant") {
    return "Assistant";
  }

  if (role === "tool") {
    return "Tool";
  }

  return "System";
};
