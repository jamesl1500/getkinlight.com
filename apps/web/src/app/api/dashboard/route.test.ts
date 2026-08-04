import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@getkinlight.com/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@getkinlight.com/shared")>()),
  createKinlightServerClient: mocks.createClient,
}));

import { GET } from "./route";

const householdId = "10000000-0000-4000-8000-000000000001";
const checkInId = "20000000-0000-4000-8000-000000000001";
const noteId = "30000000-0000-4000-8000-000000000001";

function request(token = "token") {
  return new Request("http://localhost/api/dashboard?date=2026-08-02", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("dashboard API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing and expired sessions", async () => {
    expect((await GET(request(""))).status).toBe(401);

    const supabase = createSupabaseMock(
      {},
      { data: { user: null }, error: new Error("expired") },
    );
    mocks.createClient.mockReturnValue(supabase.client);

    expect((await GET(request())).status).toBe(401);
    expect(supabase.calls).toHaveLength(0);
  });

  it("returns a valid empty dashboard before household setup", async () => {
    const supabase = createSupabaseMock({
      profiles: {
        data: {
          first_name: "Jamie",
          last_name: "Lee",
          username: "jamie",
          role: "family",
        },
        error: null,
      },
      households: { data: null, error: null },
    });
    mocks.createClient.mockReturnValue(supabase.client);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      profile: { firstName: "Jamie", username: "jamie" },
      household: null,
      schedule: [],
      recentUpdates: [],
    });
  });

  it("merges and orders household check-ins and notes", async () => {
    const supabase = createSupabaseMock({
      profiles: {
        data: {
          first_name: "Jamie",
          last_name: "Lee",
          username: "jamie",
          role: "family",
        },
        error: null,
      },
      households: {
        data: { id: householdId, name: "Lee family" },
        error: null,
      },
      household_members: { data: { role: "owner" }, error: null },
      household_check_ins: {
        data: [
          {
            id: checkInId,
            status: "doing_well",
            summary: null,
            occurred_at: "2026-08-02T09:00:00.000Z",
            care_recipients: { first_name: "Pat", preferred_name: "Patsy" },
          },
        ],
        error: null,
      },
      household_notes: {
        data: [
          {
            id: noteId,
            title: "Lunch update",
            body: "Ate well.",
            created_at: "2026-08-02T10:00:00.000Z",
            care_recipients: null,
          },
        ],
        error: null,
      },
    });
    mocks.createClient.mockReturnValue(supabase.client);

    const response = await GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.household).toEqual({
      id: householdId,
      name: "Lee family",
      role: "owner",
    });
    expect(payload.recentUpdates).toEqual([
      expect.objectContaining({
        id: noteId,
        kind: "note",
        summary: "Lunch update",
      }),
      expect.objectContaining({
        id: checkInId,
        kind: "mood",
        summary: "Check-in: doing well",
        recipientName: "Patsy",
      }),
    ]);
    expect(supabase.calls).toContainEqual({
      source: "household_events",
      method: "gte",
      args: ["starts_at", "2026-08-02T00:00:00.000Z"],
    });
  });

  it("returns a safe query error", async () => {
    const supabase = createSupabaseMock({
      profiles: { data: null, error: { message: "Profile unavailable" } },
      households: { data: null, error: null },
    });
    mocks.createClient.mockReturnValue(supabase.client);

    const response = await GET(request());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      message: "Profile unavailable",
    });
  });

  it("handles an unavailable membership and household query failures", async () => {
    const baseResults = {
      profiles: {
        data: {
          first_name: null,
          last_name: null,
          username: null,
          role: null,
        },
        error: null,
      },
      households: {
        data: { id: householdId, name: "Lee family" },
        error: null,
      },
    };
    const withoutMembership = createSupabaseMock({
      ...baseResults,
      household_members: { data: null, error: null },
    });
    mocks.createClient.mockReturnValue(withoutMembership.client);

    const successfulResponse = await GET(request());
    expect((await successfulResponse.json()).household.role).toBe("member");

    const failedQuery = createSupabaseMock({
      ...baseResults,
      household_members: {
        data: null,
        error: { message: "Membership unavailable" },
      },
    });
    mocks.createClient.mockReturnValue(failedQuery.client);

    const failedResponse = await GET(request());
    expect(failedResponse.status).toBe(400);
    expect(await failedResponse.json()).toEqual({
      ok: false,
      message: "Membership unavailable",
    });
  });
});
