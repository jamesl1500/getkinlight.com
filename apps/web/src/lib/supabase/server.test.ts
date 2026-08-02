import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  createServerClient: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

import { createKinlightServerComponentClient } from "./server";

describe("createKinlightServerComponentClient", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable";
    mocks.createServerClient.mockReset().mockReturnValue({ client: true });
  });

  it("forwards cookie reads and writes", async () => {
    const store = {
      getAll: vi.fn(() => [{ name: "session", value: "value" }]),
      set: vi.fn(),
    };
    mocks.cookies.mockResolvedValue(store);
    await expect(createKinlightServerComponentClient()).resolves.toEqual({
      client: true,
    });
    const options = mocks.createServerClient.mock.calls[0][2];
    expect(options.cookies.getAll()).toEqual([
      { name: "session", value: "value" },
    ]);
    options.cookies.setAll([
      { name: "session", value: "next", options: { secure: true } },
    ]);
    expect(store.set).toHaveBeenCalledWith("session", "next", { secure: true });
  });

  it("ignores cookie writes rejected during Server Component rendering", async () => {
    const store = {
      getAll: vi.fn(() => []),
      set: vi.fn(() => {
        throw new Error("read only");
      }),
    };
    mocks.cookies.mockResolvedValue(store);
    await createKinlightServerComponentClient();
    const options = mocks.createServerClient.mock.calls[0][2];
    expect(() =>
      options.cookies.setAll([{ name: "session", value: "next", options: {} }]),
    ).not.toThrow();
  });
});
