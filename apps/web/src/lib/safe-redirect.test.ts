import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it.each(["/dashboard", "/family?household=123", "/auth/sign-in#account"])(
    "allows internal paths: %s",
    (path) => {
      expect(safeRedirectPath(path)).toBe(path);
    },
  );

  it.each([
    undefined,
    "",
    "dashboard",
    "https://example.com",
    "//example.com",
    "/\\example.com",
  ])("uses the fallback for unsafe paths: %s", (path) => {
    expect(safeRedirectPath(path, "/safe")).toBe("/safe");
  });
});
