import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";
import { getHouseholdAiContext } from "./household-context";

describe("getHouseholdAiContext", () => {
  afterEach(() => vi.useRealTimers());

  it("loads the bounded household record context", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-02T12:00:00.000Z"));
    const { client, calls } = createSupabaseMock({
      households: { data: { id: "household-1", name: "Family" }, error: null },
      care_recipients: { data: [{ id: "recipient-1" }], error: null },
      household_events: { data: [{ id: "event-1" }], error: null },
      appointments: { data: [{ id: "appointment-1" }], error: null },
      medication_reminders: { data: [{ id: "medication-1" }], error: null },
      eating_reminders: { data: [{ id: "meal-1" }], error: null },
      household_check_ins: { data: [{ id: "check-1" }], error: null },
      household_notes: { data: [{ id: "note-1" }], error: null },
    });

    const context = await getHouseholdAiContext(client as never, "household-1");

    expect(context).toMatchObject({
      generatedAt: "2026-08-02T12:00:00.000Z",
      household: { id: "household-1" },
      recipients: [{ id: "recipient-1" }],
      schedule: {
        events: [{ id: "event-1" }],
        appointments: [{ id: "appointment-1" }],
      },
    });
    expect(calls).toContainEqual({
      source: "household_events",
      method: "gte",
      args: ["starts_at", "2026-07-03T12:00:00.000Z"],
    });
    expect(calls).toContainEqual({
      source: "appointments",
      method: "lte",
      args: ["starts_at", "2026-09-01T12:00:00.000Z"],
    });
  });

  it("defaults nullable collections to empty arrays", async () => {
    const { client } = createSupabaseMock({
      households: { data: { id: "household-1" }, error: null },
    });
    const context = await getHouseholdAiContext(client as never, "household-1");
    expect(context.recipients).toEqual([]);
    expect(context.schedule).toEqual({
      events: [],
      appointments: [],
      medications: [],
      meals: [],
    });
  });

  it("throws household and related-query errors", async () => {
    const householdError = new Error("household denied");
    const relatedError = new Error("notes denied");
    const householdClient = createSupabaseMock({
      households: { data: null, error: householdError },
    }).client;
    await expect(
      getHouseholdAiContext(householdClient as never, "household-1"),
    ).rejects.toBe(householdError);

    const relatedClient = createSupabaseMock({
      households: { data: { id: "household-1" }, error: null },
      household_notes: { data: null, error: relatedError },
    }).client;
    await expect(
      getHouseholdAiContext(relatedClient as never, "household-1"),
    ).rejects.toBe(relatedError);
  });
});
