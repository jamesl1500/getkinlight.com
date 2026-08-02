"use client";

import {
  ConversationPresenceSchema,
  createKinlightClient,
  type ConversationPresence,
} from "@getkinlight.com/shared";
import { createContext, useContext, useEffect, useRef, useState } from "react";

type PresenceRow = {
  household_id: string;
  user_id: string;
  display_name: string;
  is_typing: boolean;
  online_at: string;
};

type ConversationPresenceContextValue = {
  presenceByConversation: Record<string, ConversationPresence[]>;
  errorsByConversation: Record<string, string>;
  trackTyping: (conversationId: string, isTyping: boolean) => void;
};

type ConversationPresenceProviderProps = {
  children: React.ReactNode;
  userId: string;
  displayName: string;
  conversations: Array<{ id: string; householdId: string }>;
};

const ConversationPresenceContext =
  createContext<ConversationPresenceContextValue | null>(null);
const HEARTBEAT_INTERVAL_MS = 20_000;
const PRESENCE_TIMEOUT_MS = 45_000;

function parsePresence(row: PresenceRow) {
  return ConversationPresenceSchema.safeParse({
    userId: row.user_id,
    displayName: row.display_name,
    isTyping: row.is_typing,
    onlineAt: row.online_at,
  });
}

function isRecent(onlineAt: string) {
  return Date.now() - new Date(onlineAt).getTime() < PRESENCE_TIMEOUT_MS;
}

export function ConversationPresenceProvider({
  children,
  userId,
  displayName,
  conversations,
}: ConversationPresenceProviderProps) {
  const [presenceByConversation, setPresenceByConversation] = useState<
    Record<string, ConversationPresence[]>
  >({});
  const [errorsByConversation, setErrorsByConversation] = useState<
    Record<string, string>
  >({});
  const typingByHouseholdRef = useRef(new Map<string, boolean>());

  useEffect(() => {
    const supabase = createKinlightClient();
    const householdIds = Array.from(
      new Set(conversations.map((conversation) => conversation.householdId)),
    );
    let isDisposed = false;

    function applyRow(row: PresenceRow, remove = false) {
      if (remove) {
        setPresenceByConversation((current) =>
          Object.fromEntries(
            Object.entries(current).map(([conversationId, members]) => [
              conversationId,
              members.filter((member) => member.userId !== row.user_id),
            ]),
          ),
        );
        return;
      }

      const parsed = parsePresence(row);
      if (!parsed.success) return;

      setPresenceByConversation((current) => {
        const next = { ...current };
        for (const conversation of conversations) {
          if (conversation.householdId !== row.household_id) continue;
          const existing = current[conversation.id] ?? [];
          const withoutUser = existing.filter(
            (member) => member.userId !== parsed.data.userId,
          );
          next[conversation.id] = !isRecent(parsed.data.onlineAt)
            ? withoutUser
            : [...withoutUser, parsed.data];
        }
        return next;
      });
    }

    async function writeHeartbeat() {
      if (!householdIds.length) return;
      const onlineAt = new Date().toISOString();
      const { error } = await supabase.from("household_member_presence").upsert(
        householdIds.map((householdId) => ({
          household_id: householdId,
          user_id: userId,
          display_name: displayName,
          is_typing: typingByHouseholdRef.current.get(householdId) ?? false,
          online_at: onlineAt,
        })),
        { onConflict: "household_id,user_id" },
      );
      if (error && !isDisposed) {
        setErrorsByConversation(
          Object.fromEntries(
            conversations.map(({ id }) => [
              id,
              "Live presence is temporarily unavailable.",
            ]),
          ),
        );
      }
    }

    async function loadPresence() {
      if (!householdIds.length) return;
      const cutoff = new Date(Date.now() - PRESENCE_TIMEOUT_MS).toISOString();
      const { data, error } = await supabase
        .from("household_member_presence")
        .select("household_id, user_id, display_name, is_typing, online_at")
        .in("household_id", householdIds)
        .gte("online_at", cutoff);
      if (isDisposed) return;
      if (error) {
        setErrorsByConversation(
          Object.fromEntries(
            conversations.map(({ id }) => [
              id,
              "Live presence is temporarily unavailable.",
            ]),
          ),
        );
        return;
      }

      for (const row of data ?? []) applyRow(row as PresenceRow);
    }

    async function initialize() {
      const [
        {
          data: { session },
          error: sessionError,
        },
        {
          data: { user },
          error: userError,
        },
      ] = await Promise.all([
        supabase.auth.getSession(),
        supabase.auth.getUser(),
      ]);
      if (isDisposed) return;

      if (sessionError || userError || !session || user?.id !== userId) {
        const message =
          sessionError?.message ??
          userError?.message ??
          "Your session has expired.";
        setErrorsByConversation(
          Object.fromEntries(conversations.map(({ id }) => [id, message])),
        );
        return;
      }

      await writeHeartbeat();
      await loadPresence();
      if (!isDisposed) setErrorsByConversation({});
    }

    const channel = supabase
      .channel(`household-presence:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "household_member_presence" },
        (payload) => {
          const row = (
            payload.eventType === "DELETE" ? payload.old : payload.new
          ) as PresenceRow;
          if (!householdIds.includes(row.household_id)) return;
          applyRow(row, payload.eventType === "DELETE");
        },
      )
      .subscribe();

    void initialize();
    const heartbeat = window.setInterval(() => {
      void writeHeartbeat();
      setPresenceByConversation((current) =>
        Object.fromEntries(
          Object.entries(current).map(([conversationId, members]) => [
            conversationId,
            members.filter((member) => isRecent(member.onlineAt)),
          ]),
        ),
      );
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      isDisposed = true;
      window.clearInterval(heartbeat);
      void supabase.removeChannel(channel);
      if (householdIds.length) {
        void supabase
          .from("household_member_presence")
          .delete()
          .eq("user_id", userId)
          .in("household_id", householdIds);
      }
    };
  }, [conversations, displayName, userId]);

  function trackTyping(conversationId: string, isTyping: boolean) {
    const conversation = conversations.find(
      (item) => item.id === conversationId,
    );
    if (!conversation) return;
    typingByHouseholdRef.current.set(conversation.householdId, isTyping);
    const supabase = createKinlightClient();
    void supabase.from("household_member_presence").upsert(
      {
        household_id: conversation.householdId,
        user_id: userId,
        display_name: displayName,
        is_typing: isTyping,
        online_at: new Date().toISOString(),
      },
      { onConflict: "household_id,user_id" },
    );
  }

  return (
    <ConversationPresenceContext.Provider
      value={{ presenceByConversation, errorsByConversation, trackTyping }}
    >
      {children}
    </ConversationPresenceContext.Provider>
  );
}

export function useConversationPresence(conversationId: string) {
  const context = useContext(ConversationPresenceContext);
  if (!context)
    throw new Error(
      "useConversationPresence must be used inside ConversationPresenceProvider.",
    );

  return {
    presence: context.presenceByConversation[conversationId] ?? [],
    error: context.errorsByConversation[conversationId] ?? "",
    trackTyping: (isTyping: boolean) =>
      context.trackTyping(conversationId, isTyping),
  };
}
