import { screen, waitFor } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@getkinlight.com/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@getkinlight.com/shared")>()),
  createKinlightClient: () => ({ auth: { getSession: mocks.getSession } }),
}));

import { AiWorkspace } from "./ai-workspace";

const householdId = "10000000-0000-4000-8000-000000000001";
const recipientId = "20000000-0000-4000-8000-000000000001";

describe("AiWorkspace", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "token" } },
    });
  });

  it("shows an actionable empty state without a household", () => {
    render(<AiWorkspace households={[]} recipients={[]} />);
    expect(
      screen.getByRole("heading", { name: "Kinlight AI" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Create a household before using family intelligence tools.",
      ),
    ).toBeInTheDocument();
  });

  it("reports an expired session through the visible status area", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    render(
      <AiWorkspace
        households={[{ id: householdId, name: "Family" }]}
        recipients={[]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your session has expired. Sign in again.",
    );
  });

  it("searches household records and renders insufficient-context guidance", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          action: "search",
          data: {
            answer: "No appointment is recorded.",
            sources: [],
            insufficientContext: true,
            disclaimer: "Verify important details.",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    render(
      <AiWorkspace
        households={[{ id: householdId, name: "Family" }]}
        recipients={[]}
      />,
    );
    await userEvent.type(
      screen.getByPlaceholderText("When is Dad's next appointment?"),
      "next appointment",
    );
    await userEvent.click(screen.getByRole("button", { name: "Ask Kinlight" }));
    expect(
      await screen.findByText("No appointment is recorded."),
    ).toBeInTheDocument();
    expect(screen.getByText("More context is needed.")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/ai",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("renders a detailed daily brief and recipient handoff", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            action: "daily-brief",
            data: {
              greeting: "Good morning",
              summary: "Two details need attention.",
              priorities: ["Confirm transport"],
              changes: ["Appointment moved"],
              insights: [
                {
                  title: "Timing",
                  detail: "Leave early",
                  severity: "attention",
                  sourceIds: [],
                },
              ],
              sources: [],
              disclaimer: "Verify important details.",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            action: "handoff",
            data: {
              title: "Pat handoff",
              summary: "Pat is doing well.",
              wellbeing: ["Rested"],
              medications: ["Morning dose complete"],
              upcoming: ["Visit at 2 PM"],
              followUps: ["Call the clinic"],
              sources: [],
              disclaimer: "Verify medications.",
            },
          }),
          { status: 200 },
        ),
      );
    render(
      <AiWorkspace
        households={[{ id: householdId, name: "Family" }]}
        recipients={[{ id: recipientId, householdId, name: "Pat" }]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(await screen.findByText("Good morning")).toBeInTheDocument();
    expect(screen.getByText("Appointment moved")).toBeInTheDocument();
    expect(screen.getByText("Leave early")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByRole("combobox"), recipientId);
    await userEvent.click(
      screen.getByRole("button", { name: "Build handoff" }),
    );
    expect(await screen.findByText("Pat handoff")).toBeInTheDocument();
    expect(screen.getByText("Morning dose complete")).toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/ai",
      expect.objectContaining({ body: expect.stringContaining(recipientId) }),
    );
  });

  it("captures and saves an AI schedule draft", async () => {
    const proposal = {
      type: "event",
      householdId,
      recipientId,
      title: "Family visit",
      date: "2026-08-03",
      time: "14:00",
      location: "Home",
      notes: null,
      providerName: null,
      dosage: null,
      mealType: null,
      isAllDay: false,
      confidence: 0.95,
      needsReview: [],
    };
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            action: "capture-schedule",
            data: proposal,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: true, message: "Schedule saved.", item: null }),
          { status: 200 },
        ),
      );
    render(
      <AiWorkspace
        households={[{ id: householdId, name: "Family" }]}
        recipients={[{ id: recipientId, householdId, name: "Pat" }]}
      />,
    );
    await userEvent.type(
      screen.getByPlaceholderText(
        "Mom has a cardiology appointment Friday at 2 PM with Dr. Lee.",
      ),
      "Visit tomorrow at 2",
    );
    await userEvent.click(screen.getByRole("button", { name: "Create draft" }));
    expect(await screen.findByText("Family visit")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm & save" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Schedule saved.",
    );
    expect(screen.queryByText("Family visit")).not.toBeInTheDocument();
  });

  it("handles unavailable voice capture and oversized files", async () => {
    render(
      <AiWorkspace
        households={[{ id: householdId, name: "Family" }]}
        recipients={[]}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Capture with voice" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Voice capture is not available",
    );

    const input = screen.getByLabelText(/Appointment card/i);
    const largeFile = new File([new Uint8Array(10_000_001)], "large.pdf", {
      type: "application/pdf",
    });
    await userEvent.upload(input, largeFile);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "smaller than 10 MB",
      ),
    );
  });

  it("transcribes supported voice capture and reports recognition errors", async () => {
    const recognitions: Array<{
      onresult: (event: {
        results: ArrayLike<{ 0: { transcript: string } }>;
      }) => void;
      onerror: () => void;
    }> = [];
    class Recognition {
      continuous = true;
      interimResults = true;
      lang = "";
      onresult = () => undefined;
      onerror = () => undefined;
      start() {
        recognitions.push(this);
      }
    }
    Object.assign(window, { webkitSpeechRecognition: Recognition });
    render(
      <AiWorkspace
        households={[{ id: householdId, name: "Family" }]}
        recipients={[]}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Capture with voice" }),
    );
    recognitions[0].onresult({
      results: [{ 0: { transcript: "Visit Friday" } }],
    });
    expect(await screen.findByDisplayValue("Visit Friday")).toBeInTheDocument();
    recognitions[0].onerror();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Voice capture stopped",
    );
    delete (
      window as typeof window & { webkitSpeechRecognition?: typeof Recognition }
    ).webkitSpeechRecognition;
  });

  it("extracts a document proposal and saves its medication schedule", async () => {
    const medication = {
      type: "medication",
      householdId,
      recipientId: null,
      title: "Evening medicine",
      date: "2026-08-03",
      time: "20:00",
      location: null,
      notes: "With water",
      providerName: null,
      dosage: "5 mg",
      mealType: null,
      isAllDay: false,
      confidence: 0.8,
      needsReview: ["Confirm dosage"],
    };
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            action: "document-extract",
            data: {
              documentType: "medication_label",
              summary: "A medication label.",
              extractedText: "Take 5 mg",
              scheduleProposal: medication,
              instructions: ["Take with water"],
              warnings: ["Confirm dosage"],
              disclaimer: "Compare with the original.",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            message: "Medication saved.",
            item: null,
          }),
          { status: 200 },
        ),
      );
    render(
      <AiWorkspace
        households={[{ id: householdId, name: "Family" }]}
        recipients={[]}
      />,
    );

    await userEvent.upload(
      screen.getByLabelText(/Appointment card/i),
      new File(["label"], "label.png", { type: "image/png" }),
    );
    expect(await screen.findByText("medication label")).toBeInTheDocument();
    expect(screen.getByText("Take with water")).toBeInTheDocument();
    expect(screen.getAllByText("Confirm dosage")).toHaveLength(2);
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm & save" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Medication saved.",
    );
  });

  it("shows API response errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          action: "search",
          message: "Household access denied.",
        }),
        { status: 403 },
      ),
    );
    render(
      <AiWorkspace
        households={[{ id: householdId, name: "Family" }]}
        recipients={[]}
      />,
    );
    await userEvent.type(
      screen.getByPlaceholderText("When is Dad's next appointment?"),
      "visit",
    );
    await userEvent.click(screen.getByRole("button", { name: "Ask Kinlight" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Household access denied.",
    );
  });
});
