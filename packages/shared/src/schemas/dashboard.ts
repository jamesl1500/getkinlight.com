import { z } from "zod";
import { CareScheduleItemSchema } from "./care-schedule";

export const DashboardCareUpdateSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["medication", "meal", "mood", "note"]),
  summary: z.string(),
  occurredAt: z.string(),
  recipientName: z.string().nullable(),
  authorName: z.string().nullable(),
});

export const DashboardResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  profile: z.object({
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    username: z.string().nullable(),
    role: z.string().nullable(),
  }),
  household: z
    .object({
      id: z.uuid(),
      name: z.string(),
      role: z.enum(["owner", "member", "caregiver"]),
    })
    .nullable(),
  schedule: z.array(CareScheduleItemSchema),
  recentUpdates: z.array(DashboardCareUpdateSchema),
});

export type DashboardResponse = z.infer<typeof DashboardResponseSchema>;
export type DashboardCareUpdate = z.infer<typeof DashboardCareUpdateSchema>;
