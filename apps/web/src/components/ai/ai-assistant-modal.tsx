"use client";

import { AiWorkspace } from "@/components/ai/ai-workspace";
import {
  AiRequestSchema,
  AiResponseSchema,
  createKinlightClient,
  type AiChatMessage,
} from "@getkinlight.com/shared";
import { ArrowUp, MessageCircle, Sparkles, Wrench, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./ai-assistant-modal.module.scss";

export const OPEN_KINLIGHT_AI_EVENT = "kinlight-ai-open";

export type AiHousehold = { id: string; name: string };
export type AiRecipient = { id: string; householdId: string; name: string };

type AiAssistantModalProps = {
  households: AiHousehold[];
  recipients: AiRecipient[];
  initialPrompt?: string;
  onClose: () => void;
};

const welcomeMessage: AiChatMessage = {
  role: "assistant",
  content:
    "What would you like to understand or organize for your family today?",
};

async function askKinlight(householdId: string, messages: AiChatMessage[]) {
  const supabase = createKinlightClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session)
    throw new Error("Your session has expired. Sign in again.");

  const input = AiRequestSchema.parse({
    action: "conversation",
    householdId,
    messages,
  });
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify(input),
  });
  const result = AiResponseSchema.parse(await response.json());
  if (!response.ok || !result.ok)
    throw new Error(
      result.ok ? "Kinlight AI could not answer." : result.message,
    );
  if (result.action !== "conversation")
    throw new Error("Kinlight AI returned an unexpected response.");
  return result.data;
}

export function AiAssistantModal({
  households,
  recipients,
  initialPrompt = "",
  onClose,
}: AiAssistantModalProps) {
  const [activeTab, setActiveTab] = useState<"conversation" | "tools">(
    "conversation",
  );
  const [householdId, setHouseholdId] = useState(households[0]?.id ?? "");
  const [messages, setMessages] = useState<AiChatMessage[]>([welcomeMessage]);
  const [draft, setDraft] = useState(initialPrompt);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([
    "What needs attention today?",
    "Summarize recent care updates",
    "What is coming up this week?",
  ]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const conversationEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  useEffect(() => {
    conversationEnd.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, isSending]);

  async function sendMessage(prompt = draft) {
    const content = prompt.trim();
    if (!content || !householdId || isSending) return;

    const userMessage: AiChatMessage = { role: "user", content };
    const requestMessages = [...messages, userMessage].slice(-12);
    setMessages(requestMessages);
    setDraft("");
    setError("");
    setIsSending(true);

    try {
      const answer = await askKinlight(householdId, requestMessages);
      const assistantMessage: AiChatMessage = {
        role: "assistant",
        content: answer.answer,
      };
      setMessages((current) => [...current, assistantMessage].slice(-12));
      setSuggestedPrompts(answer.suggestedPrompts);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Kinlight AI could not answer.",
      );
    } finally {
      setIsSending(false);
    }
  }

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kinlight-ai-title"
      >
        <header className={styles.header}>
          <div className={styles.identity}>
            <span>
              <Sparkles size={19} aria-hidden />
            </span>
            <div>
              <p>Family intelligence</p>
              <h2 id="kinlight-ai-title">Kinlight AI</h2>
            </div>
          </div>
          <div className={styles.headerActions}>
            {households.length > 1 && (
              <select
                value={householdId}
                onChange={(event) => {
                  setHouseholdId(event.target.value);
                  setMessages([welcomeMessage]);
                }}
                aria-label="AI household"
              >
                {households.map((household) => (
                  <option key={household.id} value={household.id}>
                    {household.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Close Kinlight AI"
            >
              <X size={19} aria-hidden />
            </button>
          </div>
        </header>

        <div
          className={styles.tabs}
          role="tablist"
          aria-label="Kinlight AI views"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "conversation"}
            onClick={() => setActiveTab("conversation")}
          >
            <MessageCircle size={16} aria-hidden />
            Conversation
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "tools"}
            onClick={() => setActiveTab("tools")}
          >
            <Wrench size={16} aria-hidden />
            Tools
          </button>
        </div>

        {activeTab === "conversation" ? (
          <div className={styles.conversationPanel}>
            <div className={styles.messages} aria-live="polite">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={styles.message}
                  data-role={message.role}
                >
                  {message.role === "assistant" && (
                    <span className={styles.botMark}>
                      <Sparkles size={14} aria-hidden />
                    </span>
                  )}
                  <p>{message.content}</p>
                </div>
              ))}
              {isSending && (
                <div className={styles.thinking}>
                  <span />
                  <span />
                  <span />
                  <small>Kinlight is thinking</small>
                </div>
              )}
              <div ref={conversationEnd} />
            </div>

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            {suggestedPrompts.length > 0 && (
              <div
                className={styles.suggestions}
                aria-label="Suggested questions"
              >
                {suggestedPrompts.map((prompt) => (
                  <button
                    type="button"
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    disabled={isSending}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            <form
              className={styles.composer}
              onSubmit={(event) => {
                event.preventDefault();
                sendMessage();
              }}
            >
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                rows={2}
                maxLength={4000}
                placeholder="Ask about schedules, recent updates, or family care..."
                aria-label="Message Kinlight AI"
              />
              <button
                type="submit"
                disabled={!draft.trim() || isSending || !householdId}
                aria-label="Send message"
              >
                <ArrowUp size={18} aria-hidden />
              </button>
            </form>
            <p className={styles.disclaimer}>
              Kinlight AI can make mistakes. Verify medical, medication, and
              urgent care details.
            </p>
          </div>
        ) : (
          <div className={styles.toolsPanel}>
            <AiWorkspace
              households={households}
              recipients={recipients}
              embedded
            />
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}
