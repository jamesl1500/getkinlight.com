import { fireEvent, screen, waitFor } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@getkinlight.com/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@getkinlight.com/shared")>()),
  createKinlightClient: () => ({ auth: { getSession: mocks.getSession } }),
}));
vi.mock("./ai-workspace", () => ({
  AiWorkspace: () => <div>AI tools workspace</div>,
}));

import { AiAssistantModal } from "./ai-assistant-modal";

const householdId = "10000000-0000-4000-8000-000000000001";

describe("AiAssistantModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "token" } },
    });
    document.body.style.overflow = "";
  });

  it("locks page scroll and closes with Escape", async () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <AiAssistantModal
        households={[{ id: householdId, name: "Family" }]}
        recipients={[]}
        onClose={onClose}
      />,
    );
    expect(
      screen.getByRole("dialog", { name: "Kinlight AI" }),
    ).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("submits an initial prompt and renders the answer and follow-ups", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          action: "conversation",
          data: {
            answer: "The family schedule is clear.",
            sources: [],
            suggestedPrompts: ["Review tomorrow"],
            disclaimer: "Verify important details.",
          },
        }),
        { status: 200 },
      ),
    );
    render(
      <AiAssistantModal
        households={[{ id: householdId, name: "Family" }]}
        recipients={[]}
        initialPrompt="What needs attention?"
        onClose={() => undefined}
      />,
    );
    expect(screen.getByLabelText("Message Kinlight AI")).toHaveValue(
      "What needs attention?",
    );
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(
      await screen.findByText("The family schedule is clear."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Review tomorrow" }),
    ).toBeInTheDocument();
  });

  it("shows API errors and opens the tools tab", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    render(
      <AiAssistantModal
        households={[{ id: householdId, name: "Family" }]}
        recipients={[]}
        initialPrompt="Question"
        onClose={() => undefined}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your session has expired",
    );
    await userEvent.click(screen.getByRole("tab", { name: "Tools" }));
    await waitFor(() =>
      expect(screen.getByText("AI tools workspace")).toBeInTheDocument(),
    );
  });

  it("switches households, submits suggestions with Enter, and closes from the backdrop", async () => {
    const onClose = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          action: "conversation",
          data: {
            answer: "Here is the update.",
            sources: [],
            suggestedPrompts: [],
            disclaimer: "Verify important details.",
          },
        }),
        { status: 200 },
      ),
    );
    render(
      <AiAssistantModal
        households={[
          { id: householdId, name: "Family" },
          { id: "10000000-0000-4000-8000-000000000002", name: "Grandparents" },
        ]}
        recipients={[]}
        onClose={onClose}
      />,
    );

    await userEvent.selectOptions(
      screen.getByLabelText("AI household"),
      "10000000-0000-4000-8000-000000000002",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "What needs attention today?" }),
    );
    expect(await screen.findByText("Here is the update.")).toBeInTheDocument();

    const composer = screen.getByLabelText("Message Kinlight AI");
    await userEvent.type(composer, "Another question{enter}");
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement!);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
