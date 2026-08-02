import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createKinlightServerComponentClient: mocks.createClient,
}));

import { getConversationWorkspaceData } from "./conversations";

const userId = "00000000-0000-4000-8000-000000000001";
const householdId = "10000000-0000-4000-8000-000000000001";
const conversationId = "20000000-0000-4000-8000-000000000001";

describe("getConversationWorkspaceData", () => {
  beforeEach(() => mocks.createClient.mockReset());

  it("requires authentication and handles an empty household list", async () => {
    mocks.createClient.mockResolvedValue(
      createSupabaseMock({}, { data: { user: null }, error: null }).client,
    );
    await expect(getConversationWorkspaceData()).rejects.toThrow(
      "Authentication is required.",
    );

    mocks.createClient.mockResolvedValue(
      createSupabaseMock(
        {},
        { data: { user: { id: userId, email: null } }, error: null },
      ).client,
    );
    await expect(getConversationWorkspaceData()).resolves.toMatchObject({
      currentUserName: "You",
      selectedHousehold: null,
      messages: [],
    });
  });

  it("maps member naming fallbacks when no default conversation exists", async () => {
    const { client } = createSupabaseMock(
      {
        households: {
          data: [{ id: householdId, name: "Family" }],
          error: null,
        },
        household_conversations: { data: null, error: null },
        "rpc:get_household_member_directory": {
          data: [
            {
              user_id: userId,
              first_name: null,
              last_name: null,
              username: "jamie",
              email: "j@example.com",
            },
            {
              user_id: "u2",
              first_name: null,
              last_name: null,
              username: null,
              email: null,
            },
          ],
          error: null,
        },
      },
      {
        data: { user: { id: userId, email: "fallback@example.com" } },
        error: null,
      },
    );
    mocks.createClient.mockResolvedValue(client);
    const data = await getConversationWorkspaceData();
    expect(data.currentUserName).toBe("jamie");
    expect(data.members.map((member) => member.displayName)).toEqual([
      "jamie",
      "Household member",
    ]);
  });

  it("parses a conversation and returns messages in chronological order", async () => {
    const firstMessageId = "30000000-0000-4000-8000-000000000001";
    const secondMessageId = "30000000-0000-4000-8000-000000000002";
    const { client } = createSupabaseMock(
      {
        households: {
          data: [{ id: householdId, name: "Family" }],
          error: null,
        },
        household_conversations: {
          data: {
            id: conversationId,
            household_id: householdId,
            title: "Household",
            is_default: true,
            created_at: "2026-08-01T00:00:00.000Z",
            updated_at: "2026-08-02T00:00:00.000Z",
          },
          error: null,
        },
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
        household_messages: {
          data: [
            {
              id: secondMessageId,
              conversation_id: conversationId,
              household_id: householdId,
              sender_id: userId,
              body: "Second",
              created_at: "2026-08-02T00:00:00.000Z",
              edited_at: null,
            },
            {
              id: firstMessageId,
              conversation_id: conversationId,
              household_id: householdId,
              sender_id: userId,
              body: "First",
              created_at: "2026-08-01T00:00:00.000Z",
              edited_at: null,
            },
          ],
          error: null,
        },
      },
      { data: { user: { id: userId, email: "j@example.com" } }, error: null },
    );
    mocks.createClient.mockResolvedValue(client);
    const data = await getConversationWorkspaceData();
    expect(data.conversation).toMatchObject({
      id: conversationId,
      householdId,
    });
    expect(data.messages.map((message) => message.body)).toEqual([
      "First",
      "Second",
    ]);
    expect(data.currentUserName).toBe("Jamie Lee");
  });

  it("throws household, conversation, member, and message errors", async () => {
    for (const [source, error] of [
      ["households", new Error("households")],
      ["household_conversations", new Error("conversation")],
      ["rpc:get_household_member_directory", new Error("members")],
      ["household_messages", new Error("messages")],
    ] as const) {
      const results: Record<string, { data: unknown; error: unknown }> = {
        households: {
          data: [{ id: householdId, name: "Family" }],
          error: null,
        },
        household_conversations: {
          data: {
            id: conversationId,
            household_id: householdId,
            title: "Household",
            is_default: true,
            created_at: "2026-08-01T00:00:00.000Z",
            updated_at: "2026-08-01T00:00:00.000Z",
          },
          error: null,
        },
        "rpc:get_household_member_directory": { data: [], error: null },
      };
      results[source] = { data: null, error };
      mocks.createClient.mockResolvedValue(
        createSupabaseMock(results, {
          data: { user: { id: userId, email: "j@example.com" } },
          error: null,
        }).client,
      );
      await expect(getConversationWorkspaceData()).rejects.toBe(error);
    }
  });
});
