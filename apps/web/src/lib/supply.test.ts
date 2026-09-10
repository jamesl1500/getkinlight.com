import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createKinlightServerComponentClient: mocks.createClient,
}));

import { getSupplyWorkspaceData } from "./supply";

const householdId = "10000000-0000-4000-8000-000000000001";
const itemId = "20000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000001";

describe("getSupplyWorkspaceData", () => {
  beforeEach(() => mocks.createClient.mockReset());

  it("throws when households cannot be loaded", async () => {
    mocks.createClient.mockResolvedValue(
      createSupabaseMock({
        households: { data: null, error: new Error("boom") },
        care_recipients: { data: [], error: null },
      }).client,
    );
    await expect(getSupplyWorkspaceData()).rejects.toThrow("boom");
  });

  it("throws when recipients cannot be loaded", async () => {
    mocks.createClient.mockResolvedValue(
      createSupabaseMock({
        households: { data: [], error: null },
        care_recipients: { data: null, error: new Error("boom") },
      }).client,
    );
    await expect(getSupplyWorkspaceData()).rejects.toThrow("boom");
  });

  it("returns an empty workspace when there is no household", async () => {
    mocks.createClient.mockResolvedValue(
      createSupabaseMock({
        households: { data: [], error: null },
        care_recipients: { data: [], error: null },
      }).client,
    );
    const data = await getSupplyWorkspaceData();
    expect(data).toEqual({
      households: [],
      selectedHousehold: null,
      recipients: [],
      items: [],
    });
  });

  it("throws when the supply items query fails", async () => {
    mocks.createClient.mockResolvedValue(
      createSupabaseMock({
        households: { data: [{ id: householdId, name: "Family" }], error: null },
        care_recipients: { data: [], error: null },
        household_supply_items: { data: null, error: new Error("boom") },
      }).client,
    );
    await expect(getSupplyWorkspaceData()).rejects.toThrow("boom");
  });

  it("resolves recipient and checked-by display names", async () => {
    mocks.createClient.mockResolvedValue(
      createSupabaseMock({
        households: { data: [{ id: householdId, name: "Family" }], error: null },
        care_recipients: {
          data: [
            {
              id: "30000000-0000-4000-8000-000000000001",
              household_id: householdId,
              first_name: "Pat",
              preferred_name: null,
            },
          ],
          error: null,
        },
        household_supply_items: {
          data: [
            {
              id: itemId,
              household_id: householdId,
              care_recipient_id: "30000000-0000-4000-8000-000000000001",
              name: "Diapers",
              quantity: "1 pack",
              category: "diapers",
              is_checked: true,
              checked_by: userId,
              checked_at: "2026-08-01T00:00:00.000Z",
              created_at: "2026-07-30T00:00:00.000Z",
              care_recipients: { first_name: "Pat", preferred_name: "Patsy" },
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
      }).client,
    );

    const data = await getSupplyWorkspaceData(householdId);

    expect(data.selectedHousehold).toEqual({ id: householdId, name: "Family" });
    expect(data.recipients).toEqual([
      { id: "30000000-0000-4000-8000-000000000001", householdId, name: "Pat" },
    ]);
    expect(data.items).toEqual([
      expect.objectContaining({
        id: itemId,
        recipientName: "Patsy",
        checkedByName: "Jamie Lee",
      }),
    ]);
  });

  it("returns null recipient and checked-by names when there is nothing to resolve", async () => {
    mocks.createClient.mockResolvedValue(
      createSupabaseMock({
        households: { data: [{ id: householdId, name: "Family" }], error: null },
        care_recipients: { data: [], error: null },
        household_supply_items: {
          data: [
            {
              id: itemId,
              household_id: householdId,
              care_recipient_id: null,
              name: "Milk",
              quantity: null,
              category: "groceries",
              is_checked: false,
              checked_by: null,
              checked_at: null,
              created_at: "2026-07-30T00:00:00.000Z",
              care_recipients: null,
            },
          ],
          error: null,
        },
      }).client,
    );

    const data = await getSupplyWorkspaceData(householdId);
    expect(data.items[0]).toMatchObject({
      recipientName: null,
      checkedByName: null,
    });
  });

  it("falls back to first name and username, and handles array-shaped recipient rows", async () => {
    mocks.createClient.mockResolvedValue(
      createSupabaseMock({
        households: { data: [{ id: householdId, name: "Family" }], error: null },
        care_recipients: {
          data: [
            {
              id: "30000000-0000-4000-8000-000000000002",
              household_id: householdId,
              first_name: "Pat",
              preferred_name: null,
            },
          ],
          error: null,
        },
        household_supply_items: {
          data: [
            {
              id: itemId,
              household_id: householdId,
              care_recipient_id: "30000000-0000-4000-8000-000000000002",
              name: "Diapers",
              quantity: null,
              category: "diapers",
              is_checked: true,
              checked_by: userId,
              checked_at: "2026-08-01T00:00:00.000Z",
              created_at: "2026-07-30T00:00:00.000Z",
              care_recipients: [{ first_name: "Pat", preferred_name: null }],
            },
          ],
          error: null,
        },
        profiles: {
          data: [
            { user_id: userId, first_name: null, last_name: null, username: "jamie" },
          ],
          error: null,
        },
      }).client,
    );

    const data = await getSupplyWorkspaceData(householdId);
    expect(data.recipients[0]?.name).toBe("Pat");
    expect(data.items[0]).toMatchObject({
      recipientName: "Pat",
      checkedByName: "jamie",
    });
  });

  it("returns a null display name when the checked-by profile has no name fields", async () => {
    mocks.createClient.mockResolvedValue(
      createSupabaseMock({
        households: { data: [{ id: householdId, name: "Family" }], error: null },
        care_recipients: { data: [], error: null },
        household_supply_items: {
          data: [
            {
              id: itemId,
              household_id: householdId,
              care_recipient_id: null,
              name: "Milk",
              quantity: null,
              category: "groceries",
              is_checked: true,
              checked_by: userId,
              checked_at: "2026-08-01T00:00:00.000Z",
              created_at: "2026-07-30T00:00:00.000Z",
              care_recipients: null,
            },
          ],
          error: null,
        },
        profiles: {
          data: [
            { user_id: userId, first_name: null, last_name: null, username: null },
          ],
          error: null,
        },
      }).client,
    );

    const data = await getSupplyWorkspaceData(householdId);
    expect(data.items[0]?.checkedByName).toBeNull();
  });
});
