import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@getkinlight.com/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@getkinlight.com/shared")>()),
  createKinlightServerClient: mocks.createClient,
}));

import { PATCH } from "./route";

const userId = "00000000-0000-4000-8000-000000000001";
const preferences = {
  careUpdatesEnabled: true,
  scheduleRemindersEnabled: true,
  invitationsEnabled: false,
};

function request(body?: unknown, token = "token") {
  return new Request("http://localhost/api/notifications/devices", {
    method: "PATCH",
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("notification devices API route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects missing authentication", async () => {
    const response = await PATCH(request({ action: "unregister", deviceId: "d1" }, ""));
    expect(response.status).toBe(401);
  });

  it("rejects an invalid request body", async () => {
    const mock = createSupabaseMock(
      { notification_devices: { data: null, error: null } },
      { data: { user: { id: userId } }, error: null },
    );
    mocks.createClient.mockReturnValue(mock.client);

    const response = await PATCH(request({ action: "not-a-real-action" }));
    expect(response.status).toBe(400);
  });

  it("registers a device", async () => {
    const mock = createSupabaseMock(
      { notification_devices: { data: null, error: null } },
      { data: { user: { id: userId } }, error: null },
    );
    mocks.createClient.mockReturnValue(mock.client);

    const response = await PATCH(
      request({
        action: "register",
        deviceId: "device-1",
        expoPushToken: "ExponentPushToken[abc123]",
        platform: "ios",
        preferences,
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      registered: true,
      preferences,
    });
    expect(mock.calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "notification_devices",
          method: "upsert",
        }),
      ]),
    );
  });

  it("updates device preferences", async () => {
    const mock = createSupabaseMock(
      { notification_devices: { data: null, error: null } },
      { data: { user: { id: userId } }, error: null },
    );
    mocks.createClient.mockReturnValue(mock.client);

    const response = await PATCH(
      request({
        action: "update-preferences",
        deviceId: "device-1",
        preferences,
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      registered: true,
      message: "Notification preferences updated.",
    });
  });

  it("unregisters a device", async () => {
    const mock = createSupabaseMock(
      { notification_devices: { data: null, error: null } },
      { data: { user: { id: userId } }, error: null },
    );
    mocks.createClient.mockReturnValue(mock.client);

    const response = await PATCH(
      request({ action: "unregister", deviceId: "device-1" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      registered: false,
      preferences: null,
      message: "Notifications disabled on this device.",
    });
  });

  it("returns an error when the database update fails", async () => {
    const mock = createSupabaseMock(
      { notification_devices: { data: null, error: { message: "boom" } } },
      { data: { user: { id: userId } }, error: null },
    );
    mocks.createClient.mockReturnValue(mock.client);

    const response = await PATCH(
      request({ action: "unregister", deviceId: "device-1" }),
    );

    expect(response.status).toBe(400);
  });
});
