"use client";

import type { CareRecipient } from "@/lib/care";
import type {
  FamilyMember,
  FamilyWorkspaceData,
  HouseholdRole,
} from "@/lib/family";
import {
  CareMutationResponseSchema,
  FamilyMutationResponseSchema,
  createKinlightClient,
  type CareMutationRequest,
  type FamilyMutationRequest,
} from "@getkinlight.com/shared";
import {
  Check,
  Clock3,
  Copy,
  HeartHandshake,
  House,
  MailPlus,
  Pencil,
  ShieldCheck,
  Trash2,
  UserRoundPlus,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import styles from "./family-workspace.module.scss";

type View = "members" | "recipients";
type Modal = "rename" | "invite" | "recipient" | null;

const roleLabels: Record<HouseholdRole, string> = {
  owner: "Owner",
  caregiver: "Caregiver",
  member: "Member",
};

function personName(member: FamilyMember) {
  return (
    [member.firstName, member.lastName].filter(Boolean).join(" ") ||
    member.username ||
    member.email ||
    "Household member"
  );
}

function recipientName(recipient: CareRecipient) {
  return recipient.preferredName || recipient.firstName;
}

function initials(value: string) {
  return value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function FamilyWorkspace({ data }: { data: FamilyWorkspaceData }) {
  const router = useRouter();
  const [view, setView] = useState<View>("members");
  const [modal, setModal] = useState<Modal>(null);
  const [editingRecipient, setEditingRecipient] =
    useState<CareRecipient | null>(null);
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const household = data.selectedHousehold;
  const isOwner = data.currentUserRole === "owner";
  const activeRecipients = data.recipients.filter(
    (recipient) => recipient.isActive,
  );

  if (!household) {
    return (
      <main className={styles.familyPage}>
        <section className={styles.emptyHousehold}>
          <span>
            <House size={28} aria-hidden />
          </span>
          <h1>No household found</h1>
          <p>Visit your dashboard to finish creating your family space.</p>
          <Link href="/dashboard">Go to dashboard</Link>
        </section>
      </main>
    );
  }

  function changeHousehold(householdId: string) {
    router.push(`/family?household=${householdId}`);
  }

  async function updateMember(member: FamilyMember, role: HouseholdRole) {
    setBusyId(member.id);
    try {
      const result = await mutateFamily({
        action: "update-member-role",
        householdId: household!.id,
        memberId: member.id,
        role,
      });
      setNotice(result.message);
      router.refresh();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to update this member.",
      );
    } finally {
      setBusyId("");
    }
  }

  async function removeMember(member: FamilyMember) {
    if (!window.confirm(`Remove ${personName(member)} from this household?`))
      return;
    setBusyId(member.id);
    try {
      const result = await mutateFamily({
        action: "remove-member",
        householdId: household!.id,
        memberId: member.id,
      });
      setNotice(result.message);
      router.refresh();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to remove this member.",
      );
    } finally {
      setBusyId("");
    }
  }

  async function cancelInvitation(invitationId: string) {
    setBusyId(invitationId);
    try {
      const result = await mutateFamily({
        action: "cancel-invitation",
        householdId: household!.id,
        invitationId,
      });
      setNotice(result.message);
      router.refresh();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to cancel this invitation.",
      );
    } finally {
      setBusyId("");
    }
  }

  async function copyInvitation(token: string) {
    await navigator.clipboard.writeText(
      `${window.location.origin}/family/join?token=${token}`,
    );
    setNotice("Invitation link copied.");
  }

  function openRecipient(recipient: CareRecipient | null) {
    setEditingRecipient(recipient);
    setModal("recipient");
  }

  return (
    <main className={styles.familyPage}>
      <header className={styles.pageHeader}>
        <div>
          <p>Household management</p>
          <h1>{household.name}</h1>
          <span>
            Manage the people with access and the loved ones your household
            supports.
          </span>
        </div>
        <div className={styles.headerActions}>
          {data.households.length > 1 && (
            <label>
              <span>Household</span>
              <select
                value={household.id}
                onChange={(event) => changeHousehold(event.target.value)}
              >
                {data.households.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {isOwner && (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setModal("rename")}
            >
              <Pencil size={16} aria-hidden />
              Rename
            </button>
          )}
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => (isOwner ? setModal("invite") : openRecipient(null))}
          >
            {isOwner ? (
              <MailPlus size={17} aria-hidden />
            ) : (
              <UserRoundPlus size={17} aria-hidden />
            )}
            {isOwner ? "Invite member" : "Add care recipient"}
          </button>
        </div>
      </header>

      <section className={styles.summaryGrid} aria-label="Household summary">
        <article>
          <span>
            <UsersRound size={19} aria-hidden />
          </span>
          <div>
            <strong>{data.members.length}</strong>
            <p>Household members</p>
          </div>
        </article>
        <article>
          <span data-tone="care">
            <HeartHandshake size={19} aria-hidden />
          </span>
          <div>
            <strong>{activeRecipients.length}</strong>
            <p>Active care recipients</p>
          </div>
        </article>
        <article>
          <span data-tone="pending">
            <Clock3 size={19} aria-hidden />
          </span>
          <div>
            <strong>{data.invitations.length}</strong>
            <p>Pending invitations</p>
          </div>
        </article>
      </section>

      <nav className={styles.tabs} aria-label="Family management views">
        <button
          type="button"
          className={view === "members" ? styles.activeTab : ""}
          onClick={() => setView("members")}
        >
          <UsersRound size={16} aria-hidden />
          People with access
        </button>
        <button
          type="button"
          className={view === "recipients" ? styles.activeTab : ""}
          onClick={() => setView("recipients")}
        >
          <HeartHandshake size={16} aria-hidden />
          Care recipients
        </button>
      </nav>

      {notice && (
        <div className={styles.notice} role="status">
          <Check size={15} aria-hidden />
          {notice}
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Dismiss message"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      )}

      {view === "members" ? (
        <div className={styles.workspaceGrid}>
          <section className={styles.panel}>
            <header>
              <div>
                <p>Household access</p>
                <h2>Members</h2>
              </div>
              {isOwner && (
                <button
                  type="button"
                  className={styles.iconAction}
                  onClick={() => setModal("invite")}
                  aria-label="Invite member"
                  title="Invite member"
                >
                  <UserRoundPlus size={18} aria-hidden />
                </button>
              )}
            </header>
            <div className={styles.memberList}>
              {data.members.map((member) => {
                const name = personName(member);
                const isCurrentUser = member.userId === data.currentUserId;
                return (
                  <article key={member.id} className={styles.memberRow}>
                    <span className={styles.avatar}>{initials(name)}</span>
                    <div className={styles.memberIdentity}>
                      <strong>
                        {name}
                        {isCurrentUser && <small>You</small>}
                      </strong>
                      <span>{member.email}</span>
                    </div>
                    <div className={styles.memberControls}>
                      {isOwner ? (
                        <select
                          value={member.role}
                          onChange={(event) =>
                            updateMember(
                              member,
                              event.target.value as HouseholdRole,
                            )
                          }
                          disabled={busyId === member.id}
                          aria-label={`Role for ${name}`}
                        >
                          <option value="owner">Owner</option>
                          <option value="caregiver">Caregiver</option>
                          <option value="member">Member</option>
                        </select>
                      ) : (
                        <span
                          className={styles.roleBadge}
                          data-role={member.role}
                        >
                          {roleLabels[member.role]}
                        </span>
                      )}
                      {isOwner && (
                        <button
                          type="button"
                          className={styles.dangerButton}
                          onClick={() => removeMember(member)}
                          disabled={busyId === member.id}
                          aria-label={`Remove ${name}`}
                          title="Remove member"
                        >
                          <Trash2 size={16} aria-hidden />
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <aside className={styles.sideColumn}>
            <section className={styles.panel}>
              <header>
                <div>
                  <p>Awaiting response</p>
                  <h2>Invitations</h2>
                </div>
                <MailPlus size={19} aria-hidden />
              </header>
              <div className={styles.invitationList}>
                {data.invitations.length ? (
                  data.invitations.map((invitation) => (
                    <article key={invitation.id}>
                      <div>
                        <strong>{invitation.email}</strong>
                        <span>
                          {roleLabels[invitation.role]} · Expires{" "}
                          {new Intl.DateTimeFormat("en", {
                            month: "short",
                            day: "numeric",
                          }).format(new Date(invitation.expiresAt))}
                        </span>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => copyInvitation(invitation.token)}
                          aria-label={`Copy invitation for ${invitation.email}`}
                          title="Copy invitation link"
                        >
                          <Copy size={15} aria-hidden />
                        </button>
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => cancelInvitation(invitation.id)}
                            disabled={busyId === invitation.id}
                            aria-label={`Cancel invitation for ${invitation.email}`}
                            title="Cancel invitation"
                          >
                            <X size={16} aria-hidden />
                          </button>
                        )}
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyState
                    icon={<MailPlus size={21} aria-hidden />}
                    text="No pending invitations."
                  />
                )}
              </div>
            </section>
            <section className={`${styles.panel} ${styles.accessGuide}`}>
              <header>
                <div>
                  <p>Role guide</p>
                  <h2>Access levels</h2>
                </div>
                <ShieldCheck size={19} aria-hidden />
              </header>
              <dl>
                <div>
                  <dt>Owner</dt>
                  <dd>Manages household details, members, and invitations.</dd>
                </div>
                <div>
                  <dt>Caregiver</dt>
                  <dd>
                    Contributes to care profiles, schedules, and shared records.
                  </dd>
                </div>
                <div>
                  <dt>Member</dt>
                  <dd>Participates in the household and shared care space.</dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      ) : (
        <section className={styles.panel}>
          <header>
            <div>
              <p>People you support</p>
              <h2>Care recipients</h2>
            </div>
            <button
              type="button"
              className={styles.panelButton}
              onClick={() => openRecipient(null)}
            >
              <UserRoundPlus size={16} aria-hidden />
              Add recipient
            </button>
          </header>
          {data.recipients.length ? (
            <div className={styles.recipientGrid}>
              {data.recipients.map((recipient) => (
                <article key={recipient.id} data-inactive={!recipient.isActive}>
                  <div className={styles.recipientTop}>
                    <span className={styles.recipientAvatar}>
                      {recipientName(recipient).slice(0, 1)}
                      {recipient.lastName.slice(0, 1)}
                    </span>
                    <span
                      className={styles.roleBadge}
                      data-role={recipient.isActive ? "active" : "inactive"}
                    >
                      {recipient.isActive ? "Active" : "Archived"}
                    </span>
                  </div>
                  <h3>
                    {recipient.firstName} {recipient.lastName}
                  </h3>
                  <p>
                    {[
                      recipient.preferredName
                        ? `Goes by ${recipient.preferredName}`
                        : null,
                      recipient.relationship,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Care relationship not specified"}
                  </p>
                  <footer>
                    <Link href={`/care?recipient=${recipient.id}`}>
                      Open care workspace
                    </Link>
                    <button
                      type="button"
                      onClick={() => openRecipient(recipient)}
                      aria-label={`Edit ${recipientName(recipient)}`}
                    >
                      <Pencil size={15} aria-hidden />
                    </button>
                  </footer>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<HeartHandshake size={24} aria-hidden />}
              text="Add a care recipient to coordinate support without giving them account access."
              action={
                <button
                  type="button"
                  className={styles.panelButton}
                  onClick={() => openRecipient(null)}
                >
                  Add first recipient
                </button>
              }
            />
          )}
        </section>
      )}

      {modal === "rename" && (
        <RenameModal
          householdId={household.id}
          householdName={household.name}
          onClose={() => setModal(null)}
          onSaved={(message) => {
            setModal(null);
            setNotice(message);
            router.refresh();
          }}
        />
      )}
      {modal === "invite" && (
        <InviteModal
          householdId={household.id}
          onClose={() => setModal(null)}
          onSaved={(message) => {
            setModal(null);
            setNotice(message);
            router.refresh();
          }}
        />
      )}
      {modal === "recipient" && (
        <RecipientModal
          householdId={household.id}
          recipient={editingRecipient}
          onClose={() => setModal(null)}
          onSaved={(message) => {
            setModal(null);
            setNotice(message);
            router.refresh();
          }}
        />
      )}
    </main>
  );
}

async function mutateFamily(payload: FamilyMutationRequest) {
  const supabase = createKinlightClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session)
    throw new Error("Your session has expired. Sign in again.");
  const response = await fetch("/api/family", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify(payload),
  });
  const result = FamilyMutationResponseSchema.parse(await response.json());
  if (!response.ok || !result.ok) throw new Error(result.message);
  return result;
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
        aria-labelledby="family-modal-title"
      >
        <header>
          <div>
            <p>{eyebrow}</p>
            <h2 id="family-modal-title">{title}</h2>
          </div>
          <button
            type="button"
            className={styles.iconAction}
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

function RenameModal({
  householdId,
  householdName,
  onClose,
  onSaved,
}: {
  householdId: string;
  householdName: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await mutateFamily({
        action: "rename-household",
        householdId,
        name: String(data.get("name")),
      });
      onSaved(result.message);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to rename this household.",
      );
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <ModalShell
      title="Rename household"
      eyebrow="Household identity"
      onClose={onClose}
    >
      <form className={styles.form} onSubmit={submit}>
        <label>
          <span>Household name</span>
          <input
            name="name"
            defaultValue={householdName}
            required
            maxLength={120}
            autoFocus
          />
        </label>
        <FormFooter error={error} isSaving={isSaving} onCancel={onClose} />
      </form>
    </ModalShell>
  );
}

function InviteModal({
  householdId,
  onClose,
  onSaved,
}: {
  householdId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await mutateFamily({
        action: "invite-member",
        householdId,
        email: String(data.get("email")),
        role: String(data.get("role")) as "member" | "caregiver",
      });
      if (result.invitationToken)
        await navigator.clipboard.writeText(
          `${window.location.origin}/family/join?token=${result.invitationToken}`,
        );
      onSaved(`${result.message} The link has been copied.`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to create this invitation.",
      );
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <ModalShell
      title="Invite a household member"
      eyebrow="Share access"
      onClose={onClose}
    >
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.fieldGrid}>
          <label>
            <span>Email address</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
            />
          </label>
          <label>
            <span>Starting role</span>
            <select name="role" defaultValue="member">
              <option value="member">Member</option>
              <option value="caregiver">Caregiver</option>
            </select>
          </label>
        </div>
        <p className={styles.formHint}>
          The invitation expires in seven days. Kinlight will copy a secure
          acceptance link for you to share.
        </p>
        <FormFooter
          error={error}
          isSaving={isSaving}
          onCancel={onClose}
          action="Create invitation"
        />
      </form>
    </ModalShell>
  );
}

function RecipientModal({
  householdId,
  recipient,
  onClose,
  onSaved,
}: {
  householdId: string;
  recipient: CareRecipient | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const common = {
      householdId,
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
    try {
      const result = await mutateCare(payload);
      onSaved(result.message);
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
          <label>
            <span>First name</span>
            <input
              name="firstName"
              defaultValue={recipient?.firstName}
              required
              maxLength={80}
              autoFocus
            />
          </label>
          <label>
            <span>Last name</span>
            <input
              name="lastName"
              defaultValue={recipient?.lastName}
              required
              maxLength={80}
            />
          </label>
          <label>
            <span>Preferred name</span>
            <input
              name="preferredName"
              defaultValue={recipient?.preferredName ?? ""}
              maxLength={80}
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
          <label className={styles.fullField}>
            <span>Relationship</span>
            <input
              name="relationship"
              defaultValue={recipient?.relationship ?? ""}
              maxLength={120}
              placeholder="Parent, partner, friend"
            />
          </label>
          <label className={styles.fullField}>
            <span>Care preferences</span>
            <textarea
              name="carePreferences"
              defaultValue={recipient?.carePreferences ?? ""}
              rows={4}
              maxLength={1000}
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

function EmptyState({
  icon,
  text,
  action,
}: {
  icon: React.ReactNode;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={styles.emptyState}>
      {icon}
      <p>{text}</p>
      {action}
    </div>
  );
}
