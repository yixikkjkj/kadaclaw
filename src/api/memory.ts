import { invoke } from "@tauri-apps/api/core";

export type MemoryType =
  | "fact"
  | "preference"
  | "project"
  | "task"
  | "glossary"
  | "contact"
  | "snippet"
  | "policy"
  | "note"
  | "session_summary";

export type MemoryScope = "long_term" | "short_term";

export interface MemoryEntry {
  id: string;
  memory_type: MemoryType;
  scope: MemoryScope;
  content: string;
  tags: string;
  session_id: string | null;
  importance: number;
  access_count: number;
  deleted: boolean;
  created_at: string;
  accessed_at: string;
}

export function listMemories(query?: string) {
  return invoke<MemoryEntry[]>("list_memories", { query: query ?? null });
}

export function updateMemory(id: string, content: string) {
  return invoke<boolean>("update_memory", { id, content });
}

export function deleteMemory(id: string) {
  return invoke<boolean>("delete_memory", { id });
}

export function clearAllMemories() {
  return invoke<boolean>("clear_all_memories");
}
