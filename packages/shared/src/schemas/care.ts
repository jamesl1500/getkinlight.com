import { z } from "zod";
import { CareScheduleItemSchema } from "./care-schedule";

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

export const CareRecipientSchema = z.object({
  id: uuid,
  householdId: uuid,
  firstName: z.string(),
  lastName: z.string(),
  preferredName: z.string().nullable(),
  dateOfBirth: date.nullable(),
  relationship: z.string().nullable(),
  carePreferences: z.string().nullable(),
  isActive: z.boolean(),
});

export const MedicationReminderSchema = z.object({
  id: uuid,
  medicationName: z.string(),
  dosage: z.string().nullable(),
  instructions: z.string().nullable(),
  startsOn: date,
  endsOn: date.nullable(),
  reminderTimes: z.array(z.string()),
  daysOfWeek: z.array(z.number().int()),
  isActive: z.boolean(),
});

export const EatingReminderSchema = z.object({
  id: uuid,
  title: z.string(),
  mealType: z.string(),
  reminderTimes: z.array(z.string()),
  isActive: z.boolean(),
});

export const CareCheckInSchema = z.object({
  id: uuid,
  status: z.enum(["doing_well", "okay", "needs_attention", "urgent"]),
  mood: z.number().int().min(1).max(5).nullable(),
  summary: z.string().nullable(),
  occurredAt: z.string(),
});

export const CareNoteSchema = z.object({
  id: uuid,
  title: z.string().nullable(),
  body: z.string(),
  isPinned: z.boolean(),
  createdAt: z.string(),
});

export const CareWorkspaceResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  households: z.array(z.object({ id: uuid, name: z.string() })),
  recipients: z.array(CareRecipientSchema),
  selectedRecipient: CareRecipientSchema.nullable(),
  medications: z.array(MedicationReminderSchema),
  eatingReminders: z.array(EatingReminderSchema),
  checkIns: z.array(CareCheckInSchema),
  notes: z.array(CareNoteSchema),
  schedule: z.array(CareScheduleItemSchema),
});

export type CareRecipient = z.infer<typeof CareRecipientSchema>;
export type MedicationReminder = z.infer<typeof MedicationReminderSchema>;
export type EatingReminder = z.infer<typeof EatingReminderSchema>;
export type CareCheckIn = z.infer<typeof CareCheckInSchema>;
export type CareNote = z.infer<typeof CareNoteSchema>;
export type CareWorkspaceResponse = z.infer<typeof CareWorkspaceResponseSchema>;
