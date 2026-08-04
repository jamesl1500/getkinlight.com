import { getCareWorkspaceData } from "@/lib/care";
import {
  CareMutationRequestSchema,
  CareMutationResponseSchema,
  CareWorkspaceResponseSchema,
  createKinlightServerClient,
} from "@getkinlight.com/shared";
import { NextResponse } from "next/server";

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : null;
}

function response(message: string, status: number, id: string | null = null) {
  return NextResponse.json(
    CareMutationResponseSchema.parse({ ok: status < 400, message, id }),
    { status },
  );
}

export async function GET(request: Request) {
  const accessToken = bearerToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, message: "Your session has expired." },
      { status: 401 },
    );
  }

  const supabase = createKinlightServerClient(accessToken);
  const { data: userData, error: userError } =
    await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return NextResponse.json(
      { ok: false, message: "Your session has expired." },
      { status: 401 },
    );
  }

  const recipientId =
    new URL(request.url).searchParams.get("recipient") ?? undefined;
  try {
    const workspace = await getCareWorkspaceData(recipientId, supabase);
    return NextResponse.json(
      CareWorkspaceResponseSchema.parse({
        ok: true,
        message: "Care workspace loaded.",
        ...workspace,
      }),
    );
  } catch {
    return NextResponse.json(
      { ok: false, message: "Unable to load the care workspace." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const accessToken = bearerToken(request);
  if (!accessToken) return response("Your session has expired.", 401);

  const body = CareMutationRequestSchema.safeParse(await request.json());
  if (!body.success)
    return response(
      body.error.issues[0]?.message ?? "Review the care details.",
      400,
    );

  const supabase = createKinlightServerClient(accessToken);
  const { data: userData, error: userError } =
    await supabase.auth.getUser(accessToken);
  if (userError || !userData.user)
    return response("Your session has expired.", 401);

  const input = body.data;
  let result: {
    data: { id: string } | null;
    error: { code?: string; message: string } | null;
  };

  if (input.action === "create-recipient") {
    result = await supabase
      .from("care_recipients")
      .insert({
        household_id: input.householdId,
        first_name: input.firstName,
        last_name: input.lastName,
        preferred_name: input.preferredName || null,
        date_of_birth: input.dateOfBirth || null,
        relationship: input.relationship || null,
        care_preferences: input.carePreferences || null,
        created_by: userData.user.id,
      })
      .select("id")
      .single();
  } else if (input.action === "update-recipient") {
    result = await supabase
      .from("care_recipients")
      .update({
        first_name: input.firstName,
        last_name: input.lastName,
        preferred_name: input.preferredName || null,
        date_of_birth: input.dateOfBirth || null,
        relationship: input.relationship || null,
        care_preferences: input.carePreferences || null,
        is_active: input.isActive,
      })
      .eq("id", input.recipientId)
      .eq("household_id", input.householdId)
      .select("id")
      .single();
  } else if (input.action === "create-check-in") {
    result = await supabase
      .from("household_check_ins")
      .insert({
        household_id: input.householdId,
        care_recipient_id: input.recipientId,
        status: input.status,
        mood: input.mood ?? null,
        summary: input.summary || null,
        created_by: userData.user.id,
      })
      .select("id")
      .single();
  } else if (input.action === "create-note") {
    result = await supabase
      .from("household_notes")
      .insert({
        household_id: input.householdId,
        care_recipient_id: input.recipientId,
        title: input.title || null,
        body: input.body,
        is_pinned: input.isPinned,
        created_by: userData.user.id,
      })
      .select("id")
      .single();
  } else if (input.action === "create-medication") {
    result = await supabase
      .from("medication_reminders")
      .insert({
        household_id: input.householdId,
        care_recipient_id: input.recipientId,
        medication_name: input.medicationName,
        dosage: input.dosage || null,
        instructions: input.instructions || null,
        starts_on: input.startsOn,
        ends_on: input.endsOn || null,
        reminder_times: input.reminderTimes,
        days_of_week: input.daysOfWeek,
        created_by: userData.user.id,
      })
      .select("id")
      .single();
  } else {
    result = await supabase
      .from("medication_reminders")
      .update({
        care_recipient_id: input.recipientId,
        medication_name: input.medicationName,
        dosage: input.dosage || null,
        instructions: input.instructions || null,
        starts_on: input.startsOn,
        ends_on: input.endsOn || null,
        reminder_times: input.reminderTimes,
        days_of_week: input.daysOfWeek,
        is_active: input.isActive,
      })
      .eq("id", input.medicationId)
      .eq("household_id", input.householdId)
      .select("id")
      .single();
  }

  if (result.error || !result.data) {
    const forbidden =
      result.error?.code === "42501" || result.error?.code === "PGRST116";
    return response(
      forbidden
        ? "You cannot change care records in this household."
        : (result.error?.message ?? "Unable to save this care record."),
      forbidden ? 403 : 400,
    );
  }

  const messages = {
    "create-recipient": "Care recipient added.",
    "update-recipient": "Care recipient updated.",
    "create-check-in": "Check-in recorded.",
    "create-note": "Care note added.",
    "create-medication": "Medication reminder added.",
    "update-medication": "Medication reminder updated.",
  } as const;

  return response(messages[input.action], 200, result.data.id);
}
