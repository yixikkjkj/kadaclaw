export const ROUTE_PATHS = {
  chat: "/chat",
  skills: "/skills",
  installed: "/installed",
  settings: "/settings",
} as const;

export type AppRoutePath = (typeof ROUTE_PATHS)[keyof typeof ROUTE_PATHS];
