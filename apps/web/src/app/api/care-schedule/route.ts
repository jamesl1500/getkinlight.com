import {
  CareScheduleRangeQuerySchema,
  CareScheduleRangeResponseSchema,
  CreateCareScheduleRequestSchema,
  CreateCareScheduleResponseSchema,
  UpdateFamilyEventRequestSchema,
  UpdateFamilyEventResponseSchema,
  createKinlightServerClient,
} from "@getkinlight.com/shared";
import { getCareScheduleForRange } from "@/lib/care-schedule";
import { NextResponse } from "next/server";

const DAY_MS = 86_400_000;

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : null;
}

function utcDateTime(date: string, time: string) {
  return `${date}T${time}:00.000Z`;
}

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}

export async function GET(request: Request) {
  const accessToken = bearerToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, message: "Your session has expired." },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const query = CareScheduleRangeQuerySchema.safeParse({
    start: url.searchParams.get("start"),
    end: url.searchParams.get("end"),
  });
  const start = query.success ? parseDate(query.data.start) : null;
  const end = query.success ? parseDate(query.data.end) : null;
  const rangeDays =
    start && end ? (end.getTime() - start.getTime()) / DAY_MS : 0;
  if (!query.success || !start || !end || rangeDays < 1 || rangeDays > 42) {
    return NextResponse.json(
      {
        ok: false,
        message: "Choose a valid calendar range of 1 to 42 days.",
      },
      { status: 400 },
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

  try {
    const [items, householdsResult, recipientsResult] = await Promise.all([
      getCareScheduleForRange(start, end, supabase),
      supabase.from("households").select("id, name").order("name"),
      supabase
        .from("care_recipients")
        .select("id, household_id, first_name, preferred_name")
        .eq("is_active", true)
        .order("first_name"),
    ]);
    if (householdsResult.error || recipientsResult.error) {
      throw householdsResult.error ?? recipientsResult.error;
    }

    return NextResponse.json(
      CareScheduleRangeResponseSchema.parse({
        ok: true,
        message: "Care calendar loaded.",
        start: query.data.start,
        end: query.data.end,
        items,
        households: (householdsResult.data ?? []).map((household) => ({
          id: household.id,
          name: household.name,
        })),
        recipients: (recipientsResult.data ?? []).map((recipient) => ({
          id: recipient.id,
          householdId: recipient.household_id,
          name: recipient.preferred_name ?? recipient.first_name,
        })),
      }),
    );
  } catch {
    return NextResponse.json(
      { ok: false, message: "Unable to load the care calendar." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const accessToken = bearerToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, message: "Your session has expired.", item: null },
      { status: 401 },
    );
  }

  const body = CreateCareScheduleRequestSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json(
      {
        ok: false,
        message:
          body.error.issues[0]?.message ?? "Review the schedule details.",
        item: null,
      },
      { status: 400 },
    );
  }

  const supabase = createKinlightServerClient(accessToken);
  const { data: userData, error: userError } =
    await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return NextResponse.json(
      { ok: false, message: "Your session has expired.", item: null },
      { status: 401 },
    );
  }

  const input = body.data;
  const common = {
    household_id: input.householdId,
    care_recipient_id: input.recipientId ?? null,
    created_by: userData.user.id,
  };

  let result;
  if (input.type === "event") {
    result = await supabase
      .from("household_events")
      .insert({
        ...common,
        title: input.title,
        description: input.notes || null,
        location: input.location || null,
        starts_at: utcDateTime(input.date, input.time),
        is_all_day: input.isAllDay,
      })
      .select("id")
      .single();
  } else if (input.type === "appointment") {
    result = await supabase
      .from("appointments")
      .insert({
        ...common,
        title: input.title,
        provider_name: input.providerName || null,
        location: input.location || null,
        preparation_notes: input.notes || null,
        starts_at: utcDateTime(input.date, input.time),
      })
      .select("id")
      .single();
  } else if (input.type === "medication") {
    result = await supabase
      .from("medication_reminders")
      .insert({
        ...common,
        medication_name: input.title,
        dosage: input.dosage || null,
        instructions: input.notes || null,
        starts_on: input.date,
        ends_on: input.date,
        reminder_times: [input.time],
        days_of_week: [],
      })
      .select("id")
      .single();
  } else {
    result = await supabase
      .from("eating_reminders")
      .insert({
        ...common,
        title: input.title,
        meal_type: input.mealType,
        instructions: input.notes || null,
        starts_on: input.date,
        ends_on: input.date,
        reminder_times: [input.time],
        days_of_week: [],
      })
      .select("id")
      .single();
  }

  if (result.error) {
    const status = result.error.code === "42501" ? 403 : 400;
    return NextResponse.json(
      {
        ok: false,
        message:
          status === 403
            ? "You cannot add items to this household."
            : result.error.message,
        item: null,
      },
      { status },
    );
  }

  const { data: recipient } = input.recipientId
    ? await supabase
        .from("care_recipients")
        .select("first_name, preferred_name")
        .eq("id", input.recipientId)
        .maybeSingle()
    : { data: null };
  const detail =
    input.type === "appointment"
      ? input.providerName || input.location || null
      : input.type === "event"
        ? input.location || null
        : input.type === "medication"
          ? input.dosage || null
          : input.mealType;
  const item = {
    id:
      input.type === "medication" || input.type === "meal"
        ? `${input.type}-${result.data.id}-${input.date}-${input.time}`
        : `${input.type}-${result.data.id}`,
    sourceId: result.data.id,
    householdId: input.householdId,
    recipientId: input.recipientId ?? null,
    kind: input.type,
    title: input.title,
    detail,
    recipientName: recipient
      ? (recipient.preferred_name ?? recipient.first_name)
      : null,
    startsAt: utcDateTime(input.date, input.time),
    isAllDay: input.type === "event" && input.isAllDay,
    details: [
      {
        label: "Care recipient",
        value: recipient
          ? (recipient.preferred_name ?? recipient.first_name)
          : "Household-wide",
      },
      ...(input.type === "appointment" && input.providerName
        ? [{ label: "Provider", value: input.providerName }]
        : []),
      ...((input.type === "appointment" || input.type === "event") &&
      input.location
        ? [{ label: "Location", value: input.location }]
        : []),
      ...(input.type === "medication" && input.dosage
        ? [{ label: "Dosage", value: input.dosage }]
        : []),
      ...(input.type === "meal"
        ? [{ label: "Reminder kind", value: input.mealType }]
        : []),
      ...(input.notes
        ? [
            {
              label:
                input.type === "appointment"
                  ? "Preparation notes"
                  : input.type === "event"
                    ? "Description"
                    : "Instructions",
              value: input.notes,
            },
          ]
        : []),
    ],
  };

  return NextResponse.json(
    CreateCareScheduleResponseSchema.parse({
      ok: true,
      message: "Added to the care calendar.",
      item,
    }),
  );
}

export async function PATCH(request: Request) {
  const accessToken = bearerToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, message: "Your session has expired.", item: null },
      { status: 401 },
    );
  }

  const body = UpdateFamilyEventRequestSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json(
      {
        ok: false,
        message: body.error.issues[0]?.message ?? "Review the event details.",
        item: null,
      },
      { status: 400 },
    );
  }

  const supabase = createKinlightServerClient(accessToken);
  const { data: userData, error: userError } =
    await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return NextResponse.json(
      { ok: false, message: "Your session has expired.", item: null },
      { status: 401 },
    );
  }

  const input = body.data;
  const { data: event, error } = await supabase
    .from("household_events")
    .update({
      care_recipient_id: input.recipientId ?? null,
      title: input.title,
      description: input.notes || null,
      location: input.location || null,
      starts_at: utcDateTime(input.date, input.time),
      is_all_day: input.isAllDay,
    })
    .eq("id", input.eventId)
    .eq("household_id", input.householdId)
    .select("id")
    .single();

  if (error || !event) {
    const status =
      error?.code === "42501" || error?.code === "PGRST116" ? 403 : 400;
    return NextResponse.json(
      {
        ok: false,
        message:
          status === 403
            ? "You cannot edit this family event."
            : (error?.message ?? "Unable to update this event."),
        item: null,
      },
      { status },
    );
  }

  const [householdResult, recipientResult] = await Promise.all([
    supabase
      .from("households")
      .select("name")
      .eq("id", input.householdId)
      .single(),
    input.recipientId
      ? supabase
          .from("care_recipients")
          .select("first_name, preferred_name")
          .eq("id", input.recipientId)
          .single()
      : Promise.resolve({ data: null }),
  ]);
  const recipient = recipientResult.data;
  const recipientName = recipient
    ? (recipient.preferred_name ?? recipient.first_name)
    : null;
  const item = {
    id: `event-${event.id}`,
    sourceId: event.id,
    householdId: input.householdId,
    recipientId: input.recipientId ?? null,
    kind: "event" as const,
    title: input.title,
    detail: input.location || null,
    recipientName,
    startsAt: utcDateTime(input.date, input.time),
    isAllDay: input.isAllDay,
    details: [
      ...(householdResult.data?.name
        ? [{ label: "Household", value: householdResult.data.name }]
        : []),
      { label: "Care recipient", value: recipientName ?? "Household-wide" },
      ...(input.location ? [{ label: "Location", value: input.location }] : []),
      ...(input.notes ? [{ label: "Description", value: input.notes }] : []),
    ],
  };

  return NextResponse.json(
    UpdateFamilyEventResponseSchema.parse({
      ok: true,
      message: "Family event updated.",
      item,
    }),
  );
}
