import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createKinlightServerComponentClient: mocks.createClient,
}));

import { getFamilyWorkspaceData } from "./family";

describe("getFamilyWorkspaceData", () => {
  beforeEach(() => mocks.createClient.mockReset());

  it("requires authentication", async () => {
    mocks.createClient.mockResolvedValue(
      createSupabaseMock({}, { data: { user: null }, error: null }).client,
    );
    await expect(getFamilyWorkspaceData()).rejects.toThrow(
      "Authentication is required.",
    );
  });

  it("returns an empty authenticated workspace without households", async () => {
    mocks.createClient.mockResolvedValue(createSupabaseMock({}).client);
    await expect(getFamilyWorkspaceData()).resolves.toMatchObject({
      currentUserId: "user-1",
      selectedHousehold: null,
      members: [],
    });
  });

  it("maps the selected household directory, invitations, recipients, and role", async () => {
    const { client, calls } = createSupabaseMock({
      households: {
        data: [
          { id: "h1", name: "First", created_at: "2026-01-01" },
          { id: "h2", name: "Second", created_at: "2026-02-01" },
        ],
        error: null,
      },
      "rpc:get_household_member_directory": {
        data: [
          {
            member_id: "m1",
            user_id: "user-1",
            role: "owner",
            first_name: "Jamie",
            last_name: "Lee",
            username: "jamie",
            email: "j@example.com",
            joined_at: "2026-01-01",
          },
        ],
        error: null,
      },
      household_invitations: {
        data: [
          {
            id: "i1",
            invited_email: "care@example.com",
            role: "caregiver",
            invite_token: "token",
            expires_at: "2026-09-01",
          },
        ],
        error: null,
      },
      care_recipients: {
        data: [
          {
            id: "r1",
            household_id: "h2",
            first_name: "Pat",
            last_name: "Lee",
            preferred_name: null,
            date_of_birth: null,
            relationship: "Parent",
            care_preferences: null,
            is_active: true,
          },
        ],
        error: null,
      },
    });
    mocks.createClient.mockResolvedValue(client);

    const data = await getFamilyWorkspaceData("h2");
    expect(data.selectedHousehold?.id).toBe("h2");
    expect(data.currentUserRole).toBe("owner");
    expect(data.invitations[0]).toMatchObject({
      email: "care@example.com",
      token: "token",
    });
    expect(data.recipients[0]).toMatchObject({
      firstName: "Pat",
      relationship: "Parent",
    });
    expect(calls).toContainEqual({
      source: "rpc:get_household_member_directory",
      method: "rpc",
      args: [{ target_household_id: "h2" }],
    });
  });

  it("throws household and related query errors", async () => {
    const householdError = new Error("households failed");
    mocks.createClient.mockResolvedValue(
      createSupabaseMock({ households: { data: null, error: householdError } })
        .client,
    );
    await expect(getFamilyWorkspaceData()).rejects.toBe(householdError);

    const memberError = new Error("members failed");
    mocks.createClient.mockResolvedValue(
      createSupabaseMock({
        households: {
          data: [{ id: "h1", name: "Family", created_at: "now" }],
          error: null,
        },
        "rpc:get_household_member_directory": {
          data: null,
          error: memberError,
        },
      }).client,
    );
    await expect(getFamilyWorkspaceData()).rejects.toBe(memberError);
  });

  it("returns a null role when the current user is not a household member", async () => {
    const { client } = createSupabaseMock({
      households: {
        data: [{ id: "h1", name: "Family", created_at: "now" }],
        error: null,
      },
      "rpc:get_household_member_directory": {
        data: [
          {
            member_id: "m1",
            user_id: "someone-else",
            role: "owner",
            first_name: null,
            last_name: null,
            username: null,
            email: null,
            joined_at: "2026-01-01",
          },
        ],
        error: null,
      },
      household_invitations: { data: [], error: null },
      care_recipients: { data: [], error: null },
    });
    const data = await getFamilyWorkspaceData(undefined, client as never);
    expect(data.currentUserRole).toBeNull();
  });
});
