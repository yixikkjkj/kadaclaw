export const getErrorMessage = (reason: unknown, fallback: string) => {
  if (reason instanceof Error && reason.message.trim()) {
    return reason.message.trim();
  }
  if (typeof reason === "string" && reason.trim()) {
    return reason.trim();
  }
  return fallback;
};

export type WindowPlatform = "mac" | "windows" | "other";

export const getWindowPlatform = (): WindowPlatform => {
  if (/mac|iphone|ipad/i.test(navigator?.userAgent)) {
    return "mac";
  }

  if (/windows/i.test(navigator?.userAgent)) {
    return "windows";
  }

  return "other";
};
