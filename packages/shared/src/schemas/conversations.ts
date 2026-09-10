import { z } from "zod";

const isoDateTime = z.iso.datetime({ offset: true });

export const HouseholdConversationSchema = z.object({
  id: z.uuid(),
  householdId: z.uuid(),
  title: z.string().trim().min(1).max(120),
  isDefault: z.boolean(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const HouseholdMessageSchema = z.object({
  id: z.uuid(),
  conversationId: z.uuid(),
  householdId: z.uuid(),
  senderId: z.uuid(),
  body: z.string().trim().min(1).max(4000),
  createdAt: isoDateTime,
  editedAt: isoDateTime.nullable(),
});

export const SendHouseholdMessageSchema = z.object({
  conversationId: z.uuid(),
  householdId: z.uuid(),
  body: z.string().trim().min(1, "Write a message first.").max(4000, "Keep messages under 4,000 characters."),
});

export const ConversationPresenceSchema = z.object({
  userId: z.uuid(),
  displayName: z.string().trim().min(1).max(160),
  isTyping: z.boolean(),
  onlineAt: isoDateTime,
});

export const ConversationMemberSchema = z.object({
  userId: z.uuid(),
  displayName: z.string(),
});

export const ConversationWorkspaceResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  currentUserId: z.uuid(),
  currentUserName: z.string(),
  households: z.array(z.object({ id: z.uuid(), name: z.string() })),
  selectedHousehold: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  conversation: HouseholdConversationSchema.nullable(),
  messages: z.array(HouseholdMessageSchema),
  members: z.array(ConversationMemberSchema),
});

export type HouseholdConversation = z.infer<typeof HouseholdConversationSchema>;
export type HouseholdMessage = z.infer<typeof HouseholdMessageSchema>;
export type SendHouseholdMessage = z.infer<typeof SendHouseholdMessageSchema>;
export type ConversationPresence = z.infer<typeof ConversationPresenceSchema>;
export type ConversationMember = z.infer<typeof ConversationMemberSchema>;
export type ConversationWorkspaceResponse = z.infer<
  typeof ConversationWorkspaceResponseSchema
>;