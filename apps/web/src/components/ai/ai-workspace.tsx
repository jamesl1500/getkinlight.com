"use client";

import {
  AiRequestSchema,
  AiResponseSchema,
  CreateCareScheduleRequestSchema,
  CreateCareScheduleResponseSchema,
  createKinlightClient,
  type AiDailyBrief,
  type AiDocumentExtraction,
  type AiHandoff,
  type AiRequest,
  type AiScheduleProposal,
  type AiSearchAnswer,
  type CreateCareScheduleRequest,
} from "@getkinlight.com/shared";
import {
  CalendarPlus,
  FileScan,
  Mic,
  Search,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import styles from "./ai-workspace.module.scss";

type Household = { id: string; name: string };
type Recipient = { id: string; householdId: string; name: string };
type SupportedMediaType = Extract<
  AiRequest,
  { action: "document-extract" }
>["mediaType"];
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  onresult: (event: {
    results: ArrayLike<{ 0: { transcript: string } }>;
  }) => void;
  onerror: () => void;
};

async function accessToken() {
  const supabase = createKinlightClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session)
    throw new Error("Your session has expired. Sign in again.");
  return data.session.access_token;
}

async function askKinlight(input: AiRequest) {
  const parsed = AiRequestSchema.parse(input);
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await accessToken()}`,
    },
    body: JSON.stringify(parsed),
  });
  const result = AiResponseSchema.parse(await response.json());
  if (!response.ok || !result.ok)
    throw new Error(
      result.ok
        ? "Kinlight AI could not complete the request."
        : result.message,
    );
  return result;
}

function scheduleRequest(
  proposal: AiScheduleProposal,
): CreateCareScheduleRequest {
  const base = {
    householdId: proposal.householdId,
    recipientId: proposal.recipientId ?? undefined,
    date: proposal.date,
    time: proposal.time,
    title: proposal.title,
    notes: proposal.notes ?? undefined,
  };
  const request =
    proposal.type === "event"
      ? {
          ...base,
          type: proposal.type,
          location: proposal.location ?? undefined,
          isAllDay: proposal.isAllDay,
        }
      : proposal.type === "appointment"
        ? {
            ...base,
            type: proposal.type,
            providerName: proposal.providerName ?? undefined,
            location: proposal.location ?? undefined,
          }
        : proposal.type === "medication"
          ? {
              ...base,
              type: proposal.type,
              dosage: proposal.dosage ?? undefined,
            }
          : {
              ...base,
              type: proposal.type,
              mealType: proposal.mealType ?? "meal",
            };
  return CreateCareScheduleRequestSchema.parse(request);
}

async function saveSchedule(proposal: AiScheduleProposal) {
  const response = await fetch("/api/care-schedule", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await accessToken()}`,
    },
    body: JSON.stringify(scheduleRequest(proposal)),
  });
  const result = CreateCareScheduleResponseSchema.parse(await response.json());
  if (!response.ok || !result.ok) throw new Error(result.message);
  return result.message;
}

function fileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Unable to read that file."));
    reader.readAsDataURL(file);
  });
}

export function AiWorkspace({
  households,
  recipients,
  embedded = false,
}: {
  households: Household[];
  recipients: Recipient[];
  embedded?: boolean;
}) {
  const [householdId, setHouseholdId] = useState(households[0]?.id ?? "");
  const [brief, setBrief] = useState<AiDailyBrief | null>(null);
  const [captureText, setCaptureText] = useState("");
  const [proposal, setProposal] = useState<AiScheduleProposal | null>(null);
  const [handoff, setHandoff] = useState<AiHandoff | null>(null);
  const [answer, setAnswer] = useState<AiSearchAnswer | null>(null);
  const [document, setDocument] = useState<AiDocumentExtraction | null>(null);
  const [query, setQuery] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const householdRecipients = recipients.filter(
    (recipient) => recipient.householdId === householdId,
  );

  async function run<T>(
    name: string,
    operation: () => Promise<T>,
    apply: (result: T) => void,
  ) {
    setBusy(name);
    setMessage("");
    try {
      apply(await operation());
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Kinlight AI could not complete that request.",
      );
    } finally {
      setBusy(null);
    }
  }

  function startVoice() {
    const SpeechRecognition = (
      window as typeof window & {
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      }
    ).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessage(
        "Voice capture is not available in this browser. You can still type the details.",
      );
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) =>
      setCaptureText(event.results[0]?.[0]?.transcript ?? "");
    recognition.onerror = () =>
      setMessage("Voice capture stopped before any words were recognized.");
    recognition.start();
  }

  function resetHousehold(nextHouseholdId: string) {
    setHouseholdId(nextHouseholdId);
    setRecipientId("");
    setBrief(null);
    setHandoff(null);
    setAnswer(null);
    setProposal(null);
    setDocument(null);
  }

  if (households.length === 0) {
    return (
      <main className={styles.workspace}>
        <div className={styles.empty}>
          <Sparkles size={24} aria-hidden />
          <h1>Kinlight AI</h1>
          <p>Create a household before using family intelligence tools.</p>
        </div>
      </main>
    );
  }

  return (
    <main className={`${styles.workspace} ${embedded ? styles.embedded : ""}`}>
      <header className={styles.header}>
        <div>
          <p>Family intelligence</p>
          <h1>Kinlight AI</h1>
          <span>
            Claude helps organize your records. You stay in control of every
            change.
          </span>
        </div>
        {households.length > 1 && (
          <label>
            <span>Household</span>
            <select
              value={householdId}
              onChange={(event) => resetHousehold(event.target.value)}
            >
              {households.map((household) => (
                <option key={household.id} value={household.id}>
                  {household.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      {message && (
        <p className={styles.notice} role="status">
          {message}
        </p>
      )}

      <section className={styles.featureGrid}>
        <article className={`${styles.feature} ${styles.briefFeature}`}>
          <header>
            <span>
              <Sparkles size={19} aria-hidden />
            </span>
            <div>
              <p>Start here</p>
              <h2>Daily family brief</h2>
            </div>
            <button
              type="button"
              onClick={() =>
                run(
                  "brief",
                  async () => {
                    const result = await askKinlight({
                      action: "daily-brief",
                      householdId,
                      date: new Date().toISOString().slice(0, 10),
                    });
                    if (result.action !== "daily-brief")
                      throw new Error("Unexpected AI response.");
                    return result.data;
                  },
                  setBrief,
                )
              }
              disabled={busy !== null}
            >
              {busy === "brief" ? "Preparing..." : "Generate"}
            </button>
          </header>
          {brief ? (
            <div className={styles.result}>
              <h3>{brief.greeting}</h3>
              <p>{brief.summary}</p>
              <ResultList title="Priorities" items={brief.priorities} />
              {brief.changes.length > 0 && (
                <ResultList title="What changed" items={brief.changes} />
              )}
              {brief.insights.length > 0 && (
                <div className={styles.insights}>
                  {brief.insights.map((insight) => (
                    <div
                      key={`${insight.title}-${insight.detail}`}
                      data-severity={insight.severity}
                    >
                      <strong>{insight.title}</strong>
                      <span>{insight.detail}</span>
                    </div>
                  ))}
                </div>
              )}
              <small>{brief.disclaimer}</small>
            </div>
          ) : (
            <Placeholder text="A focused view of today's schedule, recent changes, and patterns worth reviewing." />
          )}
        </article>

        <article className={styles.feature}>
          <header>
            <span>
              <CalendarPlus size={19} aria-hidden />
            </span>
            <div>
              <p>Speak or type</p>
              <h2>Quick schedule capture</h2>
            </div>
          </header>
          <textarea
            value={captureText}
            onChange={(event) => setCaptureText(event.target.value)}
            rows={4}
            placeholder="Mom has a cardiology appointment Friday at 2 PM with Dr. Lee."
          />
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={startVoice}
              aria-label="Capture with voice"
              title="Capture with voice"
            >
              <Mic size={17} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() =>
                run(
                  "capture",
                  async () => {
                    const result = await askKinlight({
                      action: "capture-schedule",
                      householdId,
                      text: captureText,
                      today: new Date().toISOString().slice(0, 10),
                      timeZone:
                        Intl.DateTimeFormat().resolvedOptions().timeZone,
                    });
                    if (result.action !== "capture-schedule")
                      throw new Error("Unexpected AI response.");
                    return result.data;
                  },
                  setProposal,
                )
              }
              disabled={busy !== null || captureText.trim().length < 3}
            >
              {busy === "capture" ? "Reading..." : "Create draft"}
            </button>
          </div>
          {proposal && (
            <Proposal
              proposal={proposal}
              recipients={recipients}
              onSave={() =>
                run(
                  "save",
                  () => saveSchedule(proposal),
                  (saved) => {
                    setMessage(saved);
                    setProposal(null);
                    setCaptureText("");
                  },
                )
              }
              disabled={busy !== null}
            />
          )}
        </article>

        <article className={styles.feature}>
          <header>
            <span>
              <UsersRound size={19} aria-hidden />
            </span>
            <div>
              <p>Share context</p>
              <h2>Caregiver handoff</h2>
            </div>
          </header>
          <select
            value={recipientId}
            onChange={(event) => setRecipientId(event.target.value)}
          >
            <option value="">Whole household</option>
            {householdRecipients.map((recipient) => (
              <option key={recipient.id} value={recipient.id}>
                {recipient.name}
              </option>
            ))}
          </select>
          <div className={styles.actions}>
            <button
              type="button"
              onClick={() =>
                run(
                  "handoff",
                  async () => {
                    const result = await askKinlight({
                      action: "handoff",
                      householdId,
                      recipientId: recipientId || null,
                    });
                    if (result.action !== "handoff")
                      throw new Error("Unexpected AI response.");
                    return result.data;
                  },
                  setHandoff,
                )
              }
              disabled={busy !== null}
            >
              {busy === "handoff" ? "Preparing..." : "Build handoff"}
            </button>
          </div>
          {handoff && (
            <div className={styles.result}>
              <h3>{handoff.title}</h3>
              <p>{handoff.summary}</p>
              <ResultList title="Wellbeing" items={handoff.wellbeing} />
              <ResultList title="Medications" items={handoff.medications} />
              <ResultList title="Upcoming" items={handoff.upcoming} />
              <ResultList title="Follow up" items={handoff.followUps} />
              <small>{handoff.disclaimer}</small>
            </div>
          )}
        </article>

        <article className={styles.feature}>
          <header>
            <span>
              <Search size={19} aria-hidden />
            </span>
            <div>
              <p>Use your records</p>
              <h2>Household search</h2>
            </div>
          </header>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="When is Dad's next appointment?"
          />
          <div className={styles.actions}>
            <button
              type="button"
              onClick={() =>
                run(
                  "search",
                  async () => {
                    const result = await askKinlight({
                      action: "search",
                      householdId,
                      query,
                    });
                    if (result.action !== "search")
                      throw new Error("Unexpected AI response.");
                    return result.data;
                  },
                  setAnswer,
                )
              }
              disabled={busy !== null || query.trim().length < 2}
            >
              {busy === "search" ? "Searching..." : "Ask Kinlight"}
            </button>
          </div>
          {answer && (
            <div className={styles.result}>
              <p>{answer.answer}</p>
              {answer.insufficientContext && (
                <strong className={styles.caution}>
                  More context is needed.
                </strong>
              )}
              <small>{answer.disclaimer}</small>
            </div>
          )}
        </article>

        <article className={`${styles.feature} ${styles.documentFeature}`}>
          <header>
            <span>
              <FileScan size={19} aria-hidden />
            </span>
            <div>
              <p>Review before saving</p>
              <h2>Document intake</h2>
            </div>
          </header>
          <label className={styles.fileField}>
            <span>
              Appointment card, care instructions, discharge summary, or
              medication label
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 10_000_000) {
                  setMessage("Choose a file smaller than 10 MB.");
                  return;
                }
                run(
                  "document",
                  async () => {
                    const base64 = await fileAsBase64(file);
                    const request = {
                      action: "document-extract" as const,
                      householdId,
                      recipientId: recipientId || null,
                      fileName: file.name,
                      mediaType: file.type as SupportedMediaType,
                      base64,
                    };
                    const result = await askKinlight(
                      AiRequestSchema.parse(request),
                    );
                    if (result.action !== "document-extract")
                      throw new Error("Unexpected AI response.");
                    return result.data;
                  },
                  setDocument,
                );
              }}
              disabled={busy !== null}
            />
          </label>
          {busy === "document" && (
            <p className={styles.processing}>
              Claude is reading the document...
            </p>
          )}
          {document && (
            <div className={styles.result}>
              <h3>{document.documentType.replaceAll("_", " ")}</h3>
              <p>{document.summary}</p>
              <ResultList
                title="Extracted instructions"
                items={document.instructions}
              />
              {document.warnings.length > 0 && (
                <ResultList
                  title="Review carefully"
                  items={document.warnings}
                />
              )}
              {document.scheduleProposal && (
                <Proposal
                  proposal={document.scheduleProposal}
                  recipients={recipients}
                  onSave={() =>
                    run(
                      "document-save",
                      () => saveSchedule(document.scheduleProposal!),
                      (saved) => {
                        setMessage(saved);
                        setDocument(null);
                      },
                    )
                  }
                  disabled={busy !== null}
                />
              )}
              <small>{document.disclaimer}</small>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className={styles.resultList}>
      <strong>{title}</strong>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Proposal({
  proposal,
  recipients,
  onSave,
  disabled,
}: {
  proposal: AiScheduleProposal;
  recipients: Recipient[];
  onSave: () => void;
  disabled: boolean;
}) {
  const recipient = recipients.find((item) => item.id === proposal.recipientId);
  return (
    <div className={styles.proposal}>
      <div>
        <strong>{proposal.title}</strong>
        <span>
          {proposal.date} at {proposal.time}
          {recipient ? ` · ${recipient.name}` : ""}
        </span>
        {proposal.needsReview.map((item) => (
          <small key={item}>{item}</small>
        ))}
      </div>
      <button type="button" onClick={onSave} disabled={disabled}>
        Confirm & save
      </button>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return <p className={styles.placeholder}>{text}</p>;
}
