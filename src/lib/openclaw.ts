import { invoke } from "@tauri-apps/api/core";

export interface OpenClawConfig {
  enabled: boolean;
  displayName: string;
  baseUrl: string;
  healthPath: string;
  model: string;
  command: string;
  args: string[];
  workingDirectory: string;
}

export interface OpenClawStatus {
  configured: boolean;
  bundled: boolean;
  executableFound: boolean;
  reachable: boolean;
  launchable: boolean;
  endpoint: string;
  commandPath: string;
  message: string;
  httpStatus?: number | null;
}

export interface InstallOpenClawResult {
  prefix: string;
  config: OpenClawConfig;
  status: OpenClawStatus;
}

export interface DashboardUrlResult {
  url: string;
}

export interface RuntimeInfoResult {
  installed: boolean;
  bundled: boolean;
  version: string;
  commandPath: string;
  installDir: string;
  skillsDir: string;
}

export interface OpenClawAuthConfig {
  provider: string;
  model: string;
  apiKeyEnvName: string;
  apiKeyConfigured: boolean;
}

export interface SaveOpenClawAuthPayload {
  provider: string;
  model: string;
  apiKey: string;
}

export interface SendOpenClawMessagePayload {
  message: string;
  sessionId?: string;
  thinking?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
}

export interface OpenClawChatResponse {
  sessionId: string;
  reply: string;
  rawOutput: string;
}

export function getOpenClawConfig() {
  return invoke<OpenClawConfig>("get_openclaw_config");
}

export function saveOpenClawConfig(payload: OpenClawConfig) {
  return invoke<OpenClawConfig>("save_openclaw_config", { payload });
}

export function probeOpenClawRuntime() {
  return invoke<OpenClawStatus>("probe_openclaw_runtime");
}

export function launchOpenClawRuntime() {
  return invoke<OpenClawStatus>("launch_openclaw_runtime");
}

export function ensureOpenClawRuntime() {
  return invoke<OpenClawStatus>("ensure_openclaw_runtime");
}

export function installBundledOpenClawRuntime() {
  return invoke<InstallOpenClawResult>("install_bundled_openclaw_runtime");
}

export function getOpenClawDashboardUrl() {
  return invoke<DashboardUrlResult>("get_openclaw_dashboard_url");
}

export function getOpenClawRuntimeInfo() {
  return invoke<RuntimeInfoResult>("get_openclaw_runtime_info");
}

export function upgradeBundledOpenClawRuntime() {
  return invoke<InstallOpenClawResult>("upgrade_bundled_openclaw_runtime");
}

export function getOpenClawAuthConfig() {
  return invoke<OpenClawAuthConfig>("get_openclaw_auth_config");
}

export function saveOpenClawAuthConfig(payload: SaveOpenClawAuthPayload) {
  return invoke<OpenClawAuthConfig>("save_openclaw_auth_config", { payload });
}

export function sendOpenClawMessage(payload: SendOpenClawMessagePayload) {
  return invoke<OpenClawChatResponse>("send_openclaw_message", { payload });
}
