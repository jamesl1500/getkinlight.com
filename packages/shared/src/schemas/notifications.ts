import { z } from "zod";

const isoDateTime = z.iso.datetime({ offset: true });

export const ActivityTypeSchema = z.enum([
  "care-recipient-created",
  "care-recipient-updated",
  "check-in-created",
  "note-created",
  "medication-created",
  "medication-updated",
  "event-created",
  "event-updated",
  "appointment-created",
  "meal-reminder-created",
  "household-updated",
  "invitation-created",
  "invitation-cancelled",
  "member-joined",
  "member-role-updated",
  "member-removed",
  "message-created",
]);

export const HouseholdActivitySchema = z.object({
  id: z.uuid(),
  householdId: z.uuid(),
  actorUserId: z.uuid().nullable(),
  activityType: ActivityTypeSchema,
  title: z.string(),
  body: z.string(),
  resourceType: z.string().nullable(),
  resourceId: z.uuid().nullable(),
  href: z.string().startsWith("/").nullable(),
  createdAt: isoDateTime,
  readAt: isoDateTime.nullable(),
});

export const NotificationListResponseSchema = z.object({
  ok: z.boolean(),
  activities: z.array(HouseholdActivitySchema),
  unreadCount: z.number().int().nonnegative(),
  message: z.string().nullable(),
});

export const MarkNotificationsReadRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark-read"), activityId: z.uuid() }),
  z.object({ action: z.literal("mark-all-read") }),
]);

export const MarkNotificationsReadResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
});

export type ActivityType = z.infer<typeof ActivityTypeSchema>;
export type HouseholdActivity = z.infer<typeof HouseholdActivitySchema>;
export type NotificationListResponse = z.infer<typeof NotificationListResponseSchema>;
export type MarkNotificationsReadRequest = z.infer<typeof MarkNotificationsReadRequestSchema>;