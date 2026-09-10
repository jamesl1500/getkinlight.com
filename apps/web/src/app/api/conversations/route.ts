import {
  ConversationWorkspaceResponseSchema,
  HouseholdConversationSchema,
  HouseholdMessageSchema,
  createKinlightServerClient,
} from "@getkinlight.com/shared";
import { NextResponse } from "next/server";

type DirectoryRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  email: string | null;
};

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : null;
}

function memberName(member: DirectoryRow) {
  return (
    [member.first_name, member.last_name].filter(Boolean).join(" ") ||
    member.username ||
    member.email ||
    "Household member"
  );
}

export async function GET(request: Request) {
  const accessToken = bearerToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, message: "Your session has expired." },
      { status: 401 },
    );
  }

  const supabase = createKinlightServerClient(accessToken);
  const { data: userData, error: userError } =
    await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return NextResponse.json(
      { ok: false, message: "Your session has expired." },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const requestedHouseholdId = url.searchParams.get("household") ?? undefined;

  const { data: householdRows, error: householdsError } = await supabase
    .from("households")
    .select("id, name")
    .order("created_at");
  if (householdsError) {
    return NextResponse.json(
      { ok: false, message: "Unable to load conversations." },
      { status: 400 },
    );
  }

  const households = householdRows ?? [];
  const selectedHousehold =
    households.find((household) => household.id === requestedHouseholdId) ??
    households[0] ??
    null;

  if (!selectedHousehold) {
    return NextResponse.json(
      ConversationWorkspaceResponseSchema.parse({
        ok: true,
        message: "Conversations loaded.",
        currentUserId: userData.user.id,
        currentUserName: userData.user.email ?? "You",
        households,
        selectedHousehold: null,
        conversation: null,
        messages: [],
        members: [],
      }),
    );
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
  if (conversationResult.error || membersResult.error) {
    return NextResponse.json(
      { ok: false, message: "Unable to load conversations." },
      { status: 400 },
    );
  }

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
  const currentUserName =
    members.find((member) => member.userId === userData.user.id)
      ?.displayName ??
    userData.user.email ??
    "You";

  if (!conversation) {
    return NextResponse.json(
      ConversationWorkspaceResponseSchema.parse({
        ok: true,
        message: "Conversations loaded.",
        currentUserId: userData.user.id,
        currentUserName,
        households,
        selectedHousehold,
        conversation: null,
        messages: [],
        members,
      }),
    );
  }

  const { data: messageRows, error: messagesError } = await supabase
    .from("household_messages")
    .select(
      "id, conversation_id, household_id, sender_id, body, created_at, edited_at",
    )
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (messagesError) {
    return NextResponse.json(
      { ok: false, message: "Unable to load conversations." },
      { status: 400 },
    );
  }

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

  return NextResponse.json(
    ConversationWorkspaceResponseSchema.parse({
      ok: true,
      message: "Conversations loaded.",
      currentUserId: userData.user.id,
      currentUserName,
      households,
      selectedHousehold,
      conversation,
      messages,
      members,
    }),
  );
}
