import {
  AiConversationAnswerSchema,
  AiDailyBriefSchema,
  AiDocumentExtractionSchema,
  AiHandoffSchema,
  AiRequestSchema,
  AiResponseSchema,
  AiScheduleProposalSchema,
  AiSearchAnswerSchema,
  createKinlightServerClient,
  type AiRequest,
} from "@getkinlight.com/shared";
import { generateStructured, extractDocument } from "@/lib/ai/anthropic";
import { getHouseholdAiContext } from "@/lib/ai/household-context";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SAFETY = `You are Kinlight's family care assistant. Use only the supplied household records. Never diagnose, prescribe, alter medication instructions, or claim medical certainty. Describe patterns as observations. If records indicate immediate danger, advise contacting local emergency services or a qualified professional. Do not invent facts or source IDs. Keep sensitive details concise. Every recommendation is a draft for family review.`;

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : null;
}

function contextPrompt(
  context: Awaited<ReturnType<typeof getHouseholdAiContext>>,
) {
  return JSON.stringify(context);
}

function response(action: AiRequest["action"], data: unknown) {
  return NextResponse.json(AiResponseSchema.parse({ ok: true, action, data }));
}

export async function POST(request: Request) {
  let action: AiRequest["action"] = "search";

  try {
    const input = AiRequestSchema.parse(await request.json());
    action = input.action;
    const accessToken = bearerToken(request);
    if (!accessToken) {
      return NextResponse.json(
        { ok: false, action, message: "Your session has expired." },
        { status: 401 },
      );
    }

    const supabase = createKinlightServerClient(accessToken);
    const { data: userData, error: userError } =
      await supabase.auth.getUser(accessToken);
    if (userError || !userData.user) {
      return NextResponse.json(
        { ok: false, action, message: "Your session has expired." },
        { status: 401 },
      );
    }

    const context = await getHouseholdAiContext(supabase, input.householdId);
    const records = contextPrompt(context);

    if (input.action === "daily-brief") {
      if (!input.refresh) {
        const { data: cachedBrief, error: cachedBriefError } = await supabase
          .from("ai_daily_briefs")
          .select("content")
          .eq("household_id", input.householdId)
          .eq("brief_date", input.date)
          .maybeSingle();

        if (cachedBriefError) throw cachedBriefError;
        if (cachedBrief)
          return response(
            input.action,
            AiDailyBriefSchema.parse(cachedBrief.content),
          );
      }

      const data = await generateStructured(
        AiDailyBriefSchema,
        SAFETY,
        `Create a brief for ${input.date}. Prioritize today's schedule, meaningful changes, repeated missed or concerning patterns, and practical follow-ups. Source IDs must use a record id exactly as provided. Use the disclaimer "AI-generated summary. Verify important details in the source records."\n\nHOUSEHOLD RECORDS:\n${records}`,
      );

      const { error: cacheError } = await supabase
        .from("ai_daily_briefs")
        .upsert(
          {
            household_id: input.householdId,
            brief_date: input.date,
            content: data,
            model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
            generated_by: userData.user.id,
            generated_at: new Date().toISOString(),
          },
          { onConflict: "household_id,brief_date" },
        );

      if (cacheError) throw cacheError;
      return response(input.action, data);
    }

    if (input.action === "conversation") {
      const data = await generateStructured(
        AiConversationAnswerSchema,
        SAFETY,
        `Continue this family-care conversation using only the supplied household records. Be direct and warm. When the user asks to create or change a record, explain the draft and direct them to the matching Kinlight tool rather than claiming it was saved. Source IDs must use record ids exactly as provided. Provide up to three short follow-up prompts. Use the disclaimer "AI-generated answer based on Kinlight records; verify important details."\n\nCONVERSATION:\n${JSON.stringify(input.messages)}\n\nHOUSEHOLD RECORDS:\n${records}`,
      );
      return response(input.action, data);
    }

    if (input.action === "capture-schedule") {
      const data = await generateStructured(
        AiScheduleProposalSchema,
        SAFETY,
        `Extract one schedule proposal from the user's words. Today is ${input.today}; timezone is ${input.timeZone}. householdId must be ${input.householdId}. Match a recipient only when clearly named; otherwise recipientId must be null. Put ambiguities in needsReview. Never infer or change a medication dosage beyond the user's exact words.\n\nUSER WORDS:\n${input.text}\n\nHOUSEHOLD RECIPIENTS:\n${JSON.stringify(context.recipients)}`,
      );
      const recipientIds = new Set(
        context.recipients.map((recipient) => recipient.id),
      );
      const safeData = {
        ...data,
        householdId: input.householdId,
        recipientId:
          data.recipientId && recipientIds.has(data.recipientId)
            ? data.recipientId
            : null,
      };
      return response(input.action, safeData);
    }

    if (input.action === "handoff") {
      const data = await generateStructured(
        AiHandoffSchema,
        SAFETY,
        `Create a concise caregiver handoff${input.recipientId ? ` for recipient ${input.recipientId}` : " for the household"}. Separate recorded medication reminders from clinical advice. Source IDs must use record ids exactly as provided. Use the disclaimer "AI-generated handoff. Verify medications and urgent details with the source records."\n\nHOUSEHOLD RECORDS:\n${records}`,
      );
      return response(input.action, data);
    }

    if (input.action === "search") {
      const data = await generateStructured(
        AiSearchAnswerSchema,
        SAFETY,
        `Answer the question using only these records. If the answer is absent, set insufficientContext true and say what is missing. Source IDs must use record ids exactly as provided. Use the disclaimer "AI-generated answer based on Kinlight records; verify important details."\n\nQUESTION:\n${input.query}\n\nHOUSEHOLD RECORDS:\n${records}`,
      );
      return response(input.action, data);
    }

    const recipientIds = new Set(
      context.recipients.map((recipient) => recipient.id),
    );
    const data = await extractDocument(AiDocumentExtractionSchema, SAFETY, {
      mediaType: input.mediaType,
      base64: input.base64,
      prompt: `Extract family-care information from ${input.fileName}. Do not interpret diagnostic imagery. Preserve medication wording exactly. If a clear date/time exists, propose one schedule item with householdId ${input.householdId} and recipientId ${input.recipientId ?? "null"}; otherwise scheduleProposal must be null. Use the disclaimer "AI-extracted draft. Compare every detail with the original document before saving." Household recipients: ${JSON.stringify(context.recipients)}`,
    });
    const safeData = data.scheduleProposal
      ? {
          ...data,
          scheduleProposal: {
            ...data.scheduleProposal,
            householdId: input.householdId,
            recipientId:
              data.scheduleProposal.recipientId &&
              recipientIds.has(data.scheduleProposal.recipientId)
                ? data.scheduleProposal.recipientId
                : input.recipientId,
          },
        }
      : data;
    return response(input.action, safeData);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Kinlight AI could not complete that request.";
    const status = message.includes("configured")
      ? 503
      : message.includes("row") || message.includes("permission")
        ? 403
        : 400;
    return NextResponse.json(
      AiResponseSchema.parse({ ok: false, action, message }),
      { status },
    );
  }
}
