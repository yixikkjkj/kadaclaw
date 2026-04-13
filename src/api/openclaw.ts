import { invoke } from "@tauri-apps/api/core";
import { type ChatJsonValue } from "~/types";

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
  versionError?: string | null;
  commandPath: string;
  installDir: string;
  skillsDir: string;
  localSkillsDirs: string[];
}

export interface OpenClawLocalSkillsDirsConfig {
  directories: string[];
}

export interface OpenClawSelfCheckItem {
  key: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  suggestion?: string | null;
}

export interface OpenClawSelfCheckResult {
  runtimeInfo: RuntimeInfoResult;
  runtimeStatus: OpenClawStatus;
  checkedAt: number;
  items: OpenClawSelfCheckItem[];
}

export interface OpenClawAuthConfig {
  provider: string;
  model: string;
  apiKeyEnvName: string;
  apiKeyConfigured: boolean;
  apiBaseUrl?: string | null;
}

export interface SaveOpenClawAuthPayload {
  provider: string;
  model: string;
  apiKey: string;
  apiBaseUrl?: string;
}

export interface SendOpenClawMessagePayload {
  message: string;
  sessionId?: string;
  thinking?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
}

export interface OpenClawChatResponse {
  sessionId: string;
  reply: string;
  rawOutput: ChatJsonValue;
}

export interface OpenClawChatStreamSnapshot {
  sessionId: string;
  status: string;
  reply: string;
  rawOutput: ChatJsonValue;
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

export function openOpenClawDashboard() {
  return invoke<DashboardUrlResult>("open_openclaw_dashboard");
}

export function getOpenClawRuntimeInfo() {
  return invoke<RuntimeInfoResult>("get_openclaw_runtime_info");
}

export function runOpenClawSelfCheck() {
  return invoke<OpenClawSelfCheckResult>("run_openclaw_self_check");
}

export function upgradeBundledOpenClawRuntime() {
  return invoke<InstallOpenClawResult>("upgrade_bundled_openclaw_runtime");
}

export function getOpenClawAuthConfig() {
  return invoke<OpenClawAuthConfig>("get_openclaw_auth_config");
}

export function getOpenClawLocalSkillsDirs() {
  return invoke<OpenClawLocalSkillsDirsConfig>("get_openclaw_local_skills_dirs");
}

export function pickOpenClawLocalSkillsDir() {
  return invoke<string | null>("pick_openclaw_local_skills_dir");
}

export function saveOpenClawAuthConfig(payload: SaveOpenClawAuthPayload) {
  return invoke<OpenClawAuthConfig>("save_openclaw_auth_config", { payload });
}

export function saveOpenClawLocalSkillsDirs(directories: string[]) {
  return invoke<OpenClawLocalSkillsDirsConfig>("save_openclaw_local_skills_dirs", {
    payload: {
      directories,
    },
  });
}

export function sendOpenClawMessage(payload: SendOpenClawMessagePayload) {
  return invoke<OpenClawChatResponse>("send_openclaw_message", { payload });
}

export function stopOpenClawMessage() {
  return invoke<boolean>("stop_openclaw_message");
}

export function getOpenClawActiveStream() {
  return invoke<OpenClawChatStreamSnapshot | null>("get_openclaw_active_stream");
}
