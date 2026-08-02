import { z } from "zod";

const uuid = z.uuid();
const optionalText = (max: number) => z.string().trim().max(max).optional();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const recipientFields = {
  householdId: uuid,
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  preferredName: optionalText(80),
  dateOfBirth: date.optional(),
  relationship: optionalText(120),
  carePreferences: optionalText(1000),
};

export const CareMutationRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create-recipient"),
    ...recipientFields,
  }),
  z.object({
    action: z.literal("update-recipient"),
    recipientId: uuid,
    isActive: z.boolean(),
    ...recipientFields,
  }),
  z.object({
    action: z.literal("create-check-in"),
    householdId: uuid,
    recipientId: uuid,
    status: z.enum(["doing_well", "okay", "needs_attention", "urgent"]),
    mood: z.number().int().min(1).max(5).optional(),
    summary: optionalText(1000),
  }),
  z.object({
    action: z.literal("create-note"),
    householdId: uuid,
    recipientId: uuid,
    title: optionalText(120),
    body: z.string().trim().min(1).max(4000),
    isPinned: z.boolean(),
  }),
  z.object({
    action: z.literal("create-medication"),
    householdId: uuid,
    recipientId: uuid,
    medicationName: z.string().trim().min(1).max(120),
    dosage: optionalText(120),
    instructions: optionalText(1000),
    startsOn: date,
    endsOn: date.optional(),
    reminderTimes: z.array(time).min(1).max(8),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7),
  }),
  z.object({
    action: z.literal("update-medication"),
    medicationId: uuid,
    householdId: uuid,
    recipientId: uuid,
    medicationName: z.string().trim().min(1).max(120),
    dosage: optionalText(120),
    instructions: optionalText(1000),
    startsOn: date,
    endsOn: date.optional(),
    reminderTimes: z.array(time).min(1).max(8),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7),
    isActive: z.boolean(),
  }),
]);

export type CareMutationRequest = z.infer<typeof CareMutationRequestSchema>;

export const CareMutationResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  id: z.uuid().nullable(),
});

export type CareMutationResponse = z.infer<typeof CareMutationResponseSchema>;