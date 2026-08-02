"use client";

import { useConversationPresence } from "@/components/conversations/conversation-presence-provider";
import type { ConversationWorkspaceData } from "@/lib/conversations";
import {
  HouseholdMessageSchema,
  SendHouseholdMessageSchema,
  createKinlightClient,
} from "@getkinlight.com/shared";
import {
  House,
  MessageCircle,
  SendHorizontal,
  UsersRound,
  Wifi,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./conversation-workspace.module.scss";

type MessageRow = {
  id: string;
  conversation_id: string;
  household_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
};

function toMessage(row: MessageRow) {
  return HouseholdMessageSchema.parse({
    id: row.id,
    conversationId: row.conversation_id,
    householdId: row.household_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
    editedAt: row.edited_at,
  });
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function messageTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ConversationWorkspace({
  data,
}: {
  data: ConversationWorkspaceData;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(data.messages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const typingTimerRef = useRef<number | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const conversation = data.conversation;
  const {
    presence,
    error: presenceError,
    trackTyping,
  } = useConversationPresence(conversation?.id ?? "");
  const memberNames = new Map(
    data.members.map((member) => [member.userId, member.displayName]),
  );
  const onlineIds = new Set(presence.map((member) => member.userId));
  const typingNames = presence
    .filter((member) => member.userId !== data.currentUserId && member.isTyping)
    .map((member) => member.displayName);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    if (!conversation) return;
    const supabase = createKinlightClient();
    const channel = supabase
      .channel(`household-messages:${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "household_messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const result = HouseholdMessageSchema.safeParse({
            id: payload.new.id,
            conversationId: payload.new.conversation_id,
            householdId: payload.new.household_id,
            senderId: payload.new.sender_id,
            body: payload.new.body,
            createdAt: payload.new.created_at,
            editedAt: payload.new.edited_at,
          });
          if (result.success) {
            setMessages((current) =>
              current.some((message) => message.id === result.data.id)
                ? current
                : [...current, result.data],
            );
          }
        },
      )
      .subscribe();

    return () => {
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [conversation]);

  function updateDraft(value: string) {
    setDraft(value);
    trackTyping(Boolean(value.trim()));
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => trackTyping(false), 1800);
  }

  async function sendMessage() {
    if (!conversation || !data.selectedHousehold || isSending) return;
    const input = SendHouseholdMessageSchema.safeParse({
      conversationId: conversation.id,
      householdId: data.selectedHousehold.id,
      body: draft,
    });
    if (!input.success) {
      setError(input.error.issues[0]?.message ?? "Review your message.");
      return;
    }

    setIsSending(true);
    setError("");
    const supabase = createKinlightClient();
    const { data: row, error: insertError } = await supabase
      .from("household_messages")
      .insert({
        conversation_id: input.data.conversationId,
        household_id: input.data.householdId,
        sender_id: data.currentUserId,
        body: input.data.body,
      })
      .select(
        "id, conversation_id, household_id, sender_id, body, created_at, edited_at",
      )
      .single();

    if (insertError || !row) {
      setError(insertError?.message ?? "Unable to send this message.");
    } else {
      const message = toMessage(row as MessageRow);
      setMessages((current) =>
        current.some((item) => item.id === message.id)
          ? current
          : [...current, message],
      );
      setDraft("");
      trackTyping(false);
    }
    setIsSending(false);
  }

  if (!data.selectedHousehold || !conversation) {
    return (
      <main className={styles.emptyPage}>
        <span>
          <House size={28} aria-hidden />
        </span>
        <h1>No household conversation yet</h1>
        <p>Create or join a household to start sharing updates.</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p>Family communication</p>
          <h1>Conversations</h1>
          <span>
            Keep everyday updates together with the people who share care.
          </span>
        </div>
        {data.households.length > 1 && (
          <label className={styles.householdPicker}>
            <span>Household</span>
            <select
              value={data.selectedHousehold.id}
              onChange={(event) =>
                router.push(`/conversations?household=${event.target.value}`)
              }
            >
              {data.households.map((household) => (
                <option key={household.id} value={household.id}>
                  {household.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      <section className={styles.workspace}>
        <aside className={styles.peoplePanel}>
          <header>
            <span>
              <UsersRound size={17} aria-hidden />
            </span>
            <div>
              <strong>{data.selectedHousehold.name}</strong>
              <small>{data.members.length} members</small>
            </div>
          </header>
          <div className={styles.peopleList}>
            {data.members.map((member) => (
              <div key={member.userId} className={styles.person}>
                <span className={styles.avatar}>
                  {initials(member.displayName)}
                </span>
                <span>
                  <strong>
                    {member.userId === data.currentUserId
                      ? "You"
                      : member.displayName}
                  </strong>
                  <small>
                    {onlineIds.has(member.userId) ? "Online" : "Offline"}
                  </small>
                </span>
                <i data-online={onlineIds.has(member.userId)} aria-hidden />
              </div>
            ))}
          </div>
        </aside>

        <div className={styles.conversationPanel}>
          <header className={styles.conversationHeader}>
            <span className={styles.conversationIcon}>
              <MessageCircle size={19} aria-hidden />
            </span>
            <div>
              <h2>{conversation.title}</h2>
              <p>
                <Wifi size={12} aria-hidden /> Live household conversation
              </p>
            </div>
            <span className={styles.onlineCount}>{onlineIds.size} online</span>
          </header>

          <div className={styles.messageList} aria-live="polite">
            {messages.length === 0 ? (
              <div className={styles.emptyMessages}>
                <MessageCircle size={24} aria-hidden />
                <strong>Start the conversation</strong>
                <span>
                  Messages from your household will stay together here.
                </span>
              </div>
            ) : (
              messages.map((message, index) => {
                const isOwn = message.senderId === data.currentUserId;
                const senderName =
                  memberNames.get(message.senderId) ?? "Household member";
                const showIdentity =
                  index === 0 ||
                  messages[index - 1]?.senderId !== message.senderId;
                return (
                  <article
                    key={message.id}
                    className={`${styles.message} ${isOwn ? styles.ownMessage : ""} ${!isOwn && !showIdentity ? styles.continuation : ""}`}
                  >
                    {!isOwn && showIdentity && (
                      <span className={styles.messageAvatar}>
                        {initials(senderName)}
                      </span>
                    )}
                    <div>
                      {showIdentity && (
                        <header>
                          <strong>{isOwn ? "You" : senderName}</strong>
                          <time dateTime={message.createdAt}>
                            {messageTime(message.createdAt)}
                          </time>
                        </header>
                      )}
                      <p>{message.body}</p>
                    </div>
                  </article>
                );
              })
            )}
            <div ref={endRef} />
          </div>

          <div className={styles.composerArea}>
            <span className={styles.typingStatus}>
              {typingNames.length
                ? `${typingNames.join(", ")} ${typingNames.length === 1 ? "is" : "are"} typing...`
                : ""}
            </span>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage();
              }}
              className={styles.composer}
            >
              <textarea
                value={draft}
                onChange={(event) => updateDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                maxLength={4000}
                rows={2}
                placeholder="Message your household"
                aria-label="Message your household"
              />
              <button
                type="submit"
                disabled={isSending || !draft.trim()}
                aria-label="Send message"
                title="Send message"
              >
                <SendHorizontal size={19} aria-hidden />
              </button>
            </form>
            {(error || presenceError) && (
              <p className={styles.error} role="alert">
                {error || presenceError}
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
