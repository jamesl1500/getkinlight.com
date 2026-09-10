import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@getkinlight.com/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@getkinlight.com/shared")>()),
  createKinlightServerClient: mocks.createClient,
}));

import { GET, PATCH, POST, DELETE } from "./route";

const userId = "00000000-0000-4000-8000-000000000001";
const householdId = "10000000-0000-4000-8000-000000000001";
const itemId = "20000000-0000-4000-8000-000000000001";
const household = { id: householdId, name: "The Smiths" };
const supplyRow = {
  id: itemId,
  household_id: householdId,
  care_recipient_id: null,
  name: "Diapers (size 4)",
  quantity: "1 pack",
  category: "diapers",
  is_checked: false,
  checked_by: null,
  checked_at: null,
  created_at: "2026-08-01T00:00:00.000Z",
  care_recipients: null,
};
const profile = {
  user_id: userId,
  first_name: "Jamie",
  last_name: "Lee",
  username: "jamie",
};

function getRequest(query = "", token = "token") {
  return new Request(`http://localhost/api/supply${query}`, {
    method: "GET",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function mutateRequest(
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
  token = "token",
) {
  return new Request("http://localhost/api/supply", {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("supply API route", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET", () => {
    it("rejects missing authentication", async () => {
      expect((await GET(getRequest("", ""))).status).toBe(401);
    });

    it("rejects when the session cannot be verified", async () => {
      const mock = createSupabaseMock(
        {},
        { data: { user: null }, error: { message: "invalid token" } },
      );
      mocks.createClient.mockReturnValue(mock.client);
      expect((await GET(getRequest())).status).toBe(401);
    });

    it("loads the supply list for the selected household", async () => {
      const mock = createSupabaseMock(
        {
          households: { data: [household], error: null },
          care_recipients: { data: [], error: null },
          household_supply_items: { data: [supplyRow], error: null },
          profiles: { data: [], error: null },
        },
        { data: { user: { id: userId } }, error: null },
      );
      mocks.createClient.mockReturnValue(mock.client);

      const response = await GET(getRequest(`?household=${householdId}`));
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.items).toEqual([
        {
          id: itemId,
          householdId,
          recipientId: null,
          recipientName: null,
          name: "Diapers (size 4)",
          quantity: "1 pack",
          category: "diapers",
          isChecked: false,
          checkedByName: null,
          checkedAt: null,
          createdAt: supplyRow.created_at,
        },
      ]);
      expect(payload.households).toEqual([household]);
    });

    it("returns an empty list when the user has no households", async () => {
      const mock = createSupabaseMock(
        {
          households: { data: [], error: null },
          care_recipients: { data: [], error: null },
        },
        { data: { user: { id: userId } }, error: null },
      );
      mocks.createClient.mockReturnValue(mock.client);

      const response = await GET(getRequest());
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.items).toEqual([]);
    });

    it("returns an error when households cannot be loaded", async () => {
      const mock = createSupabaseMock(
        {
          households: { data: null, error: { message: "boom" } },
          care_recipients: { data: [], error: null },
        },
        { data: { user: { id: userId } }, error: null },
      );
      mocks.createClient.mockReturnValue(mock.client);

      expect((await GET(getRequest())).status).toBe(400);
    });

    it("returns an error when the supply list query fails", async () => {
      const mock = createSupabaseMock(
        {
          households: { data: [household], error: null },
          care_recipients: { data: [], error: null },
          household_supply_items: { data: null, error: { message: "boom" } },
        },
        { data: { user: { id: userId } }, error: null },
      );
      mocks.createClient.mockReturnValue(mock.client);

      expect((await GET(getRequest())).status).toBe(400);
    });

    it("resolves the display name of the member who checked an item", async () => {
      const mock = createSupabaseMock(
        {
          households: { data: [household], error: null },
          care_recipients: { data: [], error: null },
          household_supply_items: {
            data: [{ ...supplyRow, is_checked: true, checked_by: userId }],
            error: null,
          },
          profiles: { data: [profile], error: null },
        },
        { data: { user: { id: userId } }, error: null },
      );
      mocks.createClient.mockReturnValue(mock.client);

      const response = await GET(getRequest());
      const payload = await response.json();

      expect(payload.items[0].checkedByName).toBe("Jamie Lee");
    });
  });

  describe("POST", () => {
    it("rejects missing authentication", async () => {
      const response = await POST(
        mutateRequest(
          "POST",
          { householdId, name: "Diapers" },
          "",
        ),
      );
      expect(response.status).toBe(401);
    });

    it("rejects an invalid request body", async () => {
      const response = await POST(mutateRequest("POST", { householdId }));
      expect(response.status).toBe(400);
    });

    it("rejects when the session cannot be verified", async () => {
      const mock = createSupabaseMock(
        {},
        { data: { user: null }, error: { message: "invalid token" } },
      );
      mocks.createClient.mockReturnValue(mock.client);
      const response = await POST(
        mutateRequest("POST", { householdId, name: "Diapers" }),
      );
      expect(response.status).toBe(401);
    });

    it("adds a supply item", async () => {
      const mock = createSupabaseMock(
        { household_supply_items: { data: supplyRow, error: null } },
        { data: { user: { id: userId } }, error: null },
      );
      mocks.createClient.mockReturnValue(mock.client);

      const response = await POST(
        mutateRequest("POST", {
          householdId,
          name: "Diapers (size 4)",
          quantity: "1 pack",
          category: "diapers",
        }),
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.item).toMatchObject({ name: "Diapers (size 4)" });
    });

    it("returns 403 when RLS forbids adding the item", async () => {
      const mock = createSupabaseMock(
        {
          household_supply_items: {
            data: null,
            error: { code: "42501", message: "forbidden" },
          },
        },
        { data: { user: { id: userId } }, error: null },
      );
      mocks.createClient.mockReturnValue(mock.client);

      const response = await POST(
        mutateRequest("POST", { householdId, name: "Diapers" }),
      );

      expect(response.status).toBe(403);
    });
  });

  describe("PATCH", () => {
    it("rejects missing authentication", async () => {
      const response = await PATCH(
        mutateRequest(
          "PATCH",
          { householdId, itemId, isChecked: true },
          "",
        ),
      );
      expect(response.status).toBe(401);
    });

    it("rejects an invalid request body", async () => {
      const response = await PATCH(mutateRequest("PATCH", { householdId }));
      expect(response.status).toBe(400);
    });

    it("rejects when the session cannot be verified", async () => {
      const mock = createSupabaseMock(
        {},
        { data: { user: null }, error: { message: "invalid token" } },
      );
      mocks.createClient.mockReturnValue(mock.client);
      const response = await PATCH(
        mutateRequest("PATCH", { householdId, itemId, isChecked: true }),
      );
      expect(response.status).toBe(401);
    });

    it("checks off an item and resolves who checked it", async () => {
      const mock = createSupabaseMock(
        {
          household_supply_items: {
            data: { ...supplyRow, is_checked: true, checked_by: userId },
            error: null,
          },
          profiles: { data: profile, error: null },
        },
        { data: { user: { id: userId } }, error: null },
      );
      mocks.createClient.mockReturnValue(mock.client);

      const response = await PATCH(
        mutateRequest("PATCH", { householdId, itemId, isChecked: true }),
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.item.checkedByName).toBe("Jamie Lee");
      expect(payload.message).toBe("Marked as picked up.");
    });

    it("unchecks an item", async () => {
      const mock = createSupabaseMock(
        { household_supply_items: { data: supplyRow, error: null } },
        { data: { user: { id: userId } }, error: null },
      );
      mocks.createClient.mockReturnValue(mock.client);

      const response = await PATCH(
        mutateRequest("PATCH", { householdId, itemId, isChecked: false }),
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.message).toBe("Marked as needed.");
    });

    it("updates only the provided fields, such as quantity", async () => {
      const mock = createSupabaseMock(
        {
          household_supply_items: {
            data: { ...supplyRow, quantity: "2 packs" },
            error: null,
          },
        },
        { data: { user: { id: userId } }, error: null },
      );
      mocks.createClient.mockReturnValue(mock.client);

      const response = await PATCH(
        mutateRequest("PATCH", { householdId, itemId, quantity: "2 packs" }),
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.message).toBe("Supply item updated.");
      expect(payload.item.quantity).toBe("2 packs");
      expect(
        mock.calls.find(
          (call) =>
            call.source === "household_supply_items" && call.method === "update",
        )?.args[0],
      ).toEqual({ quantity: "2 packs" });
    });

    it("returns 403 when RLS forbids updating the item", async () => {
      const mock = createSupabaseMock(
        {
          household_supply_items: {
            data: null,
            error: { code: "42501", message: "forbidden" },
          },
        },
        { data: { user: { id: userId } }, error: null },
      );
      mocks.createClient.mockReturnValue(mock.client);

      const response = await PATCH(
        mutateRequest("PATCH", { householdId, itemId, isChecked: true }),
      );

      expect(response.status).toBe(403);
    });
  });

  describe("DELETE", () => {
    it("rejects missing authentication", async () => {
      const response = await DELETE(
        mutateRequest("DELETE", { householdId, itemId }, ""),
      );
      expect(response.status).toBe(401);
    });

    it("rejects an invalid request body", async () => {
      const response = await DELETE(mutateRequest("DELETE", { householdId }));
      expect(response.status).toBe(400);
    });

    it("rejects when the session cannot be verified", async () => {
      const mock = createSupabaseMock(
        {},
        { data: { user: null }, error: { message: "invalid token" } },
      );
      mocks.createClient.mockReturnValue(mock.client);
      const response = await DELETE(
        mutateRequest("DELETE", { householdId, itemId }),
      );
      expect(response.status).toBe(401);
    });

    it("removes a supply item", async () => {
      const mock = createSupabaseMock(
        { household_supply_items: { data: null, error: null, count: 1 } },
        { data: { user: { id: userId } }, error: null },
      );
      mocks.createClient.mockReturnValue(mock.client);

      const response = await DELETE(
        mutateRequest("DELETE", { householdId, itemId }),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        ok: true,
        message: "Supply item removed.",
      });
    });

    it("returns 403 when RLS forbids removing the item", async () => {
      const mock = createSupabaseMock(
        {
          household_supply_items: {
            data: null,
            error: { message: "forbidden" },
          },
        },
        { data: { user: { id: userId } }, error: null },
      );
      mocks.createClient.mockReturnValue(mock.client);

      const response = await DELETE(
        mutateRequest("DELETE", { householdId, itemId }),
      );

      expect(response.status).toBe(403);
    });

    it("returns 403 when no row was deleted", async () => {
      const mock = createSupabaseMock(
        { household_supply_items: { data: null, error: null, count: 0 } },
        { data: { user: { id: userId } }, error: null },
      );
      mocks.createClient.mockReturnValue(mock.client);

      const response = await DELETE(
        mutateRequest("DELETE", { householdId, itemId }),
      );

      expect(response.status).toBe(403);
    });
  });
});
