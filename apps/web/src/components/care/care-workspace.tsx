"use client";

import { CareScheduleList } from "@/components/dashboard/care-schedule-list";
import type {
  CareRecipient,
  CareWorkspaceData,
  MedicationReminder,
} from "@/lib/care";
import {
  CareMutationResponseSchema,
  createKinlightClient,
  type CareMutationRequest,
} from "@getkinlight.com/shared";
import {
  Activity,
  CalendarClock,
  ClipboardPlus,
  HeartPulse,
  NotebookPen,
  Pencil,
  Pill,
  Pin,
  Plus,
  UserPlus,
  UserRound,
  Utensils,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./care-workspace.module.scss";

const tabs = ["overview", "check-ins", "notes", "medications"] as const;
type CareTab = (typeof tabs)[number];
type Modal = "recipient" | "check-in" | "note" | "medication" | null;

const tabLabels: Record<CareTab, string> = {
  overview: "Overview",
  "check-ins": "Check-ins",
  notes: "Notes",
  medications: "Medications",
};

const statusLabels = {
  doing_well: "Doing well",
  okay: "Okay",
  needs_attention: "Needs attention",
  urgent: "Urgent",
};

function displayName(recipient: CareRecipient) {
  return recipient.preferredName || recipient.firstName;
}

function ageFromDate(dateOfBirth: string | null) {
  if (!dateOfBirth) return null;
  const birthDate = new Date(`${dateOfBirth}T00:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  if (
    now.getUTCMonth() < birthDate.getUTCMonth() ||
    (now.getUTCMonth() === birthDate.getUTCMonth() &&
      now.getUTCDate() < birthDate.getUTCDate())
  )
    age -= 1;
  return age;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function CareWorkspace({
  data,
  initialTab,
}: {
  data: CareWorkspaceData;
  initialTab?: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CareTab>(
    tabs.includes(initialTab as CareTab) ? (initialTab as CareTab) : "overview",
  );
  const [modal, setModal] = useState<Modal>(null);
  const [editingRecipient, setEditingRecipient] =
    useState<CareRecipient | null>(null);
  const [editingMedication, setEditingMedication] =
    useState<MedicationReminder | null>(null);
  const recipient = data.selectedRecipient;

  function selectTab(tab: CareTab) {
    setActiveTab(tab);
    const query = new URLSearchParams();
    if (recipient) query.set("recipient", recipient.id);
    if (tab !== "overview") query.set("tab", tab);
    router.replace(`/care${query.size ? `?${query}` : ""}`, { scroll: false });
  }

  function selectRecipient(recipientId: string) {
    const query = new URLSearchParams({ recipient: recipientId });
    if (activeTab !== "overview") query.set("tab", activeTab);
    router.push(`/care?${query}`);
  }

  function openRecipientForm(value: CareRecipient | null) {
    setEditingRecipient(value);
    setModal("recipient");
  }

  function openMedicationForm(value: MedicationReminder | null) {
    setEditingMedication(value);
    setModal("medication");
  }

  if (!recipient) {
    return (
      <main className={styles.carePage}>
        <header className={styles.pageHeader}>
          <div>
            <p>Care workspace</p>
            <h1>Start with the person you support</h1>
            <span>
              Add a care recipient to organize their schedule, notes, check-ins,
              and medication reminders.
            </span>
          </div>
        </header>
        <section className={styles.firstRecipient}>
          <span>
            <UserPlus size={28} aria-hidden />
          </span>
          <h2>Create a care profile</h2>
          <p>Keep useful context available to everyone in the household.</p>
          <button
            type="button"
            onClick={() => openRecipientForm(null)}
            disabled={data.households.length === 0}
          >
            <Plus size={17} aria-hidden />
            Add care recipient
          </button>
        </section>
        {modal === "recipient" && (
          <RecipientModal
            households={data.households}
            recipient={null}
            onClose={() => setModal(null)}
            onSaved={(id) => router.push(`/care?recipient=${id}`)}
          />
        )}
      </main>
    );
  }

  const age = ageFromDate(recipient.dateOfBirth);
  const latestCheckIn = data.checkIns[0];
  const pinnedNote = data.notes.find((note) => note.isPinned);
  const activeMedications = data.medications.filter(
    (medication) => medication.isActive,
  );
  const activeEatingReminders = data.eatingReminders.filter(
    (reminder) => reminder.isActive,
  );

  return (
    <main className={styles.carePage}>
      <header className={styles.pageHeader}>
        <div>
          <p>Care workspace</p>
          <h1>Care for {displayName(recipient)}</h1>
          <span>
            One place for the context and routines your family relies on.
          </span>
        </div>
        <div className={styles.headerActions}>
          <label>
            <span>Care recipient</span>
            <select
              value={recipient.id}
              onChange={(event) => selectRecipient(event.target.value)}
            >
              {data.recipients.map((item) => (
                <option key={item.id} value={item.id}>
                  {displayName(item)}
                  {item.isActive ? "" : " (archived)"}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => openRecipientForm(recipient)}
            aria-label="Edit care recipient"
            title="Edit care recipient"
          >
            <Pencil size={18} aria-hidden />
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => openRecipientForm(null)}
          >
            <UserPlus size={17} aria-hidden />
            Add person
          </button>
        </div>
      </header>

      <section className={styles.identityBand}>
        <span className={styles.avatar}>
          {displayName(recipient).slice(0, 1)}
          {recipient.lastName.slice(0, 1)}
        </span>
        <div className={styles.identityCopy}>
          <p>
            {recipient.firstName} {recipient.lastName}
          </p>
          <span>
            {[
              recipient.relationship,
              age !== null ? `Age ${age}` : null,
              recipient.isActive ? "Active care profile" : "Archived",
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
        <div className={styles.preference}>
          <strong>Care preferences</strong>
          <span>
            {recipient.carePreferences || "No care preferences recorded yet."}
          </span>
        </div>
      </section>

      <nav className={styles.tabs} aria-label="Care views">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? styles.activeTab : ""}
            onClick={() => selectTab(tab)}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </nav>

      {activeTab === "overview" && (
        <div className={styles.overview}>
          <section className={styles.metricGrid} aria-label="Care summary">
            <article>
              <span data-tone="teal">
                <Pill size={18} aria-hidden />
              </span>
              <div>
                <strong>{activeMedications.length}</strong>
                <p>Active medications</p>
              </div>
            </article>
            <article>
              <span data-tone="gold">
                <Utensils size={18} aria-hidden />
              </span>
              <div>
                <strong>{activeEatingReminders.length}</strong>
                <p>Nutrition reminders</p>
              </div>
            </article>
            <article>
              <span data-tone={latestCheckIn?.status ?? "neutral"}>
                <HeartPulse size={18} aria-hidden />
              </span>
              <div>
                <strong>
                  {latestCheckIn
                    ? statusLabels[latestCheckIn.status]
                    : "No check-in"}
                </strong>
                <p>Latest wellbeing</p>
              </div>
            </article>
          </section>
          <div className={styles.overviewGrid}>
            <section className={styles.panel}>
              <header>
                <div>
                  <p>Next 14 days</p>
                  <h2>Upcoming care</h2>
                </div>
                <CalendarClock size={20} aria-hidden />
              </header>
              <CareScheduleList items={data.schedule.slice(0, 6)} />
            </section>
            <aside className={styles.sideColumn}>
              <section className={styles.panel}>
                <header>
                  <div>
                    <p>Recent signal</p>
                    <h2>Latest check-in</h2>
                  </div>
                  <Activity size={20} aria-hidden />
                </header>
                {latestCheckIn ? (
                  <div className={styles.latestSignal}>
                    <span data-status={latestCheckIn.status}>
                      {statusLabels[latestCheckIn.status]}
                    </span>
                    <strong>
                      {latestCheckIn.mood
                        ? `Mood ${latestCheckIn.mood} of 5`
                        : "Mood not recorded"}
                    </strong>
                    <p>{latestCheckIn.summary || "No summary was added."}</p>
                    <time>{formatDateTime(latestCheckIn.occurredAt)}</time>
                  </div>
                ) : (
                  <EmptyCopy text="No check-ins have been recorded." />
                )}
              </section>
              <section className={styles.panel}>
                <header>
                  <div>
                    <p>Keep visible</p>
                    <h2>Pinned note</h2>
                  </div>
                  <Pin size={19} aria-hidden />
                </header>
                {pinnedNote ? (
                  <div className={styles.pinnedNote}>
                    <strong>{pinnedNote.title || "Care note"}</strong>
                    <p>{pinnedNote.body}</p>
                  </div>
                ) : (
                  <EmptyCopy text="Pin a note to keep important context here." />
                )}
              </section>
            </aside>
          </div>
        </div>
      )}

      {activeTab === "check-ins" && (
        <CareSection
          title="Check-in history"
          eyebrow="Wellbeing timeline"
          icon={<Activity size={20} aria-hidden />}
          action={
            <button type="button" onClick={() => setModal("check-in")}>
              <ClipboardPlus size={17} aria-hidden />
              Record check-in
            </button>
          }
        >
          <div className={styles.timeline}>
            {data.checkIns.length ? (
              data.checkIns.map((checkIn) => (
                <article key={checkIn.id} className={styles.timelineItem}>
                  <span data-status={checkIn.status} />
                  <div>
                    <header>
                      <strong>{statusLabels[checkIn.status]}</strong>
                      <time>{formatDateTime(checkIn.occurredAt)}</time>
                    </header>
                    <p>{checkIn.summary || "No summary added."}</p>
                    {checkIn.mood && <small>Mood {checkIn.mood} of 5</small>}
                  </div>
                </article>
              ))
            ) : (
              <EmptyCopy text="No check-ins have been recorded for this person." />
            )}
          </div>
        </CareSection>
      )}

      {activeTab === "notes" && (
        <CareSection
          title="Shared care notes"
          eyebrow="Household context"
          icon={<NotebookPen size={20} aria-hidden />}
          action={
            <button type="button" onClick={() => setModal("note")}>
              <Plus size={17} aria-hidden />
              Add note
            </button>
          }
        >
          <div className={styles.noteList}>
            {data.notes.length ? (
              data.notes.map((note) => (
                <article key={note.id}>
                  <header>
                    <div>
                      {note.isPinned && <Pin size={14} aria-label="Pinned" />}
                      <strong>{note.title || "Care note"}</strong>
                    </div>
                    <time>{formatDateTime(note.createdAt)}</time>
                  </header>
                  <p>{note.body}</p>
                </article>
              ))
            ) : (
              <EmptyCopy text="No care notes have been shared yet." />
            )}
          </div>
        </CareSection>
      )}

      {activeTab === "medications" && (
        <CareSection
          title="Medication reminders"
          eyebrow="Daily routines"
          icon={<Pill size={20} aria-hidden />}
          action={
            <button type="button" onClick={() => openMedicationForm(null)}>
              <Plus size={17} aria-hidden />
              Add medication
            </button>
          }
        >
          <div className={styles.medicationList}>
            {data.medications.length ? (
              data.medications.map((medication) => (
                <article
                  key={medication.id}
                  data-inactive={!medication.isActive}
                >
                  <div className={styles.medicationIcon}>
                    <Pill size={18} aria-hidden />
                  </div>
                  <div>
                    <header>
                      <strong>{medication.medicationName}</strong>
                      <span>{medication.isActive ? "Active" : "Inactive"}</span>
                    </header>
                    <p>
                      {[
                        medication.dosage,
                        medication.reminderTimes
                          .map((time) => time.slice(0, 5))
                          .join(", "),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {medication.instructions && (
                      <small>{medication.instructions}</small>
                    )}
                  </div>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => openMedicationForm(medication)}
                    aria-label={`Edit ${medication.medicationName}`}
                  >
                    <Pencil size={16} aria-hidden />
                  </button>
                </article>
              ))
            ) : (
              <EmptyCopy text="No medication reminders have been added." />
            )}
          </div>
        </CareSection>
      )}

      {modal === "recipient" && (
        <RecipientModal
          households={data.households}
          recipient={editingRecipient}
          onClose={() => setModal(null)}
          onSaved={(id) => {
            setModal(null);
            router.push(`/care?recipient=${id}`);
            router.refresh();
          }}
        />
      )}
      {modal === "check-in" && (
        <CheckInModal
          recipient={recipient}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
      {modal === "note" && (
        <NoteModal
          recipient={recipient}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
      {modal === "medication" && (
        <MedicationModal
          recipient={recipient}
          medication={editingMedication}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
    </main>
  );
}

function CareSection({
  title,
  eyebrow,
  icon,
  action,
  children,
}: {
  title: string;
  eyebrow: string;
  icon: React.ReactNode;
  action: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={`${styles.panel} ${styles.workspacePanel}`}>
      <header>
        <div>
          <p>{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <div className={styles.sectionActions}>
          {icon}
          {action}
        </div>
      </header>
      {children}
    </section>
  );
}

function EmptyCopy({ text }: { text: string }) {
  return (
    <div className={styles.emptyCopy}>
      <UserRound size={22} aria-hidden />
      <p>{text}</p>
    </div>
  );
}

async function mutateCare(payload: CareMutationRequest) {
  const supabase = createKinlightClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session)
    throw new Error("Your session has expired. Sign in again.");
  const response = await fetch("/api/care", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify(payload),
  });
  const result = CareMutationResponseSchema.parse(await response.json());
  if (!response.ok || !result.ok) throw new Error(result.message);
  return result;
}

function ModalShell({
  title,
  eyebrow,
  onClose,
  children,
}: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);
  return createPortal(
    <div
      className={styles.modalBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="care-modal-title"
      >
        <header>
          <div>
            <p>{eyebrow}</p>
            <h2 id="care-modal-title">{title}</h2>
          </div>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} aria-hidden />
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}

function RecipientModal({
  households,
  recipient,
  onClose,
  onSaved,
}: {
  households: CareWorkspaceData["households"];
  recipient: CareRecipient | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const common = {
        householdId: recipient?.householdId ?? String(data.get("householdId")),
        firstName: String(data.get("firstName")),
        lastName: String(data.get("lastName")),
        preferredName: String(data.get("preferredName") || ""),
        dateOfBirth: String(data.get("dateOfBirth") || "") || undefined,
        relationship: String(data.get("relationship") || ""),
        carePreferences: String(data.get("carePreferences") || ""),
      };
      const payload: CareMutationRequest = recipient
        ? {
            action: "update-recipient",
            recipientId: recipient.id,
            isActive: data.get("isActive") === "on",
            ...common,
          }
        : { action: "create-recipient", ...common };
      const result = await mutateCare(payload);
      if (result.id) onSaved(result.id);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to save this care recipient.",
      );
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <ModalShell
      title={recipient ? "Edit care recipient" : "Add care recipient"}
      eyebrow="Care profile"
      onClose={onClose}
    >
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.fieldGrid}>
          {!recipient && households.length > 1 && (
            <label>
              <span>Household</span>
              <select name="householdId" required>
                {households.map((household) => (
                  <option key={household.id} value={household.id}>
                    {household.name}
                  </option>
                ))}
              </select>
            </label>
          )}{" "}
          {!recipient && households.length === 1 && (
            <input type="hidden" name="householdId" value={households[0].id} />
          )}
          <label>
            <span>First name</span>
            <input
              name="firstName"
              required
              maxLength={80}
              defaultValue={recipient?.firstName}
              autoFocus
            />
          </label>
          <label>
            <span>Last name</span>
            <input
              name="lastName"
              required
              maxLength={80}
              defaultValue={recipient?.lastName}
            />
          </label>
          <label>
            <span>Preferred name</span>
            <input
              name="preferredName"
              maxLength={80}
              defaultValue={recipient?.preferredName ?? ""}
            />
          </label>
          <label>
            <span>Date of birth</span>
            <input
              name="dateOfBirth"
              type="date"
              defaultValue={recipient?.dateOfBirth ?? ""}
            />
          </label>
          <label>
            <span>Relationship</span>
            <input
              name="relationship"
              maxLength={120}
              defaultValue={recipient?.relationship ?? ""}
              placeholder="Parent, partner, friend"
            />
          </label>
          {recipient && (
            <label className={styles.checkbox}>
              <input
                name="isActive"
                type="checkbox"
                defaultChecked={recipient.isActive}
              />
              <span>Active care profile</span>
            </label>
          )}
          <label className={styles.fullField}>
            <span>Care preferences</span>
            <textarea
              name="carePreferences"
              rows={4}
              maxLength={1000}
              defaultValue={recipient?.carePreferences ?? ""}
            />
          </label>
        </div>
        <FormFooter error={error} isSaving={isSaving} onCancel={onClose} />
      </form>
    </ModalShell>
  );
}

function CheckInModal({
  recipient,
  onClose,
  onSaved,
}: {
  recipient: CareRecipient;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await mutateCare({
        action: "create-check-in",
        householdId: recipient.householdId,
        recipientId: recipient.id,
        status: String(data.get("status")) as
          "doing_well" | "okay" | "needs_attention" | "urgent",
        mood: data.get("mood") ? Number(data.get("mood")) : undefined,
        summary: String(data.get("summary") || ""),
      });
      onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to record this check-in.",
      );
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <ModalShell
      title={`Check in on ${displayName(recipient)}`}
      eyebrow="Wellbeing"
      onClose={onClose}
    >
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.fieldGrid}>
          <label>
            <span>Status</span>
            <select name="status" defaultValue="okay">
              <option value="doing_well">Doing well</option>
              <option value="okay">Okay</option>
              <option value="needs_attention">Needs attention</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <label>
            <span>Mood</span>
            <select name="mood" defaultValue="">
              <option value="">Not recorded</option>
              <option value="1">1 — Very low</option>
              <option value="2">2 — Low</option>
              <option value="3">3 — Steady</option>
              <option value="4">4 — Good</option>
              <option value="5">5 — Great</option>
            </select>
          </label>
          <label className={styles.fullField}>
            <span>Summary</span>
            <textarea name="summary" rows={4} maxLength={1000} autoFocus />
          </label>
        </div>
        <FormFooter
          error={error}
          isSaving={isSaving}
          onCancel={onClose}
          action="Record check-in"
        />
      </form>
    </ModalShell>
  );
}

function NoteModal({
  recipient,
  onClose,
  onSaved,
}: {
  recipient: CareRecipient;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await mutateCare({
        action: "create-note",
        householdId: recipient.householdId,
        recipientId: recipient.id,
        title: String(data.get("title") || ""),
        body: String(data.get("body")),
        isPinned: data.get("isPinned") === "on",
      });
      onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to add this note.",
      );
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <ModalShell
      title="Add care note"
      eyebrow={displayName(recipient)}
      onClose={onClose}
    >
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.fieldGrid}>
          <label className={styles.fullField}>
            <span>Title</span>
            <input name="title" maxLength={120} autoFocus />
          </label>
          <label className={styles.fullField}>
            <span>Note</span>
            <textarea name="body" rows={6} required maxLength={4000} />
          </label>
          <label className={styles.checkbox}>
            <input name="isPinned" type="checkbox" />
            <span>Pin this note</span>
          </label>
        </div>
        <FormFooter
          error={error}
          isSaving={isSaving}
          onCancel={onClose}
          action="Add note"
        />
      </form>
    </ModalShell>
  );
}

function MedicationModal({
  recipient,
  medication,
  onClose,
  onSaved,
}: {
  recipient: CareRecipient;
  medication: MedicationReminder | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const common = {
        householdId: recipient.householdId,
        recipientId: recipient.id,
        medicationName: String(data.get("medicationName")),
        dosage: String(data.get("dosage") || ""),
        instructions: String(data.get("instructions") || ""),
        startsOn: String(data.get("startsOn")),
        endsOn: String(data.get("endsOn") || "") || undefined,
        reminderTimes: String(data.get("reminderTimes"))
          .split(",")
          .map((time) => time.trim())
          .filter(Boolean),
        daysOfWeek: data.getAll("daysOfWeek").map(Number),
      };
      const payload: CareMutationRequest = medication
        ? {
            action: "update-medication",
            medicationId: medication.id,
            isActive: data.get("isActive") === "on",
            ...common,
          }
        : { action: "create-medication", ...common };
      await mutateCare(payload);
      onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to save this medication.",
      );
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <ModalShell
      title={medication ? "Edit medication" : "Add medication"}
      eyebrow={displayName(recipient)}
      onClose={onClose}
    >
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.fieldGrid}>
          <label>
            <span>Medication</span>
            <input
              name="medicationName"
              required
              maxLength={120}
              defaultValue={medication?.medicationName}
              autoFocus
            />
          </label>
          <label>
            <span>Dosage</span>
            <input
              name="dosage"
              maxLength={120}
              defaultValue={medication?.dosage ?? ""}
              placeholder="1 tablet"
            />
          </label>
          <label>
            <span>Starts on</span>
            <input
              name="startsOn"
              type="date"
              required
              defaultValue={
                medication?.startsOn ?? new Date().toISOString().slice(0, 10)
              }
            />
          </label>
          <label>
            <span>Ends on</span>
            <input
              name="endsOn"
              type="date"
              defaultValue={medication?.endsOn ?? ""}
            />
          </label>
          <label className={styles.fullField}>
            <span>Reminder times</span>
            <input
              name="reminderTimes"
              required
              defaultValue={
                medication?.reminderTimes
                  .map((time) => time.slice(0, 5))
                  .join(", ") ?? "09:00"
              }
              placeholder="09:00, 18:00"
            />
            <small>Separate multiple times with commas.</small>
          </label>
          <fieldset className={`${styles.fullField} ${styles.dayPicker}`}>
            <legend>Repeat on</legend>
            {dayNames.map((day, index) => (
              <label key={day}>
                <input
                  type="checkbox"
                  name="daysOfWeek"
                  value={index}
                  defaultChecked={medication?.daysOfWeek.includes(index)}
                />
                <span>{day}</span>
              </label>
            ))}
          </fieldset>
          <label className={styles.fullField}>
            <span>Instructions</span>
            <textarea
              name="instructions"
              rows={3}
              maxLength={1000}
              defaultValue={medication?.instructions ?? ""}
            />
          </label>
          {medication && (
            <label className={styles.checkbox}>
              <input
                name="isActive"
                type="checkbox"
                defaultChecked={medication.isActive}
              />
              <span>Active reminder</span>
            </label>
          )}
        </div>
        <FormFooter error={error} isSaving={isSaving} onCancel={onClose} />
      </form>
    </ModalShell>
  );
}

function FormFooter({
  error,
  isSaving,
  onCancel,
  action = "Save changes",
}: {
  error: string;
  isSaving: boolean;
  onCancel: () => void;
  action?: string;
}) {
  return (
    <>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <footer>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : action}
        </button>
      </footer>
    </>
  );
}
