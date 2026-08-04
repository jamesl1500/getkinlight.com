import {
  KinlightApiError,
  createKinlightApiClient,
} from "@getkinlight.com/shared";
import { describe, expect, it, vi } from "vitest";

describe("Kinlight API client", () => {
  it("calls versioned endpoints with injected tokens and validates responses", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            message: "Care note added.",
            id: "30000000-0000-4000-8000-000000000001",
          }),
          { status: 200 },
        ),
    );
    const client = createKinlightApiClient({
      baseUrl: "https://staging.example.com/",
      getAccessToken: () => "access-token",
      fetch: fetchMock,
    });
    const result = await client.care({
      action: "create-note",
      householdId: "10000000-0000-4000-8000-000000000001",
      recipientId: "20000000-0000-4000-8000-000000000001",
      body: "A steady day.",
      isPinned: false,
    });
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://staging.example.com/api/v1/care",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });

  it("supports unauthenticated auth calls", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            message: "Password reset email sent.",
            session: null,
            profile: null,
          }),
          { status: 200 },
        ),
    );
    const client = createKinlightApiClient({ fetch: fetchMock });
    await client.auth({ mode: "forgot-password", email: "pat@example.com" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth",
      expect.not.objectContaining({
        headers: expect.objectContaining({ Authorization: expect.anything() }),
      }),
    );
  });

  it("loads the dashboard for the device calendar date", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            message: "Dashboard loaded.",
            profile: {
              firstName: "Jamie",
              lastName: "Lee",
              username: "jamie",
              role: "family",
            },
            household: null,
            schedule: [],
            recentUpdates: [],
          }),
          { status: 200 },
        ),
    );
    const client = createKinlightApiClient({
      getAccessToken: () => "access-token",
      fetch: fetchMock,
    });

    const result = await client.dashboard.get("2026-08-02");

    expect(result.profile.firstName).toBe("Jamie");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/dashboard?date=2026-08-02",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });

  it("loads a selected Care workspace", async () => {
    const recipientId = "20000000-0000-4000-8000-000000000001";
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            message: "Care workspace loaded.",
            households: [],
            recipients: [],
            selectedRecipient: null,
            medications: [],
            eatingReminders: [],
            checkIns: [],
            notes: [],
            schedule: [],
          }),
          { status: 200 },
        ),
    );
    const client = createKinlightApiClient({
      getAccessToken: () => "access-token",
      fetch: fetchMock,
    });

    const result = await client.careWorkspace.get(recipientId);

    expect(result.selectedRecipient).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/care?recipient=${recipientId}`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });

  it("loads a validated care calendar range", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            message: "Care calendar loaded.",
            start: "2026-08-02",
            end: "2026-08-09",
            items: [],
            households: [],
            recipients: [],
          }),
          { status: 200 },
        ),
    );
    const client = createKinlightApiClient({
      getAccessToken: () => "access-token",
      fetch: fetchMock,
    });

    const result = await client.schedule.getRange("2026-08-02", "2026-08-09");

    expect(result.items).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/care-schedule?start=2026-08-02&end=2026-08-09",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });

  it("loads a selected Family workspace", async () => {
    const householdId = "10000000-0000-4000-8000-000000000001";
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            message: "Family workspace loaded.",
            currentUserId: "40000000-0000-4000-8000-000000000001",
            households: [],
            selectedHousehold: null,
            members: [],
            invitations: [],
            recipients: [],
            currentUserRole: null,
          }),
          { status: 200 },
        ),
    );
    const client = createKinlightApiClient({
      getAccessToken: () => "access-token",
      fetch: fetchMock,
    });

    const result = await client.familyWorkspace.get(householdId);

    expect(result.selectedHousehold).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/family?household=${householdId}`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });

  it("exposes stable server error codes and request IDs", async () => {
    const client = createKinlightApiClient({
      getAccessToken: () => "token",
      fetch: async () =>
        new Response(
          JSON.stringify({
            ok: false,
            message: "Too many requests.",
            code: "RATE_LIMITED",
            requestId: "request-123",
          }),
          { status: 429 },
        ),
    });
    await expect(
      client.family({
        action: "rename-household",
        householdId: "10000000-0000-4000-8000-000000000001",
        name: "Family",
      }),
    ).rejects.toMatchObject({
      name: "KinlightApiError",
      code: "RATE_LIMITED",
      status: 429,
      requestId: "request-123",
    });
  });

  it("distinguishes missing sessions, network errors, and invalid responses", async () => {
    const missing = createKinlightApiClient();
    await expect(
      missing.ai({
        action: "search",
        householdId: "10000000-0000-4000-8000-000000000001",
        query: "appointment",
      }),
    ).rejects.toMatchObject({ code: "AUTH_REQUIRED" });

    const offline = createKinlightApiClient({
      getAccessToken: () => "token",
      fetch: async () => {
        throw new Error("offline");
      },
    });
    await expect(offline.onboarding.get()).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });

    const invalid = createKinlightApiClient({
      getAccessToken: () => "token",
      fetch: async () =>
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
    });
    await expect(invalid.onboarding.get()).rejects.toBeInstanceOf(
      KinlightApiError,
    );
  });
});
