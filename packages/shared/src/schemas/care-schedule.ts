import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const optionalText = z.string().trim().max(500).optional();

const baseSchema = z.object({
  householdId: z.uuid(),
  recipientId: z.uuid().optional(),
  date: dateSchema,
  time: timeSchema,
});

export const CreateCareScheduleRequestSchema = z.discriminatedUnion("type", [
  baseSchema.extend({
    type: z.literal("event"),
    title: z.string().trim().min(1).max(120),
    location: optionalText,
    notes: optionalText,
    isAllDay: z.boolean().default(false),
  }),
  baseSchema.extend({
    type: z.literal("appointment"),
    title: z.string().trim().min(1).max(120),
    providerName: optionalText,
    location: optionalText,
    notes: optionalText,
  }),
  baseSchema.extend({
    type: z.literal("medication"),
    title: z.string().trim().min(1).max(120),
    dosage: optionalText,
    notes: optionalText,
  }),
  baseSchema.extend({
    type: z.literal("meal"),
    title: z.string().trim().min(1).max(120),
    mealType: z.enum([
      "breakfast",
      "lunch",
      "dinner",
      "snack",
      "hydration",
      "meal",
      "other",
    ]),
    notes: optionalText,
  }),
]);

export type CreateCareScheduleRequest = z.infer<
  typeof CreateCareScheduleRequestSchema
>;

export const UpdateFamilyEventRequestSchema = baseSchema.extend({
  eventId: z.uuid(),
  title: z.string().trim().min(1).max(120),
  location: optionalText,
  notes: optionalText,
  isAllDay: z.boolean().default(false),
});

export type UpdateFamilyEventRequest = z.infer<
  typeof UpdateFamilyEventRequestSchema
>;

export const CareScheduleItemSchema = z.object({
  id: z.string(),
  sourceId: z.uuid(),
  householdId: z.uuid(),
  recipientId: z.uuid().nullable(),
  kind: z.enum(["appointment", "event", "medication", "meal"]),
  title: z.string(),
  detail: z.string().nullable(),
  recipientName: z.string().nullable(),
  startsAt: z.string(),
  isAllDay: z.boolean(),
  details: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
    }),
  ),
});

export const CareScheduleRangeQuerySchema = z.object({
  start: dateSchema,
  end: dateSchema,
});

export const CareScheduleRangeResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  start: dateSchema,
  end: dateSchema,
  items: z.array(CareScheduleItemSchema),
  households: z.array(z.object({ id: z.uuid(), name: z.string() })),
  recipients: z.array(
    z.object({
      id: z.uuid(),
      householdId: z.uuid(),
      name: z.string(),
    }),
  ),
});

export const CreateCareScheduleResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  item: CareScheduleItemSchema.nullable(),
});

export type CareScheduleItem = z.infer<typeof CareScheduleItemSchema>;

export type CareScheduleRangeQuery = z.infer<
  typeof CareScheduleRangeQuerySchema
>;

export type CareScheduleRangeResponse = z.infer<
  typeof CareScheduleRangeResponseSchema
>;

export type CreateCareScheduleResponse = z.infer<
  typeof CreateCareScheduleResponseSchema
>;

export const UpdateFamilyEventResponseSchema = CreateCareScheduleResponseSchema;
export type UpdateFamilyEventResponse = z.infer<
  typeof UpdateFamilyEventResponseSchema
>;
