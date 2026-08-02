import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const AiSourceSchema = z.object({
  type: z.enum(["schedule", "check_in", "note", "medication", "document"]),
  id: z.string(),
  label: z.string(),
  occurredAt: z.string().nullable(),
});

export type AiSource = z.infer<typeof AiSourceSchema>;

export const AiInsightSchema = z.object({
  title: z.string(),
  detail: z.string(),
  severity: z.enum(["info", "attention", "urgent"]),
  sourceIds: z.array(z.string()),
});

export type AiInsight = z.infer<typeof AiInsightSchema>;

export const AiDailyBriefSchema = z.object({
  greeting: z.string(),
  summary: z.string(),
  priorities: z.array(z.string()),
  changes: z.array(z.string()),
  insights: z.array(AiInsightSchema),
  sources: z.array(AiSourceSchema),
  disclaimer: z.string(),
});

export type AiDailyBrief = z.infer<typeof AiDailyBriefSchema>;

export const AiChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

export type AiChatMessage = z.infer<typeof AiChatMessageSchema>;

export const AiConversationAnswerSchema = z.object({
  answer: z.string(),
  sources: z.array(AiSourceSchema),
  suggestedPrompts: z.array(z.string()).max(3),
  disclaimer: z.string(),
});

export type AiConversationAnswer = z.infer<typeof AiConversationAnswerSchema>;

export const AiScheduleProposalSchema = z.object({
  type: z.enum(["event", "appointment", "medication", "meal"]),
  householdId: z.uuid(),
  recipientId: z.uuid().nullable(),
  title: z.string(),
  date: dateSchema,
  time: timeSchema,
  location: z.string().nullable(),
  notes: z.string().nullable(),
  providerName: z.string().nullable(),
  dosage: z.string().nullable(),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack", "hydration", "meal", "other"]).nullable(),
  isAllDay: z.boolean(),
  confidence: z.number().min(0).max(1),
  needsReview: z.array(z.string()),
});

export type AiScheduleProposal = z.infer<typeof AiScheduleProposalSchema>;

export const AiHandoffSchema = z.object({
  title: z.string(),
  summary: z.string(),
  wellbeing: z.array(z.string()),
  medications: z.array(z.string()),
  upcoming: z.array(z.string()),
  followUps: z.array(z.string()),
  sources: z.array(AiSourceSchema),
  disclaimer: z.string(),
});

export type AiHandoff = z.infer<typeof AiHandoffSchema>;

export const AiSearchAnswerSchema = z.object({
  answer: z.string(),
  sources: z.array(AiSourceSchema),
  insufficientContext: z.boolean(),
  disclaimer: z.string(),
});

export type AiSearchAnswer = z.infer<typeof AiSearchAnswerSchema>;

export const AiDocumentExtractionSchema = z.object({
  documentType: z.enum(["appointment_card", "care_instructions", "discharge_summary", "medication_label", "other"]),
  summary: z.string(),
  extractedText: z.string(),
  scheduleProposal: AiScheduleProposalSchema.nullable(),
  instructions: z.array(z.string()),
  warnings: z.array(z.string()),
  disclaimer: z.string(),
});

export type AiDocumentExtraction = z.infer<typeof AiDocumentExtractionSchema>;

export const AiRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("daily-brief"), householdId: z.uuid(), date: dateSchema, refresh: z.boolean().optional() }),
  z.object({ action: z.literal("conversation"), householdId: z.uuid(), messages: z.array(AiChatMessageSchema).min(1).max(12) }),
  z.object({ action: z.literal("capture-schedule"), householdId: z.uuid(), text: z.string().trim().min(3).max(4000), today: dateSchema, timeZone: z.string().min(1).max(100) }),
  z.object({ action: z.literal("handoff"), householdId: z.uuid(), recipientId: z.uuid().nullable() }),
  z.object({ action: z.literal("search"), householdId: z.uuid(), query: z.string().trim().min(2).max(1000) }),
  z.object({ action: z.literal("document-extract"), householdId: z.uuid(), recipientId: z.uuid().nullable(), fileName: z.string().max(240), mediaType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]), base64: z.string().min(1).max(14_000_000) }),
]);

export type AiRequest = z.infer<typeof AiRequestSchema>;

const AiSuccessResponseSchema = z.discriminatedUnion("action", [
  z.object({ ok: z.literal(true), action: z.literal("daily-brief"), data: AiDailyBriefSchema }),
  z.object({ ok: z.literal(true), action: z.literal("conversation"), data: AiConversationAnswerSchema }),
  z.object({ ok: z.literal(true), action: z.literal("capture-schedule"), data: AiScheduleProposalSchema }),
  z.object({ ok: z.literal(true), action: z.literal("handoff"), data: AiHandoffSchema }),
  z.object({ ok: z.literal(true), action: z.literal("search"), data: AiSearchAnswerSchema }),
  z.object({ ok: z.literal(true), action: z.literal("document-extract"), data: AiDocumentExtractionSchema }),
]);

export const AiResponseSchema = z.union([
  AiSuccessResponseSchema,
  z.object({ ok: z.literal(false), action: z.enum(["daily-brief", "conversation", "capture-schedule", "handoff", "search", "document-extract"]), message: z.string() }),
]);

export type AiResponse = z.infer<typeof AiResponseSchema>;
