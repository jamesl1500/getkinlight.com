export function safeRedirectPath(
  value: string | undefined,
  fallback = "/dashboard",
) {
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
    ? value
    : fallback;
}
