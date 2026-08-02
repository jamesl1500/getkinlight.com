import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  context: vi.fn(),
  generate: vi.fn(),
  extract: vi.fn(),
}));

vi.mock("@getkinlight.com/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@getkinlight.com/shared")>()),
  createKinlightServerClient: mocks.createClient,
}));
vi.mock("@/lib/ai/household-context", () => ({
  getHouseholdAiContext: mocks.context,
}));
vi.mock("@/lib/ai/anthropic", () => ({
  generateStructured: mocks.generate,
  extractDocument: mocks.extract,
}));

import { POST } from "./route";

const householdId = "10000000-0000-4000-8000-000000000001";
const recipientId = "20000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000001";

const brief = {
  greeting: "Good morning",
  summary: "A calm day.",
  priorities: [],
  changes: [],
  insights: [],
  sources: [],
  disclaimer:
    "AI-generated summary. Verify important details in the source records.",
};
const conversation = {
  answer: "Everything recorded looks steady.",
  sources: [],
  suggestedPrompts: ["What is next?"],
  disclaimer:
    "AI-generated answer based on Kinlight records; verify important details.",
};
const handoff = {
  title: "Handoff",
  summary: "Steady",
  wellbeing: [],
  medications: [],
  upcoming: [],
  followUps: [],
  sources: [],
  disclaimer:
    "AI-generated handoff. Verify medications and urgent details with the source records.",
};
const search = {
  answer: "No appointment is recorded.",
  sources: [],
  insufficientContext: true,
  disclaimer:
    "AI-generated answer based on Kinlight records; verify important details.",
};
const proposal = {
  type: "event" as const,
  householdId,
  recipientId,
  title: "Visit",
  date: "2026-08-03",
  time: "14:00",
  location: null,
  notes: null,
  providerName: null,
  dosage: null,
  mealType: null,
  isAllDay: false,
  confidence: 0.9,
  needsReview: [],
};

function request(body: unknown, token = "token") {
  return new Request("http://localhost/api/ai", {
    method: "POST",
    headers: token
      ? { authorization: `Bearer ${token}`, "content-type": "application/json" }
      : { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function client(
  options: {
    user?: boolean;
    cache?: unknown;
    cacheError?: unknown;
    upsertError?: unknown;
  } = {},
) {
  const cacheBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({
      data: options.cache ?? null,
      error: options.cacheError ?? null,
    })),
    upsert: vi.fn(async () => ({ error: options.upsertError ?? null })),
  };
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: options.user === false ? null : { id: userId } },
        error: options.user === false ? new Error("invalid") : null,
      })),
    },
    from: vi.fn(() => cacheBuilder),
    cacheBuilder,
  };
}

describe("AI API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const defaultClient = client();
    mocks.createClient.mockReturnValue(defaultClient);
    mocks.context.mockResolvedValue({
      household: { id: householdId },
      recipients: [{ id: recipientId }],
      schedule: {},
      checkIns: [],
      notes: [],
    });
  });

  it("rejects missing and invalid sessions", async () => {
    const missing = await POST(
      request({ action: "search", householdId, query: "next appointment" }, ""),
    );
    expect(missing.status).toBe(401);
    expect(await missing.json()).toMatchObject({
      ok: false,
      message: "Your session has expired.",
    });

    mocks.createClient.mockReturnValue(client({ user: false }));
    const invalid = await POST(
      request({ action: "search", householdId, query: "next appointment" }),
    );
    expect(invalid.status).toBe(401);
    expect(mocks.context).not.toHaveBeenCalled();
  });

  it("returns a cached daily brief without calling Claude", async () => {
    mocks.createClient.mockReturnValue(client({ cache: { content: brief } }));
    const result = await POST(
      request({ action: "daily-brief", householdId, date: "2026-08-02" }),
    );
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({
      ok: true,
      action: "daily-brief",
      data: brief,
    });
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("generates and caches a refreshed daily brief", async () => {
    const routeClient = client();
    mocks.createClient.mockReturnValue(routeClient);
    mocks.generate.mockResolvedValue(brief);
    const result = await POST(
      request({
        action: "daily-brief",
        householdId,
        date: "2026-08-02",
        refresh: true,
      }),
    );
    expect(await result.json()).toMatchObject({ ok: true, data: brief });
    expect(routeClient.cacheBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        household_id: householdId,
        generated_by: userId,
        content: brief,
      }),
      { onConflict: "household_id,brief_date" },
    );
  });

  it.each([
    [
      "conversation",
      {
        action: "conversation",
        householdId,
        messages: [{ role: "user", content: "How are things?" }],
      },
      conversation,
    ],
    ["handoff", { action: "handoff", householdId, recipientId: null }, handoff],
    [
      "search",
      { action: "search", householdId, query: "next appointment" },
      search,
    ],
  ])("returns a validated %s response", async (action, input, output) => {
    mocks.generate.mockResolvedValue(output);
    const result = await POST(request(input));
    expect(await result.json()).toMatchObject({
      ok: true,
      action,
      data: output,
    });
    expect(mocks.generate).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("Never diagnose"),
      expect.any(String),
    );
  });

  it("forces captured schedules to the requested household and known recipients", async () => {
    mocks.generate.mockResolvedValue({
      ...proposal,
      householdId: "30000000-0000-4000-8000-000000000001",
      recipientId: "30000000-0000-4000-8000-000000000002",
    });
    const result = await POST(
      request({
        action: "capture-schedule",
        householdId,
        text: "Visit tomorrow at 2",
        today: "2026-08-02",
        timeZone: "UTC",
      }),
    );
    expect((await result.json()).data).toMatchObject({
      householdId,
      recipientId: null,
    });
  });

  it("sanitizes extracted schedule ownership while preserving a selected recipient", async () => {
    mocks.extract.mockResolvedValue({
      documentType: "appointment_card",
      summary: "Appointment",
      extractedText: "Visit",
      scheduleProposal: {
        ...proposal,
        recipientId: "30000000-0000-4000-8000-000000000002",
      },
      instructions: [],
      warnings: [],
      disclaimer:
        "AI-extracted draft. Compare every detail with the original document before saving.",
    });
    const result = await POST(
      request({
        action: "document-extract",
        householdId,
        recipientId,
        fileName: "card.png",
        mediaType: "image/png",
        base64: "eA==",
      }),
    );
    expect((await result.json()).data.scheduleProposal).toMatchObject({
      householdId,
      recipientId,
    });
  });

  it("maps configuration, permission, and validation failures to safe statuses", async () => {
    for (const [error, status] of [
      [new Error("AI is not configured"), 503],
      [new Error("row violates permission"), 403],
      [new Error("invalid input"), 400],
    ] as const) {
      mocks.context.mockRejectedValueOnce(error);
      const result = await POST(
        request({ action: "search", householdId, query: "question" }),
      );
      expect(result.status).toBe(status);
      expect(await result.json()).toMatchObject({
        ok: false,
        message: error.message,
      });
    }
  });
});
