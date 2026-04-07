export const ROUTE_PATHS = {
  chat: "/chat",
  skills: "/skills",
  installed: "/installed",
  settings: "/settings",
} as const;

export type AppRoutePath = (typeof ROUTE_PATHS)[keyof typeof ROUTE_PATHS];

export interface OpenClawProviderOption {
  label: string;
  value: string;
  env: string;
  model: string;
}

export const OPENCLAW_PROVIDER_OPTIONS: OpenClawProviderOption[] = [
  {
    label: "Anthropic",
    value: "anthropic",
    env: "ANTHROPIC_API_KEY",
    model: "anthropic/claude-opus-4-6",
  },
  {
    label: "Custom Provider",
    value: "custom",
    env: "OPENAI_API_KEY",
    model: "openai/gpt-5.2",
  },
  {
    label: "OpenAI",
    value: "openai",
    env: "OPENAI_API_KEY",
    model: "openai/gpt-5.2",
  },
  {
    label: "OpenRouter",
    value: "openrouter",
    env: "OPENROUTER_API_KEY",
    model: "openrouter/openai/gpt-5.2",
  },
  {
    label: "DeepSeek",
    value: "deepseek",
    env: "DEEPSEEK_API_KEY",
    model: "deepseek/deepseek-chat",
  },
  {
    label: "Google",
    value: "google",
    env: "GEMINI_API_KEY",
    model: "google/gemini-2.5-pro",
  },
];
