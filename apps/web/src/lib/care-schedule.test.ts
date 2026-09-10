import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  results: new Map<string, { data: unknown[] }>(),
  calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
}));

vi.mock("@/lib/supabase/server", () => ({
  createKinlightServerComponentClient: vi.fn(async () => ({
    from(table: string) {
      const builder = {
        select(...args: unknown[]) {
          mocks.calls.push({ table, method: "select", args });
          return builder;
        },
        eq(...args: unknown[]) {
          mocks.calls.push({ table, method: "eq", args });
          return builder;
        },
        neq(...args: unknown[]) {
          mocks.calls.push({ table, method: "neq", args });
          return builder;
        },
        gte(...args: unknown[]) {
          mocks.calls.push({ table, method: "gte", args });
          return builder;
        },
        lte(...args: unknown[]) {
          mocks.calls.push({ table, method: "lte", args });
          return builder;
        },
        lt(...args: unknown[]) {
          mocks.calls.push({ table, method: "lt", args });
          return builder;
        },
        or(...args: unknown[]) {
          mocks.calls.push({ table, method: "or", args });
          return builder;
        },
        then(resolve: (value: { data: unknown[] }) => unknown) {
          return Promise.resolve(mocks.results.get(table) ?? { data: [] }).then(
            resolve,
          );
        },
      };
      return builder;
    },
  })),
}));

import {
  getCareScheduleForDate,
  getCareScheduleForRange,
} from "./care-schedule";

describe("care schedule", () => {
  beforeEach(() => {
    mocks.results.clear();
    mocks.calls.length = 0;
  });

  it("normalizes, expands, and orders schedule records", async () => {
    mocks.results.set("household_events", {
      data: [
        {
          id: "event-1",
          household_id: "household-1",
          care_recipient_id: null,
          title: "Family call",
          description: "Weekly catch-up",
          starts_at: "2026-08-02T18:00:00.000Z",
          ends_at: "2026-08-02T19:00:00.000Z",
          location: "Video",
          is_all_day: false,
          households: [{ name: "The Smiths" }],
          care_recipients: null,
        },
      ],
    });
    mocks.results.set("appointments", {
      data: [
        {
          id: "appointment-1",
          household_id: "household-1",
          care_recipient_id: "recipient-1",
          title: "Cardiology",
          provider_name: "Dr. Reed",
          specialty: "Cardiology",
          location: "Clinic",
          starts_at: "2026-08-03T10:00:00.000Z",
          ends_at: null,
          status: "rescheduled_visit",
          preparation_notes: null,
          transportation_notes: "Alex driving",
          households: { name: "The Smiths" },
          care_recipients: { first_name: "Pat", preferred_name: "Patsy" },
        },
      ],
    });
    mocks.results.set("medication_reminders", {
      data: [
        {
          id: "medication-1",
          household_id: "household-1",
          care_recipient_id: "recipient-1",
          medication_name: "Vitamin D",
          dosage: "1 tablet",
          reminder_times: ["08:00:00"],
          days_of_week: [],
          instructions: "With food",
          starts_on: "2026-08-01",
          ends_on: null,
          timezone: "UTC",
          households: { name: "The Smiths" },
          care_recipients: [{ first_name: "Pat", preferred_name: null }],
        },
      ],
    });
    mocks.results.set("eating_reminders", {
      data: [
        {
          id: "meal-1",
          household_id: "household-1",
          care_recipient_id: null,
          title: "Drink water",
          meal_type: "morning_snack",
          reminder_times: ["09:30:00"],
          days_of_week: [1, 9],
          instructions: null,
          starts_on: "2026-08-03",
          ends_on: "2026-08-03",
          timezone: "America/New_York",
          households: [{ name: "The Smiths" }],
          care_recipients: null,
        },
      ],
    });

    const items = await getCareScheduleForRange(
      new Date("2026-08-02T00:00:00.000Z"),
      new Date("2026-08-04T00:00:00.000Z"),
    );

    expect(items).toHaveLength(5);
    expect(items.map((item) => item.kind)).toEqual([
      "medication",
      "event",
      "medication",
      "meal",
      "appointment",
    ]);
    expect(items[1]).toMatchObject({
      id: "event-event-1",
      detail: "Video",
      recipientName: null,
      details: expect.arrayContaining([
        { label: "Household", value: "The Smiths" },
        { label: "Care recipient", value: "Household-wide" },
      ]),
    });
    expect(items[3]).toMatchObject({
      detail: "morning snack",
      recipientName: null,
    });
    expect(items[3].details).toContainEqual({
      label: "Repeats",
      value: "One time",
    });
    expect(items[4]).toMatchObject({
      detail: "Dr. Reed",
      recipientName: "Patsy",
    });
    expect(items[4].details).toContainEqual({
      label: "Status",
      value: "rescheduled visit",
    });
    expect(mocks.calls).toContainEqual({
      table: "appointments",
      method: "neq",
      args: ["status", "cancelled"],
    });
    expect(mocks.calls).toContainEqual({
      table: "medication_reminders",
      method: "or",
      args: ["ends_on.is.null,ends_on.gte.2026-08-02"],
    });
  });

  it("uses reminder fallbacks and named recurrence days", async () => {
    mocks.results.set("medication_reminders", {
      data: [
        {
          id: "medication-2",
          household_id: "household-1",
          care_recipient_id: null,
          medication_name: undefined,
          dosage: null,
          reminder_times: ["07:00:00"],
          days_of_week: [0, 8],
          starts_on: "2026-08-01",
          ends_on: "2026-09-01",
          timezone: "UTC",
          households: null,
          care_recipients: null,
        },
      ],
    });

    const items = await getCareScheduleForDate(
      new Date("2026-08-02T13:45:00.000Z"),
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Medication",
      detail: null,
      startsAt: "2026-08-02T07:00:00Z",
    });
    expect(items[0].details).toContainEqual({
      label: "Repeats",
      value: "Sunday",
    });
    expect(mocks.calls).toContainEqual({
      table: "household_events",
      method: "gte",
      args: ["starts_at", "2026-08-02T00:00:00.000Z"],
    });
    expect(mocks.calls).toContainEqual({
      table: "household_events",
      method: "lt",
      args: ["starts_at", "2026-08-03T00:00:00.000Z"],
    });
  });

  it("returns no items when every table returns null data", async () => {
    mocks.results.set("household_events", { data: null as never });
    mocks.results.set("appointments", { data: null as never });
    mocks.results.set("medication_reminders", { data: null as never });
    mocks.results.set("eating_reminders", { data: null as never });

    const items = await getCareScheduleForRange(
      new Date("2026-08-02T00:00:00.000Z"),
      new Date("2026-08-03T00:00:00.000Z"),
    );

    expect(items).toEqual([]);
  });

  it("throws the first available query error", async () => {
    const appointmentsError = new Error("appointments failed");
    mocks.results.set("appointments", {
      data: undefined as never,
      error: appointmentsError,
    } as never);

    await expect(
      getCareScheduleForRange(
        new Date("2026-08-02T00:00:00.000Z"),
        new Date("2026-08-03T00:00:00.000Z"),
      ),
    ).rejects.toBe(appointmentsError);
  });
});
