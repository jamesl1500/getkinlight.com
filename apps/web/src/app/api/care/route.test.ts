import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@getkinlight.com/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@getkinlight.com/shared")>()),
  createKinlightServerClient: mocks.createClient,
}));

import { POST } from "./route";

const householdId = "10000000-0000-4000-8000-000000000001";
const recipientId = "20000000-0000-4000-8000-000000000001";
const recordId = "30000000-0000-4000-8000-000000000001";

function request(body: unknown, token = "token") {
  return new Request("http://localhost/api/care", {
    method: "POST",
    headers: token
      ? { authorization: `Bearer ${token}`, "content-type": "application/json" }
      : { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const actions = [
  {
    action: "create-recipient",
    source: "care_recipients",
    message: "Care recipient added.",
    input: { householdId, firstName: "Pat", lastName: "Lee" },
  },
  {
    action: "update-recipient",
    source: "care_recipients",
    message: "Care recipient updated.",
    input: {
      householdId,
      recipientId,
      firstName: "Pat",
      lastName: "Lee",
      isActive: true,
    },
  },
  {
    action: "create-check-in",
    source: "household_check_ins",
    message: "Check-in recorded.",
    input: { householdId, recipientId, status: "doing_well", mood: 4 },
  },
  {
    action: "create-note",
    source: "household_notes",
    message: "Care note added.",
    input: { householdId, recipientId, body: "A steady day.", isPinned: false },
  },
  {
    action: "create-medication",
    source: "medication_reminders",
    message: "Medication reminder added.",
    input: {
      householdId,
      recipientId,
      medicationName: "Medicine",
      startsOn: "2026-08-02",
      reminderTimes: ["09:00"],
      daysOfWeek: [1, 3, 5],
    },
  },
  {
    action: "update-medication",
    source: "medication_reminders",
    message: "Medication reminder updated.",
    input: {
      householdId,
      recipientId,
      medicationId: recordId,
      medicationName: "Medicine",
      startsOn: "2026-08-02",
      reminderTimes: ["09:00"],
      daysOfWeek: [],
      isActive: false,
    },
  },
] as const;

describe("care API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing, invalid, and malformed requests", async () => {
    const missing = await POST(request({ action: "create-note" }, ""));
    expect(missing.status).toBe(401);
    expect(await missing.json()).toEqual({
      ok: false,
      message: "Your session has expired.",
      id: null,
    });

    const invalidAuth = createSupabaseMock(
      {},
      { data: { user: null }, error: new Error("expired") },
    );
    mocks.createClient.mockReturnValue(invalidAuth.client);
    const invalid = await POST(request({ action: "create-note" }));
    expect(invalid.status).toBe(400);

    const malformed = await POST(
      request({ action: "create-note", householdId }),
    );
    expect(malformed.status).toBe(400);
  });

  it.each(actions)(
    "handles $action as a stable mutation contract",
    async ({ action, source, message, input }) => {
      const supabase = createSupabaseMock({
        [source]: { data: { id: recordId }, error: null },
      });
      mocks.createClient.mockReturnValue(supabase.client);

      const response = await POST(request({ action, ...input }));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        ok: true,
        message,
        id: recordId,
      });
      expect(supabase.calls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source,
            method: action.startsWith("create") ? "insert" : "update",
          }),
        ]),
      );
    },
  );

  it("rejects expired authenticated sessions before mutation", async () => {
    const supabase = createSupabaseMock(
      {},
      { data: { user: null }, error: new Error("expired") },
    );
    mocks.createClient.mockReturnValue(supabase.client);
    const response = await POST(
      request({
        action: "create-note",
        householdId,
        recipientId,
        body: "Note",
        isPinned: false,
      }),
    );
    expect(response.status).toBe(401);
    expect(supabase.calls).toHaveLength(0);
  });

  it.each([
    ["42501", 403, "You cannot change care records in this household."],
    ["PGRST116", 403, "You cannot change care records in this household."],
    ["22000", 400, "Database rejected the record."],
  ])(
    "maps database error %s to a safe response",
    async (code, status, message) => {
      const supabase = createSupabaseMock({
        household_notes: {
          data: null,
          error: { code, message: "Database rejected the record." },
        },
      });
      mocks.createClient.mockReturnValue(supabase.client);
      const response = await POST(
        request({
          action: "create-note",
          householdId,
          recipientId,
          body: "Note",
          isPinned: false,
        }),
      );
      expect(response.status).toBe(status);
      expect(await response.json()).toMatchObject({
        ok: false,
        message,
        id: null,
      });
    },
  );
});
