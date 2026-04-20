import { Badge } from "antd";
import dayjs from "dayjs";
import { type OpenClawConfig } from "~/api";

export interface OpenClawFormValues extends Omit<OpenClawConfig, "args"> {
  args: string;
}

export interface OpenClawAuthFormValues {
  provider: string;
  model: string;
  apiKey: string;
  apiBaseUrl: string;
}

export type SelfCheckState = "pass" | "warn" | "fail";

export const isWindowsHost = () =>
  typeof navigator !== "undefined" && /windows/i.test(navigator.userAgent);

export const getSelfCheckBadge = (state: SelfCheckState) => {
  switch (state) {
    case "pass":
      return <Badge status="success" text="通过" />;
    case "warn":
      return <Badge status="processing" text="待确认" />;
    case "fail":
    default:
      return <Badge status="error" text="失败" />;
  }
};

export const formatCheckTime = (value?: number | null) => {
  if (!value) {
    return "尚未执行";
  }

  return dayjs(value).format("YYYY/M/D HH:mm:ss");
};

export const parseLocalSkillsDirsInput = (value: string) =>
  Array.from(
    new Set(
      value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
