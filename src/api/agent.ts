import { Channel, invoke } from "@tauri-apps/api/core";

// ── Agent stream events (mirrors Rust AgentStreamEvent) ──────────────────────

export type AgentStreamEvent =
  | { type: "text_delta"; delta: string }
  | { type: "tool_call_start"; id: string; name: string; args: string }
  | { type: "tool_call_result"; id: string; name: string; result: string }
  | { type: "done"; finish_reason: string }
  | { type: "error"; message: string };

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

export interface McpServerConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
  startupTimeoutSecs?: number | null;
  callTimeoutSecs?: number | null;
  enabled: boolean;
}

export interface AgentConfig {
  providers: Record<string, ProviderConfig>;
  activeProvider: string;
  systemPrompt: string;
  maxToolRounds: number;
  enabledTools: string[];
  webSearch: WebSearchConfig;
  browser: BrowserConfig;
  mcpServers: Record<string, McpServerConfig>;
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
