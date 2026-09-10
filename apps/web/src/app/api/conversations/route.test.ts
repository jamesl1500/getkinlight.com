import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@getkinlight.com/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@getkinlight.com/shared")>()),
  createKinlightServerClient: mocks.createClient,
}));

import { GET } from "./route";

const userId = "00000000-0000-4000-8000-000000000001";
const householdId = "20000000-0000-4000-8000-000000000001";
const conversationId = "30000000-0000-4000-8000-000000000001";
const household = { id: householdId, name: "The Smiths" };
const conversationRow = {
  id: conversationId,
  household_id: householdId,
  title: "Household chat",
  is_default: true,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
};
const directoryRow = {
  user_id: userId,
  first_name: "Jamie",
  last_name: "Lee",
  username: "jamie",
  email: "jamie@example.com",
};
const messageRow = {
  id: "40000000-0000-4000-8000-000000000001",
  conversation_id: conversationId,
  household_id: householdId,
  sender_id: userId,
  body: "Hello family",
  created_at: "2026-08-01T00:01:00.000Z",
  edited_at: null,
};

function request(token = "token") {
  return new Request("http://localhost/api/conversations", {
    method: "GET",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("conversations API route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects missing authentication", async () => {
    expect((await GET(request(""))).status).toBe(401);
  });

  it("rejects when the session cannot be verified", async () => {
    const mock = createSupabaseMock(
      {},
      { data: { user: null }, error: { message: "invalid token" } },
    );
    mocks.createClient.mockReturnValue(mock.client);

    expect((await GET(request())).status).toBe(401);
  });

  it("returns an empty workspace when the user has no households", async () => {
    const mock = createSupabaseMock(
      { households: { data: [], error: null } },
      { data: { user: { id: userId, email: "jamie@example.com" } }, error: null },
    );
    mocks.createClient.mockReturnValue(mock.client);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      selectedHousehold: null,
      conversation: null,
      messages: [],
      members: [],
    });
  });

  it("returns household data with no default conversation yet", async () => {
    const mock = createSupabaseMock(
      {
        households: { data: [household], error: null },
        household_conversations: { data: null, error: null },
        "rpc:get_household_member_directory": { data: [directoryRow], error: null },
      },
      { data: { user: { id: userId, email: "jamie@example.com" } }, error: null },
    );
    mocks.createClient.mockReturnValue(mock.client);

    const response = await GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.selectedHousehold).toEqual(household);
    expect(payload.conversation).toBeNull();
    expect(payload.members).toEqual([{ userId, displayName: "Jamie Lee" }]);
  });

  it("returns the conversation and its recent messages", async () => {
    const mock = createSupabaseMock(
      {
        households: { data: [household], error: null },
        household_conversations: { data: conversationRow, error: null },
        "rpc:get_household_member_directory": { data: [directoryRow], error: null },
        household_messages: { data: [messageRow], error: null },
      },
      { data: { user: { id: userId, email: "jamie@example.com" } }, error: null },
    );
    mocks.createClient.mockReturnValue(mock.client);

    const response = await GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.conversation).toMatchObject({ id: conversationId });
    expect(payload.messages).toEqual([
      {
        id: messageRow.id,
        conversationId,
        householdId,
        senderId: userId,
        body: "Hello family",
        createdAt: messageRow.created_at,
        editedAt: null,
      },
    ]);
    expect(payload.currentUserName).toBe("Jamie Lee");
  });

  it("returns an error when households cannot be loaded", async () => {
    const mock = createSupabaseMock(
      { households: { data: null, error: { message: "boom" } } },
      { data: { user: { id: userId } }, error: null },
    );
    mocks.createClient.mockReturnValue(mock.client);

    expect((await GET(request())).status).toBe(400);
  });

  it("returns an error when the conversation or directory cannot be loaded", async () => {
    const mock = createSupabaseMock(
      {
        households: { data: [household], error: null },
        household_conversations: { data: null, error: { message: "boom" } },
        "rpc:get_household_member_directory": { data: [], error: null },
      },
      { data: { user: { id: userId } }, error: null },
    );
    mocks.createClient.mockReturnValue(mock.client);

    expect((await GET(request())).status).toBe(400);
  });

  it("returns an error when messages cannot be loaded", async () => {
    const mock = createSupabaseMock(
      {
        households: { data: [household], error: null },
        household_conversations: { data: conversationRow, error: null },
        "rpc:get_household_member_directory": { data: [directoryRow], error: null },
        household_messages: { data: null, error: { message: "boom" } },
      },
      { data: { user: { id: userId } }, error: null },
    );
    mocks.createClient.mockReturnValue(mock.client);

    expect((await GET(request())).status).toBe(400);
  });

  it("returns an error when the member directory query fails", async () => {
    const mock = createSupabaseMock(
      {
        households: { data: [household], error: null },
        household_conversations: { data: conversationRow, error: null },
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

  it("falls back to 'You' when the user has no email and is not a member", async () => {
    const mock = createSupabaseMock(
      {
        households: { data: [], error: null },
      },
      { data: { user: { id: userId, email: null } }, error: null },
    );
    mocks.createClient.mockReturnValue(mock.client);

    const response = await GET(request());
    const payload = await response.json();

    expect(payload.currentUserName).toBe("You");
  });
});
