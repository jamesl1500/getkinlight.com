import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@getkinlight.com/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@getkinlight.com/shared")>()),
  createKinlightServerClient: mocks.createClient,
}));

import { GET } from "./route";

const userId = "00000000-0000-4000-8000-000000000001";
const householdId = "10000000-0000-4000-8000-000000000001";
const eventId = "20000000-0000-4000-8000-000000000001";
const household = { id: householdId, name: "Family" };

const emptyScheduleTables = {
  household_events: { data: [], error: null },
  appointments: { data: [], error: null },
  medication_reminders: { data: [], error: null },
  eating_reminders: { data: [], error: null },
};

function request(query = "", token = "token") {
  return new Request(`http://localhost/api/tasks${query}`, {
    method: "GET",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("tasks API route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects missing authentication", async () => {
    expect((await GET(request("", ""))).status).toBe(401);
  });

  it("rejects when the session cannot be verified", async () => {
    const mock = createSupabaseMock(
      {},
      { data: { user: null }, error: { message: "invalid token" } },
    );
    mocks.createClient.mockReturnValue(mock.client);
    expect((await GET(request())).status).toBe(401);
  });

  it("returns an error when households cannot be loaded", async () => {
    const mock = createSupabaseMock(
      { households: { data: null, error: { message: "boom" } } },
      { data: { user: { id: userId } }, error: null },
    );
    mocks.createClient.mockReturnValue(mock.client);
    expect((await GET(request())).status).toBe(400);
  });

  it("returns an empty board when the user has no households", async () => {
    const mock = createSupabaseMock(
      { households: { data: [], error: null } },
      { data: { user: { id: userId } }, error: null },
    );
    mocks.createClient.mockReturnValue(mock.client);

    const response = await GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      selectedHousehold: null,
      canAssign: false,
      members: [],
      items: [],
    });
  });

  it("returns an error when the member directory cannot be loaded", async () => {
    const mock = createSupabaseMock(
      {
        households: { data: [household], error: null },
        ...emptyScheduleTables,
        schedule_task_assignments: { data: [], error: null },
        household_members: { data: null, error: null },
        "rpc:get_household_member_directory": {
          data: null,
          error: { message: "boom" },
        },
      },
      { data: { user: { id: userId } }, error: null },
    );
    mocks.createClient.mockReturnValue(mock.client);
    expect((await GET(request())).status).toBe(400);
  });

  it("builds a task board with assignments and role-based permissions", async () => {
    const mock = createSupabaseMock(
      {
        households: { data: [household], error: null },
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
    );
    mocks.createClient.mockReturnValue(mock.client);

    const response = await GET(request(`?household=${householdId}`));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.canAssign).toBe(true);
    expect(payload.members).toEqual([{ userId, displayName: "Jamie Lee" }]);
    expect(payload.items).toEqual([
      expect.objectContaining({
        sourceId: eventId,
        assignedTo: userId,
        assignedToName: "Jamie Lee",
      }),
    ]);
  });

  it("reports canAssign as false for a plain member", async () => {
    const mock = createSupabaseMock(
      {
        households: { data: [household], error: null },
        ...emptyScheduleTables,
        schedule_task_assignments: { data: [], error: null },
        household_members: { data: { role: "member" }, error: null },
        "rpc:get_household_member_directory": { data: [], error: null },
      },
      { data: { user: { id: userId } }, error: null },
    );
    mocks.createClient.mockReturnValue(mock.client);

    const response = await GET(request(`?household=${householdId}`));
    const payload = await response.json();
    expect(payload.canAssign).toBe(false);
  });
});
