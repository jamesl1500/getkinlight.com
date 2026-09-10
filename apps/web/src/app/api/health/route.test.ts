import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe("health API route", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("reports healthy when Supabase env vars are configured", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
    vi.resetModules();
    const { GET } = await import("./route");

    const response = GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      service: "kinlight-web",
    });
  });

  it("reports unhealthy when Supabase env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    vi.resetModules();
    const { GET } = await import("./route");

    const response = GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      service: "kinlight-web",
    });
  });
});
