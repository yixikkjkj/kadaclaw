export const ROUTE_PATHS = {
  chat: "/chat",
  skills: "/skills",
  installed: "/installed",
  settings: "/settings",
  memory: "/memory",
  tasks: "/tasks",
} as const;

export type AppRoutePath = (typeof ROUTE_PATHS)[keyof typeof ROUTE_PATHS];

export const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful AI assistant. Use the available tools when needed to answer questions and complete tasks.";

