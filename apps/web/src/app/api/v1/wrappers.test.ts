import { describe, expect, it } from "vitest";

const modules = [
  { path: "./account/route", methods: ["PATCH"] },
  { path: "./ai/route", methods: ["POST"] },
  { path: "./auth/route", methods: ["POST"] },
  { path: "./care/route", methods: ["GET", "POST"] },
  { path: "./care-schedule/route", methods: ["GET", "POST", "PATCH"] },
  { path: "./conversations/route", methods: ["GET"] },
  { path: "./dashboard/route", methods: ["GET"] },
  { path: "./family/route", methods: ["GET", "POST"] },
  { path: "./notifications/route", methods: ["GET", "PATCH"] },
  { path: "./notifications/devices/route", methods: ["PATCH"] },
  { path: "./onboarding/route", methods: ["GET", "POST"] },
  { path: "./schedule-assignments/route", methods: ["GET", "POST"] },
  { path: "./supply/route", methods: ["GET", "POST", "PATCH", "DELETE"] },
  { path: "./tasks/route", methods: ["GET"] },
] as const;

describe("v1 API wrappers", () => {
  it.each(modules.flatMap((mod) => mod.methods.map((method) => [mod.path, method] as const)))(
    "wraps %s %s and rejects an unauthenticated request",
    async (path, method) => {
      const route = await import(/* @vite-ignore */ path);
      const handler = route[method] as (request: Request) => Promise<Response>;
      const needsBody = method === "POST" || method === "PATCH" || method === "DELETE";
      const request = new Request("http://localhost/api/v1/probe", {
        method,
        ...(needsBody
          ? {
              headers: { "content-type": "application/json" },
              body: JSON.stringify({}),
            }
          : {}),
      });

      const response = await handler(request);

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.headers.get("X-API-Version")).toBe("v1");
    },
  );
});
