import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createKinlightServerComponentClient: mocks.createClient,
}));

import { getTasksBoardData } from "./tasks";

const userId = "00000000-0000-4000-8000-000000000001";
const householdId = "10000000-0000-4000-8000-000000000001";
const eventId = "20000000-0000-4000-8000-000000000001";

const emptyScheduleTables = {
  household_events: { data: [], error: null },
  appointments: { data: [], error: null },
  medication_reminders: { data: [], error: null },
  eating_reminders: { data: [], error: null },
};

describe("getTasksBoardData", () => {
  beforeEach(() => mocks.createClient.mockReset());

  it("throws when the caller is not authenticated", async () => {
    mocks.createClient.mockResolvedValue(
      createSupabaseMock({}, { data: { user: null }, error: null }).client,
    );
    await expect(getTasksBoardData()).rejects.toThrow(
      "Authentication is required.",
    );
  });

  it("throws when households cannot be loaded", async () => {
    mocks.createClient.mockResolvedValue(
      createSupabaseMock(
        { households: { data: null, error: new Error("boom") } },
        { data: { user: { id: userId } }, error: null },
      ).client,
    );
    await expect(getTasksBoardData()).rejects.toThrow("boom");
  });

  it("returns an empty board when there is no household", async () => {
    mocks.createClient.mockResolvedValue(
      createSupabaseMock(
        { households: { data: [], error: null } },
        { data: { user: { id: userId } }, error: null },
      ).client,
    );

    const data = await getTasksBoardData();

    expect(data).toEqual({
      households: [],
      selectedHousehold: null,
      currentUserId: userId,
      canAssign: false,
      members: [],
      items: [],
    });
  });

  it("throws when the member directory cannot be loaded", async () => {
    mocks.createClient.mockResolvedValue(
      createSupabaseMock(
        {
          households: { data: [{ id: householdId, name: "Family" }], error: null },
          ...emptyScheduleTables,
          schedule_task_assignments: { data: [], error: null },
          household_members: { data: null, error: null },
          "rpc:get_household_member_directory": {
            data: null,
            error: new Error("boom"),
          },
        },
        { data: { user: { id: userId } }, error: null },
      ).client,
    );

    await expect(getTasksBoardData()).rejects.toThrow("boom");
  });

  it("builds a board with assigned and unassigned items, scoped to the selected household", async () => {
    mocks.createClient.mockResolvedValue(
      createSupabaseMock(
        {
          households: { data: [{ id: householdId, name: "Family" }], error: null },
          household_events: {
            data: [
              {
                id: eventId,
                household_id: householdId,
                care_recipient_id: null,
                title: "Physical therapy",
                description: null,
                starts_at: "2026-08-10T14:00:00.000Z",
                ends_at: null,
                location: null,
                is_all_day: false,
                households: { name: "Family" },
                care_recipients: null,
              },
              {
                id: "20000000-0000-4000-8000-000000000002",
                household_id: householdId,
                care_recipient_id: null,
                title: "Family dinner",
                description: null,
                starts_at: "2026-08-11T18:00:00.000Z",
                ends_at: null,
                location: null,
                is_all_day: false,
                households: { name: "Family" },
                care_recipients: null,
              },
            ],
            error: null,
          },
          appointments: { data: [], error: null },
          medication_reminders: { data: [], error: null },
          eating_reminders: { data: [], error: null },
          schedule_task_assignments: {
            data: [
              {
                id: "30000000-0000-4000-8000-000000000001",
                household_id: householdId,
                resource_type: "event",
                resource_id: eventId,
                assigned_to: userId,
                claimed_at: "2026-08-01T00:00:00.000Z",
              },
            ],
            error: null,
          },
          profiles: {
            data: [
              {
                user_id: userId,
                first_name: "Jamie",
                last_name: "Lee",
                username: null,
              },
            ],
            error: null,
          },
          household_members: { data: { role: "owner" }, error: null },
          "rpc:get_household_member_directory": {
            data: [
              {
                user_id: userId,
                first_name: "Jamie",
                last_name: "Lee",
                username: null,
                email: null,
              },
            ],
            error: null,
          },
        },
        { data: { user: { id: userId } }, error: null },
      ).client,
    );

    const data = await getTasksBoardData(householdId);

    expect(data.canAssign).toBe(true);
    expect(data.members).toEqual([{ userId, displayName: "Jamie Lee" }]);
    expect(data.items).toEqual([
      expect.objectContaining({
        sourceId: eventId,
        assignedTo: userId,
        assignedToName: "Jamie Lee",
      }),
      expect.objectContaining({
        sourceId: "20000000-0000-4000-8000-000000000002",
        assignedTo: null,
        assignedToName: null,
      }),
    ]);
  });

  it("reports canAssign as false for a plain member", async () => {
    mocks.createClient.mockResolvedValue(
      createSupabaseMock(
        {
          households: { data: [{ id: householdId, name: "Family" }], error: null },
          ...emptyScheduleTables,
          schedule_task_assignments: { data: [], error: null },
          household_members: { data: { role: "member" }, error: null },
          "rpc:get_household_member_directory": { data: [], error: null },
        },
        { data: { user: { id: userId } }, error: null },
      ).client,
    );

    const data = await getTasksBoardData(householdId);
    expect(data.canAssign).toBe(false);
    expect(data.items).toEqual([]);
  });

  it("falls back to the first household when the requested id is unknown", async () => {
    mocks.createClient.mockResolvedValue(
      createSupabaseMock(
        {
          households: { data: [{ id: householdId, name: "Family" }], error: null },
          ...emptyScheduleTables,
          schedule_task_assignments: { data: [], error: null },
          household_members: { data: null, error: null },
          "rpc:get_household_member_directory": {
            data: [
              {
                user_id: userId,
                first_name: null,
                last_name: null,
                username: "jamie",
                email: null,
              },
              {
                user_id: "00000000-0000-4000-8000-000000000002",
                first_name: null,
                last_name: null,
                username: null,
                email: "robin@example.com",
              },
              {
                user_id: "00000000-0000-4000-8000-000000000003",
                first_name: null,
                last_name: null,
                username: null,
                email: null,
              },
            ],
            error: null,
          },
        },
        { data: { user: { id: userId } }, error: null },
      ).client,
    );

    const data = await getTasksBoardData("unknown-household-id");

    expect(data.selectedHousehold).toEqual({ id: householdId, name: "Family" });
    expect(data.members).toEqual([
      { userId, displayName: "jamie" },
      { userId: "00000000-0000-4000-8000-000000000002", displayName: "robin@example.com" },
      { userId: "00000000-0000-4000-8000-000000000003", displayName: "Household member" },
    ]);
  });
});
