import { z } from "zod";

const isoDateTime = z.iso.datetime({ offset: true });
const resourceType = z.enum(["event", "appointment", "medication", "meal"]);

export const ScheduleTaskAssignmentSchema = z.object({
  id: z.uuid(),
  householdId: z.uuid(),
  resourceType,
  resourceId: z.uuid(),
  assignedTo: z.uuid().nullable(),
  assignedToName: z.string().nullable(),
  claimedAt: isoDateTime.nullable(),
});

export const ClaimScheduleTaskRequestSchema = z.object({
  action: z.enum(["claim", "assign", "unclaim"]),
  householdId: z.uuid(),
  resourceType,
  resourceId: z.uuid(),
  assigneeId: z.uuid().optional(),
});

export const ClaimScheduleTaskResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  assignment: ScheduleTaskAssignmentSchema.nullable(),
});

export const ScheduleTaskAssignmentListResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  assignments: z.array(ScheduleTaskAssignmentSchema),
});

export type ScheduleTaskAssignment = z.infer<
  typeof ScheduleTaskAssignmentSchema
>;
export type ClaimScheduleTaskRequest = z.infer<
  typeof ClaimScheduleTaskRequestSchema
>;
export type ClaimScheduleTaskResponse = z.infer<
  typeof ClaimScheduleTaskResponseSchema
>;
export type ScheduleTaskAssignmentListResponse = z.infer<
  typeof ScheduleTaskAssignmentListResponseSchema
>;
