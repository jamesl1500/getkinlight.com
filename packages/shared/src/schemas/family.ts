import { z } from "zod";
import { CareRecipientSchema } from "./care";

const uuid = z.uuid();
const memberRole = z.enum(["owner", "member", "caregiver"]);

export const FamilyMutationRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("rename-household"),
    householdId: uuid,
    name: z.string().trim().min(1).max(120),
  }),
  z.object({
    action: z.literal("invite-member"),
    householdId: uuid,
    email: z.email().trim().toLowerCase(),
    role: memberRole.exclude(["owner"]),
  }),
  z.object({
    action: z.literal("cancel-invitation"),
    householdId: uuid,
    invitationId: uuid,
  }),
  z.object({
    action: z.literal("accept-invitation"),
    invitationToken: z.string().uuid(),
  }),
  z.object({
    action: z.literal("update-member-role"),
    householdId: uuid,
    memberId: uuid,
    role: memberRole,
  }),
  z.object({
    action: z.literal("remove-member"),
    householdId: uuid,
    memberId: uuid,
  }),
]);

export type FamilyMutationRequest = z.infer<typeof FamilyMutationRequestSchema>;

export const FamilyMutationResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  invitationToken: z.string().nullable(),
});

export type FamilyMutationResponse = z.infer<
  typeof FamilyMutationResponseSchema
>;

export const FamilyWorkspaceResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  currentUserId: uuid,
  households: z.array(
    z.object({ id: uuid, name: z.string(), createdAt: z.string() }),
  ),
  selectedHousehold: z
    .object({ id: uuid, name: z.string(), createdAt: z.string() })
    .nullable(),
  members: z.array(
    z.object({
      id: uuid,
      userId: uuid,
      role: memberRole,
      firstName: z.string().nullable(),
      lastName: z.string().nullable(),
      username: z.string().nullable(),
      email: z.string().nullable(),
      joinedAt: z.string(),
    }),
  ),
  invitations: z.array(
    z.object({
      id: uuid,
      email: z.email(),
      role: memberRole.exclude(["owner"]),
      token: z.string(),
      expiresAt: z.string(),
    }),
  ),
  recipients: z.array(CareRecipientSchema),
  currentUserRole: memberRole.nullable(),
});

export type FamilyWorkspaceResponse = z.infer<
  typeof FamilyWorkspaceResponseSchema
>;
