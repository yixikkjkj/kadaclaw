export type ChatRole = "user" | "assistant" | "system";

export type ChatJsonPrimitive = string | number | boolean | null;

export type ChatJsonValue =
  | ChatJsonPrimitive
  | {
      [key: string]: ChatJsonValue;
    }
  | ChatJsonValue[];

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: ChatJsonValue;
  rawContent?: ChatJsonValue;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}
