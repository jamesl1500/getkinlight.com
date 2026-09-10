import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), schedule: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createKinlightServerComponentClient: mocks.createClient,
}));
vi.mock("@/lib/care-schedule", () => ({
  getCareScheduleForRange: mocks.schedule,
}));

import { getCareWorkspaceData } from "./care";

describe("getCareWorkspaceData", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.schedule.mockReset().mockResolvedValue([]);
  });

  it("returns an empty workspace when there are no recipients", async () => {
    const { client } = createSupabaseMock({
      households: { data: [{ id: "h1", name: "Family" }], error: null },
    });
    mocks.createClient.mockResolvedValue(client);
    await expect(getCareWorkspaceData()).resolves.toMatchObject({
      selectedRecipient: null,
      medications: [],
      schedule: [],
    });
    expect(mocks.schedule).not.toHaveBeenCalled();
  });

  it("selects the requested recipient and maps all care records", async () => {
    const { client } = createSupabaseMock({
      households: { data: [{ id: "h1", name: "Family" }], error: null },
      care_recipients: {
        data: [
          {
            id: "r1",
            household_id: "h1",
            first_name: "A",
            last_name: "One",
            preferred_name: null,
            date_of_birth: null,
            relationship: null,
            care_preferences: null,
            is_active: true,
          },
          {
            id: "r2",
            household_id: "h1",
            first_name: "B",
            last_name: "Two",
            preferred_name: "Bee",
            date_of_birth: "1950-01-01",
            relationship: "Parent",
            care_preferences: "Quiet",
            is_active: false,
          },
        ],
        error: null,
      },
      medication_reminders: {
        data: [
          {
            id: "m1",
            medication_name: "Aspirin",
            dosage: "1",
            instructions: "Food",
            starts_on: "2026-01-01",
            ends_on: null,
            reminder_times: ["09:00"],
            days_of_week: [],
            is_active: true,
          },
        ],
        error: null,
      },
      eating_reminders: {
        data: [
          {
            id: "e1",
            title: "Lunch",
            meal_type: "lunch",
            reminder_times: ["12:00"],
            is_active: true,
          },
        ],
        error: null,
      },
      household_check_ins: {
        data: [
          {
            id: "c1",
            status: "okay",
            mood: 4,
            summary: "Fine",
            occurred_at: "2026-08-01T00:00:00Z",
          },
        ],
        error: null,
      },
      household_notes: {
        data: [
          {
            id: "n1",
            title: "Note",
            body: "Body",
            is_pinned: true,
            created_at: "2026-08-01T00:00:00Z",
          },
        ],
        error: null,
      },
    });
    mocks.createClient.mockResolvedValue(client);
    mocks.schedule.mockResolvedValue([
      { id: "s1", recipientId: "r2" },
      { id: "s2", recipientId: "r1" },
    ]);

    const data = await getCareWorkspaceData("r2");
    expect(data.selectedRecipient).toMatchObject({
      id: "r2",
      preferredName: "Bee",
    });
    expect(data.medications[0]).toMatchObject({
      medicationName: "Aspirin",
      reminderTimes: ["09:00"],
    });
    expect(data.eatingReminders[0]).toMatchObject({ mealType: "lunch" });
    expect(data.checkIns[0]).toMatchObject({
      status: "okay",
      occurredAt: "2026-08-01T00:00:00Z",
    });
    expect(data.notes[0]).toMatchObject({ isPinned: true });
    expect(data.schedule).toEqual([{ id: "s1", recipientId: "r2" }]);
  });

  it("throws initial and related query errors", async () => {
    const initialError = new Error("households failed");
    mocks.createClient.mockResolvedValue(
      createSupabaseMock({ households: { data: null, error: initialError } })
        .client,
    );
    await expect(getCareWorkspaceData()).rejects.toBe(initialError);

    const relatedError = new Error("medications failed");
    mocks.createClient.mockResolvedValue(
      createSupabaseMock({
        care_recipients: {
          data: [
            {
              id: "r1",
              household_id: "h1",
              first_name: "A",
              last_name: "B",
              preferred_name: null,
              date_of_birth: null,
              relationship: null,
              care_preferences: null,
              is_active: true,
            },
          ],
          error: null,
        },
        medication_reminders: { data: null, error: relatedError },
      }).client,
    );
    await expect(getCareWorkspaceData()).rejects.toBe(relatedError);
  });

  it("throws when a later related query fails", async () => {
    const notesError = new Error("notes failed");
    mocks.createClient.mockResolvedValue(
      createSupabaseMock({
        care_recipients: {
          data: [
            {
              id: "r1",
              household_id: "h1",
              first_name: "A",
              last_name: "B",
              preferred_name: null,
              date_of_birth: null,
              relationship: null,
              care_preferences: null,
              is_active: true,
            },
          ],
          error: null,
        },
        household_notes: { data: null, error: notesError },
      }).client,
    );
    await expect(getCareWorkspaceData()).rejects.toBe(notesError);
  });

  it("falls back to the first active recipient when no id is requested", async () => {
    const { client } = createSupabaseMock({
      households: { data: [{ id: "h1", name: "Family" }], error: null },
      care_recipients: {
        data: [
          {
            id: "r1",
            household_id: "h1",
            first_name: "Inactive",
            last_name: "One",
            preferred_name: null,
            date_of_birth: null,
            relationship: null,
            care_preferences: null,
            is_active: false,
          },
          {
            id: "r2",
            household_id: "h1",
            first_name: "Active",
            last_name: "Two",
            preferred_name: null,
            date_of_birth: null,
            relationship: null,
            care_preferences: null,
            is_active: true,
          },
        ],
        error: null,
      },
    });
    mocks.createClient.mockResolvedValue(client);
    mocks.schedule.mockResolvedValue([]);

    const data = await getCareWorkspaceData();
    expect(data.selectedRecipient).toMatchObject({ id: "r2" });
  });

  it("defaults every collection to an empty array when Supabase returns null data", async () => {
    const { client } = createSupabaseMock({
      households: { data: null, error: null },
      care_recipients: {
        data: [
          {
            id: "r1",
            household_id: "h1",
            first_name: "A",
            last_name: "B",
            preferred_name: null,
            date_of_birth: null,
            relationship: null,
            care_preferences: null,
            is_active: true,
          },
        ],
        error: null,
      },
      medication_reminders: { data: null, error: null },
      eating_reminders: { data: null, error: null },
      household_check_ins: { data: null, error: null },
      household_notes: { data: null, error: null },
    });
    mocks.createClient.mockResolvedValue(client);
    mocks.schedule.mockResolvedValue([]);

    const data = await getCareWorkspaceData("r1");
    expect(data.households).toEqual([]);
    expect(data.medications).toEqual([]);
    expect(data.eatingReminders).toEqual([]);
    expect(data.checkIns).toEqual([]);
    expect(data.notes).toEqual([]);
  });
});
