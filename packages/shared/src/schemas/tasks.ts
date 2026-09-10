import { z } from "zod";
import { CareScheduleItemSchema } from "./care-schedule";

export const TaskBoardItemSchema = CareScheduleItemSchema.extend({
  assignedTo: z.uuid().nullable(),
  assignedToName: z.string().nullable(),
});

export const TaskBoardMemberSchema = z.object({
  userId: z.uuid(),
  displayName: z.string(),
});

export const TaskBoardResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  households: z.array(z.object({ id: z.uuid(), name: z.string() })),
  selectedHousehold: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  currentUserId: z.uuid(),
  canAssign: z.boolean(),
  members: z.array(TaskBoardMemberSchema),
  items: z.array(TaskBoardItemSchema),
});

export type TaskBoardItem = z.infer<typeof TaskBoardItemSchema>;
export type TaskBoardMember = z.infer<typeof TaskBoardMemberSchema>;
export type TaskBoardResponse = z.infer<typeof TaskBoardResponseSchema>;
