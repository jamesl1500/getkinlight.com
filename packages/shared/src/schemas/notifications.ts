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
  "schedule-task-claimed",
  "schedule-task-unclaimed",
  "supply-item-created",
  "supply-item-checked",
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

export const MarkNotificationsReadRequestSchema = z.discriminatedUnion(
  "action",
  [
    z.object({ action: z.literal("mark-read"), activityId: z.uuid() }),
    z.object({ action: z.literal("mark-all-read") }),
  ],
);

export const MarkNotificationsReadResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
});

const deviceId = z.string().trim().min(1).max(200);
const expoPushToken = z
  .string()
  .trim()
  .regex(/^Expo(nent)?PushToken\[[^\]]+\]$/);

export const NotificationPreferencesSchema = z.object({
  careUpdatesEnabled: z.boolean(),
  scheduleRemindersEnabled: z.boolean(),
  invitationsEnabled: z.boolean(),
});

export const NotificationDeviceRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("register"),
    deviceId,
    expoPushToken,
    platform: z.enum(["android", "ios"]),
    preferences: NotificationPreferencesSchema,
  }),
  z.object({
    action: z.literal("update-preferences"),
    deviceId,
    preferences: NotificationPreferencesSchema,
  }),
  z.object({ action: z.literal("unregister"), deviceId }),
]);

export const NotificationDeviceResponseSchema = z.object({
  ok: z.boolean(),
  registered: z.boolean(),
  preferences: NotificationPreferencesSchema.nullable(),
  message: z.string(),
});

export type ActivityType = z.infer<typeof ActivityTypeSchema>;
export type HouseholdActivity = z.infer<typeof HouseholdActivitySchema>;
export type NotificationListResponse = z.infer<
  typeof NotificationListResponseSchema
>;
export type MarkNotificationsReadRequest = z.infer<
  typeof MarkNotificationsReadRequestSchema
>;
export type MarkNotificationsReadResponse = z.infer<
  typeof MarkNotificationsReadResponseSchema
>;
export type NotificationPreferences = z.infer<
  typeof NotificationPreferencesSchema
>;
export type NotificationDeviceRequest = z.infer<
  typeof NotificationDeviceRequestSchema
>;
export type NotificationDeviceResponse = z.infer<
  typeof NotificationDeviceResponseSchema
>;
