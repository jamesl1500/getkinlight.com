import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  createAdminClient: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock("@getkinlight.com/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@getkinlight.com/shared")>()),
  createKinlightServerClient: mocks.createServerClient,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createAdminClient,
}));

import { PATCH } from "./route";

function request(body: unknown, token = "token") {
  return new Request("http://localhost/api/account", {
    method: "PATCH",
    headers: token
      ? { authorization: `Bearer ${token}`, "content-type": "application/json" }
      : { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("account deletion API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "server-secret";
    mocks.deleteUser.mockResolvedValue({ error: null });
    mocks.createAdminClient.mockReturnValue({
      auth: { admin: { deleteUser: mocks.deleteUser } },
    });
  });

  it("requires authentication", async () => {
    const response = await PATCH(request({ confirmation: "DELETE" }, ""));
    expect(response.status).toBe(401);
  });

  it("requires the literal confirmation", async () => {
    const response = await PATCH(request({ confirmation: "delete" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      message: "Type DELETE to confirm account deletion.",
    });
  });

  it("blocks deletion until shared household ownership is transferred", async () => {
    const supabase = createSupabaseMock({
      "rpc:prepare_current_account_deletion": {
        data: null,
        error: { message: "Transfer ownership before deleting." },
      },
    });
    mocks.createServerClient.mockReturnValue(supabase.client);
    const response = await PATCH(request({ confirmation: "DELETE" }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      message: expect.stringContaining("Transfer ownership"),
    });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("returns a stable cleanup failure", async () => {
    const supabase = createSupabaseMock({
      "rpc:prepare_current_account_deletion": {
        data: null,
        error: { message: "database details" },
      },
    });
    mocks.createServerClient.mockReturnValue(supabase.client);
    const response = await PATCH(request({ confirmation: "DELETE" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      message: "Unable to prepare this account for deletion.",
    });
  });

  it("reports an Auth deletion failure after cleanup", async () => {
    const supabase = createSupabaseMock({
      "rpc:prepare_current_account_deletion": { data: {}, error: null },
    });
    mocks.createServerClient.mockReturnValue(supabase.client);
    mocks.deleteUser.mockResolvedValue({ error: new Error("auth failure") });
    const response = await PATCH(request({ confirmation: "DELETE" }));
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      message: expect.stringContaining("needs support"),
    });
  });

  it("cleans up data and permanently deletes the authenticated user", async () => {
    const supabase = createSupabaseMock({
      "rpc:prepare_current_account_deletion": { data: {}, error: null },
    });
    mocks.createServerClient.mockReturnValue(supabase.client);
    const response = await PATCH(request({ confirmation: "DELETE" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      message: "Your Kinlight account and personal data were deleted.",
    });
    expect(mocks.deleteUser).toHaveBeenCalledWith("user-1");
  });
});
