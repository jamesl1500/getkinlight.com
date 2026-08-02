import {
  HouseholdConversationSchema,
  HouseholdMessageSchema,
  type HouseholdConversation,
  type HouseholdMessage,
} from "@getkinlight.com/shared";
import { createKinlightServerComponentClient } from "@/lib/supabase/server";

type DirectoryRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  email: string | null;
};

export type ConversationMember = {
  userId: string;
  displayName: string;
};

export type ConversationWorkspaceData = {
  currentUserId: string;
  currentUserName: string;
  households: Array<{ id: string; name: string }>;
  selectedHousehold: { id: string; name: string } | null;
  conversation: HouseholdConversation | null;
  messages: HouseholdMessage[];
  members: ConversationMember[];
};

function memberName(member: DirectoryRow) {
  return (
    [member.first_name, member.last_name].filter(Boolean).join(" ") ||
    member.username ||
    member.email ||
    "Household member"
  );
}

export async function getConversationWorkspaceData(
  requestedHouseholdId?: string,
): Promise<ConversationWorkspaceData> {
  const supabase = await createKinlightServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication is required.");

  const { data: householdRows, error: householdsError } = await supabase
    .from("households")
    .select("id, name")
    .order("created_at");
  if (householdsError) throw householdsError;

  const households = householdRows ?? [];
  const selectedHousehold =
    households.find((household) => household.id === requestedHouseholdId) ??
    households[0] ??
    null;
  if (!selectedHousehold) {
    return {
      currentUserId: user.id,
      currentUserName: user.email ?? "You",
      households,
      selectedHousehold: null,
      conversation: null,
      messages: [],
      members: [],
    };
  }

  const [conversationResult, membersResult] = await Promise.all([
    supabase
      .from("household_conversations")
      .select("id, household_id, title, is_default, created_at, updated_at")
      .eq("household_id", selectedHousehold.id)
      .eq("is_default", true)
      .maybeSingle(),
    supabase.rpc("get_household_member_directory", {
      target_household_id: selectedHousehold.id,
    }),
  ]);
  if (conversationResult.error) throw conversationResult.error;
  if (membersResult.error) throw membersResult.error;

  const directory = (membersResult.data ?? []) as DirectoryRow[];
  const members = directory.map((member) => ({
    userId: member.user_id,
    displayName: memberName(member),
  }));
  const conversation = conversationResult.data
    ? HouseholdConversationSchema.parse({
        id: conversationResult.data.id,
        householdId: conversationResult.data.household_id,
        title: conversationResult.data.title,
        isDefault: conversationResult.data.is_default,
        createdAt: conversationResult.data.created_at,
        updatedAt: conversationResult.data.updated_at,
      })
    : null;

  if (!conversation) {
    return {
      currentUserId: user.id,
      currentUserName:
        members.find((member) => member.userId === user.id)?.displayName ??
        user.email ??
        "You",
      households,
      selectedHousehold,
      conversation,
      messages: [],
      members,
    };
  }

  const { data: messageRows, error: messagesError } = await supabase
    .from("household_messages")
    .select(
      "id, conversation_id, household_id, sender_id, body, created_at, edited_at",
    )
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (messagesError) throw messagesError;

  const messages = (messageRows ?? []).reverse().map((message) =>
    HouseholdMessageSchema.parse({
      id: message.id,
      conversationId: message.conversation_id,
      householdId: message.household_id,
      senderId: message.sender_id,
      body: message.body,
      createdAt: message.created_at,
      editedAt: message.edited_at,
    }),
  );

  return {
    currentUserId: user.id,
    currentUserName:
      members.find((member) => member.userId === user.id)?.displayName ??
      user.email ??
      "You",
    households,
    selectedHousehold,
    conversation,
    messages,
    members,
  };
}
