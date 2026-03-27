export function getErrorMessage(reason: unknown, fallback: string) {
  if (reason instanceof Error && reason.message.trim()) {
    return reason.message.trim();
  }
  if (typeof reason === "string" && reason.trim()) {
    return reason.trim();
  }
  return fallback;
}
