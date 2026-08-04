import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  workspace: vi.fn(),
}));

vi.mock("@/lib/care", () => ({
  getCareWorkspaceData: mocks.workspace,
}));
vi.mock("@getkinlight.com/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@getkinlight.com/shared")>()),
  createKinlightServerClient: mocks.createClient,
}));

import { GET } from "./route";

const householdId = "10000000-0000-4000-8000-000000000001";
const recipientId = "20000000-0000-4000-8000-000000000001";

function request(token = "token", recipient = recipientId) {
  return new Request(
    `http://localhost/api/care${recipient ? `?recipient=${recipient}` : ""}`,
    { headers: token ? { authorization: `Bearer ${token}` } : {} },
  );
}

const emptyWorkspace = {
  households: [{ id: householdId, name: "Lee family" }],
  recipients: [],
  selectedRecipient: null,
  medications: [],
  eatingReminders: [],
  checkIns: [],
  notes: [],
  schedule: [],
};

describe("care API GET route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.workspace.mockResolvedValue(emptyWorkspace);
  });

  it("rejects missing and expired sessions", async () => {
    expect((await GET(request(""))).status).toBe(401);

    const supabase = createSupabaseMock(
      {},
      { data: { user: null }, error: new Error("expired") },
    );
    mocks.createClient.mockReturnValue(supabase.client);

    expect((await GET(request())).status).toBe(401);
    expect(mocks.workspace).not.toHaveBeenCalled();
  });

  it("loads a selected recipient workspace with the authenticated client", async () => {
    const supabase = createSupabaseMock({});
    mocks.createClient.mockReturnValue(supabase.client);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      message: "Care workspace loaded.",
      selectedRecipient: null,
    });
    expect(mocks.workspace).toHaveBeenCalledWith(recipientId, supabase.client);
  });

  it("returns a safe workspace query error", async () => {
    const supabase = createSupabaseMock({});
    mocks.createClient.mockReturnValue(supabase.client);
    mocks.workspace.mockRejectedValue(new Error("database details"));

    const response = await GET(request("token", ""));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      message: "Unable to load the care workspace.",
    });
  });
});
