import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@getkinlight.com/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@getkinlight.com/shared")>()),
  createKinlightServerClient: mocks.createClient,
}));

import { GET, PATCH } from "./route";

const userId = "00000000-0000-4000-8000-000000000001";
const activityId = "10000000-0000-4000-8000-000000000001";
const activity = {
  id: activityId,
  household_id: "20000000-0000-4000-8000-000000000001",
  actor_user_id: null,
  activity_type: "member-joined",
  title: "Family member joined",
  body: "A family member joined the household.",
  resource_type: "household_members",
  resource_id: "30000000-0000-4000-8000-000000000001",
  href: "/family",
  created_at: "2026-08-02T00:00:00.000Z",
};

function request(method = "GET", body?: unknown, token = "token") {
  return new Request("http://localhost/api/notifications", {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("notifications API route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads validated household activity and unread state", async () => {
    const mock = createSupabaseMock(
      {
        household_activity: { data: [activity], error: null },
        notification_reads: { data: [], error: null },
      },
      { data: { user: { id: userId } }, error: null },
    );
    mocks.createClient.mockReturnValue(mock.client);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      unreadCount: 1,
      activities: [{ id: activityId, householdId: activity.household_id }],
    });
  });

  it("rejects missing authentication", async () => {
    expect((await GET(request("GET", undefined, ""))).status).toBe(401);
  });

  it.each([
    [{ action: "mark-read", activityId }, 0],
    [{ action: "mark-all-read" }, 1],
  ] as const)("marks notifications read for %o", async (body, selectCount) => {
    const mock = createSupabaseMock(
      {
        household_activity: { data: [{ id: activityId }], error: null },
        notification_reads: { data: [], error: null },
      },
      { data: { user: { id: userId } }, error: null },
    );
    mocks.createClient.mockReturnValue(mock.client);

    const response = await PATCH(request("PATCH", body));

    expect(response.status).toBe(200);
    expect(
      mock.calls.filter(
        (call) =>
          call.source === "household_activity" && call.method === "select",
      ),
    ).toHaveLength(selectCount);
    expect(mock.calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "notification_reads",
          method: "upsert",
        }),
      ]),
    );
  });

  it("returns an error when the activity or reads query fails", async () => {
    const mock = createSupabaseMock(
      {
        household_activity: { data: null, error: { message: "boom" } },
        notification_reads: { data: [], error: null },
      },
      { data: { user: { id: userId } }, error: null },
    );
    mocks.createClient.mockReturnValue(mock.client);

    const response = await GET(request());
    expect(response.status).toBe(400);
  });

  it("returns 500 when an activity row has an invalid activity type", async () => {
    const mock = createSupabaseMock(
      {
        household_activity: {
          data: [{ ...activity, activity_type: "not-a-real-type" }],
          error: null,
        },
        notification_reads: { data: [], error: null },
      },
      { data: { user: { id: userId } }, error: null },
    );
    mocks.createClient.mockReturnValue(mock.client);

    const response = await GET(request());
    expect(response.status).toBe(500);
  });

  it("rejects an invalid mark-read request body", async () => {
    const mock = createSupabaseMock(
      {},
      { data: { user: { id: userId } }, error: null },
    );
    mocks.createClient.mockReturnValue(mock.client);

    const response = await PATCH(request("PATCH", { action: "not-real" }));
    expect(response.status).toBe(400);
  });

  it("returns an error when loading all activity ids fails", async () => {
    const mock = createSupabaseMock(
      {
        household_activity: { data: null, error: { message: "boom" } },
      },
      { data: { user: { id: userId } }, error: null },
    );
    mocks.createClient.mockReturnValue(mock.client);

    const response = await PATCH(request("PATCH", { action: "mark-all-read" }));
    expect(response.status).toBe(400);
  });

  it("returns an error when marking notifications read fails", async () => {
    const mock = createSupabaseMock(
      {
        notification_reads: { data: null, error: { message: "boom" } },
      },
      { data: { user: { id: userId } }, error: null },
    );
    mocks.createClient.mockReturnValue(mock.client);

    const response = await PATCH(
      request("PATCH", { action: "mark-read", activityId }),
    );
    expect(response.status).toBe(400);
  });
});
