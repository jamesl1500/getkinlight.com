import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type {
  ConversationPresence,
  ConversationWorkspaceResponse,
  HouseholdMessage,
} from "@getkinlight.com/shared";
import {
  ConversationPresenceSchema,
  HouseholdMessageSchema,
} from "@getkinlight.com/shared";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { KinlightBackdrop } from "@/components/kinlight-screen";
import { Colors, Radius, Shadow, Spacing, Type } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { createMobileApiClient } from "@/lib/api";
import { getSupabaseClient } from "@/lib/supabase";

const PRESENCE_TIMEOUT_MS = 45_000;
const HEARTBEAT_INTERVAL_MS = 20_000;

type PresenceRow = {
  household_id: string;
  user_id: string;
  display_name: string;
  is_typing: boolean;
  online_at: string;
};

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

function isRecent(onlineAt: string) {
  return Date.now() - new Date(onlineAt).getTime() < PRESENCE_TIMEOUT_MS;
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Kinlight could not load your conversation.";
}

function messageTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ConversationWorkspace() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const [workspace, setWorkspace] = useState<ConversationWorkspaceResponse | null>(
    null,
  );
  const [messages, setMessages] = useState<HouseholdMessage[]>([]);
  const [presence, setPresence] = useState<ConversationPresence[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    createMobileApiClient()
      .conversations.get()
      .then((result) => {
        if (!active) return;
        setWorkspace(result);
        setMessages(result.messages);
      })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  const conversation = workspace?.conversation ?? null;
  const household = workspace?.selectedHousehold ?? null;
  const memberNames = new Map(
    (workspace?.members ?? []).map((member) => [
      member.userId,
      member.displayName,
    ]),
  );

  useEffect(() => {
    if (!conversation || !household || !workspace) return;
    const supabase = getSupabaseClient();
    const userId = workspace.currentUserId;
    const displayName = workspace.currentUserName;

    async function writeHeartbeat(isTyping: boolean) {
      await supabase.from("household_member_presence").upsert(
        {
          household_id: household!.id,
          user_id: userId,
          display_name: displayName,
          is_typing: isTyping,
          online_at: new Date().toISOString(),
        },
        { onConflict: "household_id,user_id" },
      );
    }

    async function loadPresence() {
      const cutoff = new Date(Date.now() - PRESENCE_TIMEOUT_MS).toISOString();
      const { data } = await supabase
        .from("household_member_presence")
        .select("household_id, user_id, display_name, is_typing, online_at")
        .eq("household_id", household!.id)
        .gte("online_at", cutoff);
      setPresence(
        ((data ?? []) as PresenceRow[]).flatMap((row) => {
          const parsed = ConversationPresenceSchema.safeParse({
            userId: row.user_id,
            displayName: row.display_name,
            isTyping: row.is_typing,
            onlineAt: row.online_at,
          });
          return parsed.success ? [parsed.data] : [];
        }),
      );
    }

    void writeHeartbeat(false);
    void loadPresence();

    const messageChannel = supabase
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
          if (!result.success) return;
          setMessages((current) =>
            current.some((message) => message.id === result.data.id)
              ? current
              : [...current, result.data],
          );
        },
      )
      .subscribe();

    const presenceChannel = supabase
      .channel(`household-presence:${household.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "household_member_presence",
          filter: `household_id=eq.${household.id}`,
        },
        (payload) => {
          const row = (
            payload.eventType === "DELETE" ? payload.old : payload.new
          ) as PresenceRow;
          if (payload.eventType === "DELETE") {
            setPresence((current) =>
              current.filter((member) => member.userId !== row.user_id),
            );
            return;
          }
          const parsed = ConversationPresenceSchema.safeParse({
            userId: row.user_id,
            displayName: row.display_name,
            isTyping: row.is_typing,
            onlineAt: row.online_at,
          });
          if (!parsed.success) return;
          setPresence((current) => {
            const withoutUser = current.filter(
              (member) => member.userId !== parsed.data.userId,
            );
            return isRecent(parsed.data.onlineAt)
              ? [...withoutUser, parsed.data]
              : withoutUser;
          });
        },
      )
      .subscribe();

    const heartbeat = setInterval(() => {
      void writeHeartbeat(false);
      setPresence((current) =>
        current.filter((member) => isRecent(member.onlineAt)),
      );
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(heartbeat);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      void supabase.removeChannel(messageChannel);
      void supabase.removeChannel(presenceChannel);
      void supabase
        .from("household_member_presence")
        .delete()
        .eq("user_id", userId)
        .eq("household_id", household.id);
    };
  }, [conversation, household, workspace]);

  function setTypingStatus(isTyping: boolean) {
    if (!household || !workspace) return;
    const supabase = getSupabaseClient();
    void supabase.from("household_member_presence").upsert(
      {
        household_id: household.id,
        user_id: workspace.currentUserId,
        display_name: workspace.currentUserName,
        is_typing: isTyping,
        online_at: new Date().toISOString(),
      },
      { onConflict: "household_id,user_id" },
    );
  }

  function updateDraft(value: string) {
    setDraft(value);
    setTypingStatus(Boolean(value.trim()));
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => setTypingStatus(false), 1800);
  }

  async function sendMessage() {
    const body = draft.trim();
    if (!body || !conversation || !household || !workspace || sending) return;
    setSending(true);
    setError("");
    const supabase = getSupabaseClient();
    const { data: row, error: insertError } = await supabase
      .from("household_messages")
      .insert({
        conversation_id: conversation.id,
        household_id: household.id,
        sender_id: workspace.currentUserId,
        body,
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
    }
    setSending(false);
  }

  const typingNames = presence
    .filter(
      (member) => member.userId !== workspace?.currentUserId && member.isTyping,
    )
    .map((member) => member.displayName);
  const onlineCount = presence.length;

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <KinlightBackdrop />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={[styles.body, { color: colors.textMuted }]}>
            Opening your family conversation...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !workspace) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <KinlightBackdrop />
        <View style={styles.loading}>
          <MaterialIcons name="cloud-off" size={30} color={colors.danger} />
          <Text style={[styles.body, { color: colors.textMuted }]}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!household || !conversation) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <KinlightBackdrop />
        <View style={styles.loading}>
          <MaterialIcons name="home" size={30} color={colors.icon} />
          <Text style={[styles.title, { color: colors.text }]}>
            No household conversation yet
          </Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>
            Create or join a household to start sharing updates.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <KinlightBackdrop />
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>
            {household.name}
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>Messages</Text>
        </View>
        <Text style={[styles.presence, { color: colors.textMuted }]}>
          {onlineCount > 0 ? `${onlineCount} online` : ""}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.messages}
        >
          {messages.map((message) => {
            const isMine = message.senderId === workspace?.currentUserId;
            return (
              <View
                key={message.id}
                style={[
                  styles.bubble,
                  isMine
                    ? { alignSelf: "flex-end", backgroundColor: colors.primary }
                    : {
                        alignSelf: "flex-start",
                        backgroundColor: colors.glass,
                        borderColor: colors.glassBorder,
                        borderWidth: 1,
                      },
                ]}
              >
                {!isMine ? (
                  <Text style={[styles.sender, { color: colors.accent }]}>
                    {memberNames.get(message.senderId) ?? "Household member"}
                  </Text>
                ) : null}
                <Text
                  style={[
                    styles.bubbleText,
                    { color: isMine ? colors.background : colors.text },
                  ]}
                >
                  {message.body}
                </Text>
                <Text
                  style={[
                    styles.bubbleTime,
                    {
                      color: isMine
                        ? colors.background
                        : colors.textMuted,
                    },
                  ]}
                >
                  {messageTime(message.createdAt)}
                </Text>
              </View>
            );
          })}
          {messages.length === 0 ? (
            <Text style={[styles.body, { color: colors.textMuted }]}>
              No messages yet. Say hello to your family.
            </Text>
          ) : null}
        </ScrollView>

        {typingNames.length > 0 ? (
          <Text style={[styles.typing, { color: colors.textMuted }]}>
            {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"}{" "}
            typing...
          </Text>
        ) : null}

        {error ? (
          <Text style={[styles.errorText, { color: colors.danger }]}>
            {error}
          </Text>
        ) : null}

        <View
          style={[
            styles.composer,
            { backgroundColor: colors.glass, borderColor: colors.glassBorder },
          ]}
        >
          <TextInput
            value={draft}
            onChangeText={updateDraft}
            placeholder="Write a message..."
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.text }]}
            multiline
            maxLength={4000}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            disabled={sending || !draft.trim()}
            onPress={() => void sendMessage()}
            style={[
              styles.sendButton,
              {
                backgroundColor:
                  sending || !draft.trim() ? colors.glassStrong : colors.primary,
              },
            ]}
          >
            <MaterialIcons
              name="send"
              size={19}
              color={sending || !draft.trim() ? colors.icon : colors.background}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, overflow: "hidden" },
  flex: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerCopy: { gap: Spacing.xs },
  eyebrow: { ...Type.caption, textTransform: "uppercase" },
  title: { ...Type.title },
  presence: { ...Type.caption },
  body: { ...Type.body, textAlign: "center" },
  messages: {
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 2,
    ...Shadow,
  },
  sender: { ...Type.caption, fontWeight: "700" },
  bubbleText: { ...Type.body },
  bubbleTime: { ...Type.caption, alignSelf: "flex-end" },
  typing: {
    ...Type.caption,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xs,
  },
  errorText: {
    ...Type.caption,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xs,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
    margin: Spacing.xl,
    marginTop: 0,
    padding: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
