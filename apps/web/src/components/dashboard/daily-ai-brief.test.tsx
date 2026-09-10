import { screen, waitFor } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OPEN_KINLIGHT_AI_EVENT } from "@/components/ai/ai-assistant-modal";
import { render } from "@/test/render";

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@getkinlight.com/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@getkinlight.com/shared")>()),
  createKinlightClient: () => ({ auth: { getSession: mocks.getSession } }),
}));

import { DailyAiBrief } from "./daily-ai-brief";

const householdId = "10000000-0000-4000-8000-000000000001";
const brief = {
  greeting: "Good morning",
  summary: "One appointment needs attention.",
  priorities: ["Confirm transport"],
  changes: [],
  insights: [
    {
      title: "Transport",
      detail: "No driver recorded",
      severity: "attention",
      sourceIds: [],
    },
  ],
  sources: [],
  disclaimer: "Verify important details.",
};

describe("DailyAiBrief", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "token" } },
    });
  });

  it("loads and displays a brief, then dispatches it to the assistant", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, action: "daily-brief", data: brief }),
        { status: 200 },
      ),
    );
    const listener = vi.fn();
    window.addEventListener(OPEN_KINLIGHT_AI_EVENT, listener);
    render(<DailyAiBrief householdId={householdId} />);
    expect(
      screen.getByText("Reviewing your family space..."),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("One appointment needs attention."),
    ).toBeInTheDocument();
    expect(screen.getByText("Confirm transport")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /Ask Kinlight/i }),
    );
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          prompt:
            "I want to discuss today's family brief: One appointment needs attention.",
        },
      }),
    );
    window.removeEventListener(OPEN_KINLIGHT_AI_EVENT, listener);
  });

  it("shows session errors and retries on demand", async () => {
    mocks.getSession
      .mockResolvedValueOnce({ data: { session: null } })
      .mockResolvedValue({ data: { session: { access_token: "token" } } });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, action: "daily-brief", data: brief }),
        { status: 200 },
      ),
    );
    render(<DailyAiBrief householdId={householdId} />);
    expect(
      await screen.findByText("Your session has expired. Sign in again."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Good morning")).toBeInTheDocument();
  });

  it("rejects an unexpected AI action", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          action: "search",
          data: {
            answer: "x",
            sources: [],
            insufficientContext: false,
            disclaimer: "x",
          },
        }),
        { status: 200 },
      ),
    );
    render(<DailyAiBrief householdId={householdId} />);
    await waitFor(() =>
      expect(
        screen.getByText("Kinlight AI returned an unexpected response."),
      ).toBeInTheDocument(),
    );
  });

  it("refreshes an existing brief and displays API errors", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: true, action: "daily-brief", data: brief }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            action: "daily-brief",
            message: "Brief service is busy.",
          }),
          { status: 503 },
        ),
      );
    render(<DailyAiBrief householdId={householdId} />);
    expect(await screen.findByText("Good morning")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Refresh today's brief" }),
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(
      JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body)),
    ).toMatchObject({ refresh: true });
  });

  it("renders without priorities or insights when the brief has none", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          action: "daily-brief",
          data: { ...brief, priorities: [], insights: [] },
        }),
        { status: 200 },
      ),
    );
    render(<DailyAiBrief householdId={householdId} />);
    expect(await screen.findByText("Good morning")).toBeInTheDocument();
    expect(screen.queryByText("Today’s priorities")).not.toBeInTheDocument();
    expect(screen.queryByText("Confirm transport")).not.toBeInTheDocument();
  });

  it("shows a network error message when the fetch rejects", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    render(<DailyAiBrief householdId={householdId} />);
    expect(
      await screen.findByText(
        "Unable to reach Kinlight. Check your connection and try again.",
      ),
    ).toBeInTheDocument();
  });
});
