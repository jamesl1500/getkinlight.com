import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@getkinlight.com/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@getkinlight.com/shared")>()),
  createKinlightServerClient: mocks.createClient,
}));

import { POST } from "./route";

const householdId = "10000000-0000-4000-8000-000000000001";
const memberId = "20000000-0000-4000-8000-000000000001";
const invitationId = "30000000-0000-4000-8000-000000000001";

function request(body: unknown, token = "token") {
  return new Request("http://localhost/api/family", {
    method: "POST",
    headers: token
      ? { authorization: `Bearer ${token}`, "content-type": "application/json" }
      : { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("family API route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires a valid session and request schema", async () => {
    expect((await POST(request({}, ""))).status).toBe(401);
    expect((await POST(request({ action: "rename-household" }))).status).toBe(
      400,
    );

    const expired = createSupabaseMock(
      {},
      { data: { user: null }, error: new Error("expired") },
    );
    mocks.createClient.mockReturnValue(expired.client);
    const response = await POST(
      request({ action: "rename-household", householdId, name: "Family" }),
    );
    expect(response.status).toBe(401);
  });

  it.each([
    [
      "rename-household",
      { householdId, name: "New family name" },
      "households",
      "Household name updated.",
    ],
    [
      "cancel-invitation",
      { householdId, invitationId },
      "household_invitations",
      "Invitation canceled.",
    ],
    [
      "update-member-role",
      { householdId, memberId, role: "caregiver" },
      "household_members",
      "Member role updated.",
    ],
    [
      "remove-member",
      { householdId, memberId },
      "household_members",
      "Member removed from the household.",
    ],
  ] as const)("handles %s", async (action, input, source, message) => {
    const supabase = createSupabaseMock({
      [source]: { data: { id: memberId }, error: null },
    });
    mocks.createClient.mockReturnValue(supabase.client);
    const response = await POST(request({ action, ...input }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      message,
      invitationToken: null,
    });
  });

  it("accepts invitation tokens through the database function", async () => {
    const supabase = createSupabaseMock({
      "rpc:accept_household_invitation": { data: null, error: null },
    });
    mocks.createClient.mockReturnValue(supabase.client);
    const response = await POST(
      request({ action: "accept-invitation", invitationToken: invitationId }),
    );
    expect(response.status).toBe(200);
    expect(supabase.calls).toContainEqual({
      source: "rpc:accept_household_invitation",
      method: "rpc",
      args: [{ invitation_token: invitationId }],
    });
  });

  it("creates an invitation with a client-safe token", async () => {
    const supabase = createSupabaseMock({
      "rpc:get_household_member_directory": { data: [], error: null },
      household_invitations: { data: null, error: null },
    });
    mocks.createClient.mockReturnValue(supabase.client);
    const response = await POST(
      request({
        action: "invite-member",
        householdId,
        email: "New@Example.com",
        role: "member",
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, message: expect.any(String) });
    expect(body.invitationToken).toMatch(/^[0-9a-f-]{36}$/);
    expect(supabase.calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "household_invitations",
          method: "insert",
          args: [
            expect.objectContaining({
              invited_email: "new@example.com",
              invited_by: "user-1",
            }),
          ],
        }),
      ]),
    );
  });

  it("returns stable invitation and owner conflict responses", async () => {
    const existing = createSupabaseMock({
      "rpc:get_household_member_directory": {
        data: [{ email: "member@example.com" }],
        error: null,
      },
    });
    mocks.createClient.mockReturnValue(existing.client);
    const duplicateMember = await POST(
      request({
        action: "invite-member",
        householdId,
        email: "MEMBER@example.com",
        role: "member",
      }),
    );
    expect(duplicateMember.status).toBe(409);

    const finalOwner = createSupabaseMock({
      household_members: {
        data: null,
        error: { code: "23514", message: "constraint" },
      },
    });
    mocks.createClient.mockReturnValue(finalOwner.client);
    const ownerResponse = await POST(
      request({ action: "remove-member", householdId, memberId }),
    );
    expect(ownerResponse.status).toBe(409);
    expect(await ownerResponse.json()).toMatchObject({
      message: expect.stringContaining("another owner"),
    });
  });

  it.each(["42501", "PGRST116"])(
    "maps %s mutations to forbidden",
    async (code) => {
      const supabase = createSupabaseMock({
        households: { data: null, error: { code, message: "denied" } },
      });
      mocks.createClient.mockReturnValue(supabase.client);
      const response = await POST(
        request({ action: "rename-household", householdId, name: "Family" }),
      );
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        message: "Only a household owner can make that change.",
      });
    },
  );
});
