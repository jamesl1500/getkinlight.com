import { describe, expect, it } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";
import {
  getAssignableMembersByHousehold,
  getScheduleAssignments,
} from "./schedule-assignments";

const householdId = "10000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000001";
const otherUserId = "00000000-0000-4000-8000-000000000002";

describe("getScheduleAssignments", () => {
  it("returns an empty array without querying when there are no households", async () => {
    const mock = createSupabaseMock({});
    const result = await getScheduleAssignments([], mock.client as never);
    expect(result).toEqual([]);
    expect(mock.calls).toHaveLength(0);
  });

  it("throws when the assignments query fails", async () => {
    const mock = createSupabaseMock({
      schedule_task_assignments: { data: null, error: new Error("boom") },
    });
    await expect(
      getScheduleAssignments([householdId], mock.client as never),
    ).rejects.toThrow("boom");
  });

  it("resolves assignee display names, falling back through name fields", async () => {
    const mock = createSupabaseMock({
      schedule_task_assignments: {
        data: [
          {
            id: "20000000-0000-4000-8000-000000000001",
            household_id: householdId,
            resource_type: "event",
            resource_id: "30000000-0000-4000-8000-000000000001",
            assigned_to: otherUserId,
            claimed_at: "2026-08-01T00:00:00.000Z",
          },
          {
            id: "20000000-0000-4000-8000-000000000002",
            household_id: householdId,
            resource_type: "meal",
            resource_id: "30000000-0000-4000-8000-000000000002",
            assigned_to: null,
            claimed_at: null,
          },
        ],
        error: null,
      },
      profiles: {
        data: [
          {
            user_id: otherUserId,
            first_name: null,
            last_name: null,
            username: "robin",
          },
        ],
        error: null,
      },
    });

    const result = await getScheduleAssignments([householdId], mock.client as never);

    expect(result).toEqual([
      expect.objectContaining({ assignedTo: otherUserId, assignedToName: "robin" }),
      expect.objectContaining({ assignedTo: null, assignedToName: null }),
    ]);
  });

  it("returns null names when the assignee has no profile row", async () => {
    const mock = createSupabaseMock({
      schedule_task_assignments: {
        data: [
          {
            id: "20000000-0000-4000-8000-000000000001",
            household_id: householdId,
            resource_type: "event",
            resource_id: "30000000-0000-4000-8000-000000000001",
            assigned_to: otherUserId,
            claimed_at: "2026-08-01T00:00:00.000Z",
          },
        ],
        error: null,
      },
      profiles: { data: [], error: null },
    });

    const result = await getScheduleAssignments([householdId], mock.client as never);
    expect(result[0]?.assignedToName).toBeNull();
  });

  it("returns null when the assignee profile has no name or username", async () => {
    const mock = createSupabaseMock({
      schedule_task_assignments: {
        data: [
          {
            id: "20000000-0000-4000-8000-000000000001",
            household_id: householdId,
            resource_type: "event",
            resource_id: "30000000-0000-4000-8000-000000000001",
            assigned_to: otherUserId,
            claimed_at: "2026-08-01T00:00:00.000Z",
          },
        ],
        error: null,
      },
      profiles: {
        data: [
          {
            user_id: otherUserId,
            first_name: null,
            last_name: null,
            username: null,
          },
        ],
        error: null,
      },
    });

    const result = await getScheduleAssignments([householdId], mock.client as never);
    expect(result[0]?.assignedToName).toBeNull();
  });
});

describe("getAssignableMembersByHousehold", () => {
  it("returns empty maps when there are no households", async () => {
    const mock = createSupabaseMock({});
    const result = await getAssignableMembersByHousehold(
      [],
      userId,
      mock.client as never,
    );
    expect(result).toEqual({ canAssignByHousehold: {}, membersByHousehold: {} });
  });

  it("throws when the membership query fails", async () => {
    const mock = createSupabaseMock({
      household_members: { data: null, error: new Error("boom") },
    });
    await expect(
      getAssignableMembersByHousehold([{ id: householdId }], userId, mock.client as never),
    ).rejects.toThrow("boom");
  });

  it("only loads the member directory for households the user can assign in", async () => {
    const mock = createSupabaseMock({
      household_members: {
        data: [{ household_id: householdId, role: "owner" }],
        error: null,
      },
      "rpc:get_household_member_directory": {
        data: [
          {
            user_id: otherUserId,
            first_name: "Robin",
            last_name: "Kinlight",
            username: null,
            email: null,
          },
        ],
        error: null,
      },
    });

    const otherHouseholdId = "10000000-0000-4000-8000-000000000002";
    const result = await getAssignableMembersByHousehold(
      [{ id: householdId }, { id: otherHouseholdId }],
      userId,
      mock.client as never,
    );

    expect(result.canAssignByHousehold).toEqual({
      [householdId]: true,
    });
    expect(result.membersByHousehold[householdId]).toEqual([
      { userId: otherUserId, displayName: "Robin Kinlight" },
    ]);
    expect(result.membersByHousehold[otherHouseholdId]).toEqual([]);
  });

  it("falls back through username and email, then a default label", async () => {
    const mock = createSupabaseMock({
      household_members: {
        data: [{ household_id: householdId, role: "caregiver" }],
        error: null,
      },
      "rpc:get_household_member_directory": {
        data: [
          {
            user_id: otherUserId,
            first_name: null,
            last_name: null,
            username: "robin",
            email: null,
          },
          {
            user_id: userId,
            first_name: null,
            last_name: null,
            username: null,
            email: "jamie@example.com",
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
    });

    const result = await getAssignableMembersByHousehold(
      [{ id: householdId }],
      userId,
      mock.client as never,
    );

    expect(result.membersByHousehold[householdId]).toEqual([
      { userId: otherUserId, displayName: "robin" },
      { userId, displayName: "jamie@example.com" },
      { userId: "00000000-0000-4000-8000-000000000003", displayName: "Household member" },
    ]);
  });
});
