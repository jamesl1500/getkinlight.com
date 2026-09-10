import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@getkinlight.com/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@getkinlight.com/shared")>()),
  createKinlightServerClient: mocks.createClient,
}));

import { GET, PATCH, POST } from "./route";

const householdId = "10000000-0000-4000-8000-000000000001";
const recipientId = "20000000-0000-4000-8000-000000000001";
const sourceId = "30000000-0000-4000-8000-000000000001";

function request(method: "POST" | "PATCH", body: unknown, token = "token") {
  return new Request("http://localhost/api/care-schedule", {
    method,
    headers: token
      ? { authorization: `Bearer ${token}`, "content-type": "application/json" }
      : { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("care schedule API route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads an authenticated, normalized calendar range", async () => {
    const supabase = createSupabaseMock({
      household_events: {
        data: [
          {
            id: sourceId,
            household_id: householdId,
            care_recipient_id: recipientId,
            title: "Family visit",
            description: null,
            starts_at: "2026-08-03T14:00:00.000Z",
            ends_at: null,
            location: "Home",
            is_all_day: false,
            households: { name: "Family" },
            care_recipients: { first_name: "Pat", preferred_name: "Patsy" },
          },
        ],
        error: null,
      },
      households: { data: [{ id: householdId, name: "Family" }], error: null },
      care_recipients: {
        data: [
          {
            id: recipientId,
            household_id: householdId,
            first_name: "Pat",
            preferred_name: "Patsy",
          },
        ],
        error: null,
      },
    });
    mocks.createClient.mockReturnValue(supabase.client);

    const response = await GET(
      new Request(
        "http://localhost/api/care-schedule?start=2026-08-02&end=2026-08-09",
        { headers: { authorization: "Bearer token" } },
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      start: "2026-08-02",
      end: "2026-08-09",
      items: [{ kind: "event", title: "Family visit", recipientName: "Patsy" }],
      households: [{ id: householdId, name: "Family" }],
      recipients: [{ id: recipientId, householdId, name: "Patsy" }],
    });
  });

  it("rejects unauthenticated, invalid, expired, and oversized ranges", async () => {
    const endpoint = "http://localhost/api/care-schedule";
    expect(
      (await GET(new Request(`${endpoint}?start=2026-08-01&end=2026-08-02`)))
        .status,
    ).toBe(401);
    expect(
      (
        await GET(
          new Request(`${endpoint}?start=2026-02-30&end=2026-03-02`, {
            headers: { authorization: "Bearer token" },
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await GET(
          new Request(`${endpoint}?start=2026-08-01&end=2026-09-13`, {
            headers: { authorization: "Bearer token" },
          }),
        )
      ).status,
    ).toBe(400);

    const expired = createSupabaseMock(
      {},
      { data: { user: null }, error: new Error("expired") },
    );
    mocks.createClient.mockReturnValue(expired.client);
    expect(
      (
        await GET(
          new Request(`${endpoint}?start=2026-08-01&end=2026-08-02`, {
            headers: { authorization: "Bearer token" },
          }),
        )
      ).status,
    ).toBe(401);
  });

  it("returns a safe error when calendar data cannot be loaded", async () => {
    const supabase = createSupabaseMock({
      household_events: {
        data: null,
        error: new Error("database unavailable"),
      },
    });
    mocks.createClient.mockReturnValue(supabase.client);
    const response = await GET(
      new Request(
        "http://localhost/api/care-schedule?start=2026-08-01&end=2026-08-02",
        { headers: { authorization: "Bearer token" } },
      ),
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      message: "Unable to load the care calendar.",
    });
  });

  it("rejects unauthenticated, malformed, and expired requests", async () => {
    expect((await POST(request("POST", {}, ""))).status).toBe(401);
    expect((await POST(request("POST", { type: "event" }))).status).toBe(400);
    const expired = createSupabaseMock(
      {},
      { data: { user: null }, error: new Error("expired") },
    );
    mocks.createClient.mockReturnValue(expired.client);
    const response = await POST(
      request("POST", {
        type: "event",
        householdId,
        title: "Visit",
        date: "2026-08-03",
        time: "14:00",
        isAllDay: false,
      }),
    );
    expect(response.status).toBe(401);
  });

  it.each([
    [
      "event",
      "household_events",
      { location: "Home", notes: "Bring forms", isAllDay: false },
    ],
    [
      "appointment",
      "appointments",
      { providerName: "Dr. Lee", location: "Clinic", notes: "Arrive early" },
    ],
    [
      "medication",
      "medication_reminders",
      { dosage: "5 mg", notes: "With water" },
    ],
    ["meal", "eating_reminders", { mealType: "hydration", notes: "One glass" }],
  ] as const)(
    "creates and normalizes a %s item",
    async (type, source, extra) => {
      const supabase = createSupabaseMock({
        [source]: { data: { id: sourceId }, error: null },
        care_recipients: {
          data: { first_name: "Pat", preferred_name: "Patsy" },
          error: null,
        },
      });
      mocks.createClient.mockReturnValue(supabase.client);
      const response = await POST(
        request("POST", {
          type,
          householdId,
          recipientId,
          title: "Care item",
          date: "2026-08-03",
          time: "14:00",
          ...extra,
        }),
      );
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        ok: true,
        message: "Added to the care calendar.",
        item: {
          sourceId,
          householdId,
          recipientId,
          kind: type,
          recipientName: "Patsy",
          startsAt: "2026-08-03T14:00:00.000Z",
        },
      });
      expect(supabase.calls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ source, method: "insert" }),
        ]),
      );
    },
  );

  it.each(["42501", "PGRST116"])(
    "protects schedule writes for database error %s",
    async (code) => {
      const supabase = createSupabaseMock({
        household_events: { data: null, error: { code, message: "denied" } },
      });
      mocks.createClient.mockReturnValue(supabase.client);
      const response = await POST(
        request("POST", {
          type: "event",
          householdId,
          title: "Visit",
          date: "2026-08-03",
          time: "14:00",
          isAllDay: false,
        }),
      );
      expect(response.status).toBe(code === "42501" ? 403 : 400);
    },
  );

  it("creates a household-wide event with no recipient", async () => {
    const supabase = createSupabaseMock({
      household_events: { data: { id: sourceId }, error: null },
    });
    mocks.createClient.mockReturnValue(supabase.client);
    const response = await POST(
      request("POST", {
        type: "event",
        householdId,
        title: "Visit",
        date: "2026-08-03",
        time: "14:00",
        isAllDay: true,
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.item).toMatchObject({ recipientId: null, recipientName: null });
  });

  it("updates a family event and returns a normalized item", async () => {
    const supabase = createSupabaseMock({
      household_events: { data: { id: sourceId }, error: null },
      households: { data: { name: "Family" }, error: null },
      care_recipients: {
        data: { first_name: "Pat", preferred_name: null },
        error: null,
      },
    });
    mocks.createClient.mockReturnValue(supabase.client);
    const response = await PATCH(
      request("PATCH", {
        eventId: sourceId,
        householdId,
        recipientId,
        title: "Updated visit",
        date: "2026-08-04",
        time: "09:30",
        location: "Home",
        notes: "Bring forms",
        isAllDay: false,
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      message: "Family event updated.",
      item: { id: `event-${sourceId}`, recipientName: "Pat", detail: "Home" },
    });
  });

  it("protects event updates that cannot be selected", async () => {
    const supabase = createSupabaseMock({
      household_events: {
        data: null,
        error: { code: "PGRST116", message: "missing" },
      },
    });
    mocks.createClient.mockReturnValue(supabase.client);
    const response = await PATCH(
      request("PATCH", {
        eventId: sourceId,
        householdId,
        title: "Updated visit",
        date: "2026-08-04",
        time: "09:30",
        isAllDay: false,
      }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      message: "You cannot edit this family event.",
    });
  });

  it("rejects unauthenticated, malformed, and expired PATCH requests", async () => {
    expect((await PATCH(request("PATCH", {}, ""))).status).toBe(401);
    expect((await PATCH(request("PATCH", { eventId: sourceId }))).status).toBe(
      400,
    );
    const expired = createSupabaseMock(
      {},
      { data: { user: null }, error: new Error("expired") },
    );
    mocks.createClient.mockReturnValue(expired.client);
    const response = await PATCH(
      request("PATCH", {
        eventId: sourceId,
        householdId,
        title: "Updated visit",
        date: "2026-08-04",
        time: "09:30",
        isAllDay: false,
      }),
    );
    expect(response.status).toBe(401);
  });

  it("updates a household-wide event with no recipient", async () => {
    const supabase = createSupabaseMock({
      household_events: { data: { id: sourceId }, error: null },
      households: { data: { name: "Family" }, error: null },
    });
    mocks.createClient.mockReturnValue(supabase.client);
    const response = await PATCH(
      request("PATCH", {
        eventId: sourceId,
        householdId,
        title: "Updated visit",
        date: "2026-08-04",
        time: "09:30",
        isAllDay: false,
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      item: { recipientName: null },
    });
  });
});
