import { Channel, invoke } from "@tauri-apps/api/core";

// ── Agent stream events (mirrors Rust AgentStreamEvent) ──────────────────────

export type AgentStreamEvent =
  | { type: "text_delta"; delta: string }
  | { type: "tool_call_start"; id: string; name: string; args: string }
  | {
      type: "tool_call_result";
      id: string;
      name: string;
      result: string;
      duration_ms: number;
      success: boolean;
    }
  | { type: "done"; finish_reason: string }
  | { type: "error"; message: string }
  | {
      type: "token_usage";
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };

// ── Provider / Agent config ───────────────────────────────────────────────────

export interface ProviderConfig {
  apiKey?: string | null;
  apiBase?: string | null;
  model: string;
}

export interface WebSearchConfig {
  provider: string;
  tavilyApiKey?: string | null;
}

export interface BrowserConfig {
  chromeExecutable?: string | null;
  connectTimeoutSecs: number;
  cdpPort: number;
}

export interface McpServerConfigStdio {
  type: "stdio";
  command: string;
  args: string[];
  env: Record<string, string>;
  autoStart: boolean;
  enabled: boolean;
  callTimeoutSecs: number;
  startupTimeoutSecs: number;
}

export interface McpServerConfigHttp {
  type: "http";
  url: string;
  headers: Record<string, string>;
  enabled: boolean;
  callTimeoutSecs: number;
}

export type McpServerConfig = McpServerConfigStdio | McpServerConfigHttp;

export interface AgentConfig {
  providers: Record<string, ProviderConfig>;
  activeProvider: string;
  systemPrompt: string;
  maxToolRounds: number;
  enabledTools: string[];
  webSearch: WebSearchConfig;
  browser: BrowserConfig;
  mcpServers: Record<string, McpServerConfig>;
  tokenBudget: number;
  compactThreshold: number;
}

// ── API functions ─────────────────────────────────────────────────────────────

export function getAgentConfig() {
  return invoke<AgentConfig>("get_agent_config");
}

export function saveAgentConfig(config: AgentConfig) {
  return invoke<AgentConfig>("save_agent_config", { config });
}

export function listConfiguredProviders() {
  return invoke<string[]>("list_configured_providers");
}

export function listAvailableTools() {
  return invoke<string[]>("list_available_tools");
}

export function restartMcpServer(serverId: string) {
  return invoke<void>("restart_mcp_server", { serverId });
}

export function getMcpServerStatus() {
  return invoke<Record<string, boolean>>("get_mcp_server_status");
}

// ── Telemetry ─────────────────────────────────────────────────────────────────

export interface SessionStats {
  sessionId: string;
  promptTokens: number;
  completionTokens: number;
  toolCalls: number;
  toolErrors: number;
  messages: number;
}

export interface UsageStats {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalToolCalls: number;
  totalToolErrors: number;
  totalMessages: number;
  sessions: Record<string, SessionStats>;
}

export function getUsageStats() {
  return invoke<UsageStats>("get_usage_stats");
}

/**
 * Send a message to the agent and stream events via Tauri Channel.
 * Returns a cleanup function that resolves when the stream is done.
 */
export function sendMessage(
  message: string,
  sessionId: string | null,
  onEvent: (event: AgentStreamEvent) => void,
): Promise<void> {
  const channel = new Channel<AgentStreamEvent>();
  channel.onmessage = onEvent;
  return invoke<void>("send_message", {
    message,
    sessionId,
    channel,
  });
}

export function stopMessage() {
  return invoke<boolean>("stop_message");
}
