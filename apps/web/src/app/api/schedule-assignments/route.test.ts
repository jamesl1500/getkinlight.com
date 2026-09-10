import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@getkinlight.com/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@getkinlight.com/shared")>()),
  createKinlightServerClient: mocks.createClient,
}));

import { GET, POST } from "./route";

const userId = "00000000-0000-4000-8000-000000000001";
const otherUserId = "00000000-0000-4000-8000-000000000002";
const householdId = "10000000-0000-4000-8000-000000000001";
const resourceId = "20000000-0000-4000-8000-000000000001";
const assignmentRow = {
  id: "30000000-0000-4000-8000-000000000001",
  household_id: householdId,
  resource_type: "event",
  resource_id: resourceId,
  assigned_to: otherUserId,
  claimed_at: "2026-08-01T00:00:00.000Z",
};
const profile = {
  user_id: otherUserId,
  first_name: "Robin",
  last_name: "Kinlight",
  username: "robin",
};

function getRequest(query = "", token = "token") {
  return new Request(`http://localhost/api/schedule-assignments${query}`, {
    method: "GET",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function postRequest(body?: unknown, token = "token") {
  return new Request("http://localhost/api/schedule-assignments", {
    method: "POST",
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("schedule-assignments API route", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET", () => {
    it("rejects missing authentication", async () => {
      expect((await GET(getRequest("", ""))).status).toBe(401);
    });

    it("loads assignments with resolved assignee names", async () => {
      const mock = createSupabaseMock(
        {
          schedule_task_assignments: { data: [assignmentRow], error: null },
          profiles: { data: [profile], error: null },
        },
        { data: { user: { id: userId } }, error: null },
      );
      mocks.createClient.mockReturnValue(mock.client);

      const response = await GET(getRequest(`?household=${householdId}`));
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.assignments).toEqual([
        {
          id: assignmentRow.id,
          householdId,
          resourceType: "event",
          resourceId,
          assignedTo: otherUserId,
          assignedToName: "Robin Kinlight",
          claimedAt: assignmentRow.claimed_at,
        },
      ]);
    });

    it("returns an error when assignments cannot be loaded", async () => {
      const mock = createSupabaseMock(
        { schedule_task_assignments: { data: null, error: { message: "boom" } } },
        { data: { user: { id: userId } }, error: null },
      );
      mocks.createClient.mockReturnValue(mock.client);

      expect((await GET(getRequest())).status).toBe(400);
    });
  });

  describe("POST", () => {
    it("rejects missing authentication", async () => {
      const response = await POST(
        postRequest(
          {
            action: "claim",
            householdId,
            resourceType: "event",
            resourceId,
          },
          "",
        ),
      );
      expect(response.status).toBe(401);
    });

    it("rejects an invalid request body", async () => {
      const response = await POST(postRequest({ action: "not-real" }));
      expect(response.status).toBe(400);
    });

    it("requires an assigneeId when assigning", async () => {
      const mock = createSupabaseMock(
        {},
        { data: { user: { id: userId } }, error: null },
      );
      mocks.createClient.mockReturnValue(mock.client);

      const response = await POST(
        postRequest({
          action: "assign",
          householdId,
          resourceType: "event",
          resourceId,
        }),
      );

      expect(response.status).toBe(400);
    });

    it("claims a task for the current user", async () => {
      const mock = createSupabaseMock(
        {
          schedule_task_assignments: {
            data: { ...assignmentRow, assigned_to: userId },
            error: null,
          },
          profiles: { data: null, error: null },
        },
        { data: { user: { id: userId } }, error: null },
      );
      mocks.createClient.mockReturnValue(mock.client);

      const response = await POST(
        postRequest({
          action: "claim",
          householdId,
          resourceType: "event",
          resourceId,
        }),
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload).toMatchObject({
        ok: true,
        message: "You claimed this task.",
        assignment: { assignedTo: userId },
      });
    });

    it("assigns a task to another member", async () => {
      const mock = createSupabaseMock(
        {
          schedule_task_assignments: { data: assignmentRow, error: null },
          profiles: { data: profile, error: null },
        },
        { data: { user: { id: userId } }, error: null },
      );
      mocks.createClient.mockReturnValue(mock.client);

      const response = await POST(
        postRequest({
          action: "assign",
          householdId,
          resourceType: "event",
          resourceId,
          assigneeId: otherUserId,
        }),
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.message).toBe("You assigned this task.");
      expect(payload.assignment.assignedToName).toBe("Robin Kinlight");
    });

    it("returns 403 when RLS forbids claiming", async () => {
      const mock = createSupabaseMock(
        {
          schedule_task_assignments: {
            data: null,
            error: { code: "42501", message: "forbidden" },
          },
        },
        { data: { user: { id: userId } }, error: null },
      );
      mocks.createClient.mockReturnValue(mock.client);

      const response = await POST(
        postRequest({
          action: "claim",
          householdId,
          resourceType: "event",
          resourceId,
        }),
      );

      expect(response.status).toBe(403);
    });

    it("returns 409 when the task is already claimed", async () => {
      const mock = createSupabaseMock(
        {
          schedule_task_assignments: {
            data: null,
            error: { code: "23505", message: "conflict" },
          },
        },
        { data: { user: { id: userId } }, error: null },
      );
      mocks.createClient.mockReturnValue(mock.client);

      const response = await POST(
        postRequest({
          action: "claim",
          householdId,
          resourceType: "event",
          resourceId,
        }),
      );

      expect(response.status).toBe(409);
    });

    it("releases a claim", async () => {
      const mock = createSupabaseMock(
        { schedule_task_assignments: { data: null, error: null } },
        { data: { user: { id: userId } }, error: null },
      );
      mocks.createClient.mockReturnValue(mock.client);

      const response = await POST(
        postRequest({
          action: "unclaim",
          householdId,
          resourceType: "event",
          resourceId,
        }),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        ok: true,
        message: "You released this task.",
        assignment: null,
      });
    });

    it("returns 403 when the release is blocked by RLS", async () => {
      const mock = createSupabaseMock(
        {
          schedule_task_assignments: {
            data: null,
            error: { message: "forbidden" },
          },
        },
        { data: { user: { id: userId } }, error: null },
      );
      mocks.createClient.mockReturnValue(mock.client);

      const response = await POST(
        postRequest({
          action: "unclaim",
          householdId,
          resourceType: "event",
          resourceId,
        }),
      );

      expect(response.status).toBe(403);
    });
  });
});
