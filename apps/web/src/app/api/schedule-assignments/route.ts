import {
  ClaimScheduleTaskRequestSchema,
  ClaimScheduleTaskResponseSchema,
  ScheduleTaskAssignmentListResponseSchema,
  ScheduleTaskAssignmentSchema,
  createKinlightServerClient,
} from "@getkinlight.com/shared";
import { NextResponse } from "next/server";

type AssignmentRow = {
  id: string;
  household_id: string;
  resource_type: "event" | "appointment" | "medication" | "meal";
  resource_id: string;
  assigned_to: string | null;
  claimed_at: string | null;
};

type ProfileRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
};

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : null;
}

function displayName(profile: ProfileRow | undefined) {
  if (!profile) return null;
  return (
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    profile.username ||
    null
  );
}

async function toAssignment(
  row: AssignmentRow,
  profilesByUserId: Map<string, ProfileRow>,
) {
  return ScheduleTaskAssignmentSchema.parse({
    id: row.id,
    householdId: row.household_id,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    assignedTo: row.assigned_to,
    assignedToName: row.assigned_to
      ? displayName(profilesByUserId.get(row.assigned_to))
      : null,
    claimedAt: row.claimed_at,
  });
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
  const householdId = url.searchParams.get("household");

  const supabase = createKinlightServerClient(accessToken);
  const { data: userData, error: userError } =
    await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return NextResponse.json(
      { ok: false, message: "Your session has expired." },
      { status: 401 },
    );
  }

  let query = supabase
    .from("schedule_task_assignments")
    .select("id, household_id, resource_type, resource_id, assigned_to, claimed_at");
  if (householdId) query = query.eq("household_id", householdId);
  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { ok: false, message: "Unable to load task assignments." },
      { status: 400 },
    );
  }

  const rows = (data ?? []) as AssignmentRow[];
  const assignedUserIds = Array.from(
    new Set(rows.flatMap((row) => (row.assigned_to ? [row.assigned_to] : []))),
  );
  const { data: profiles } = assignedUserIds.length
    ? await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, username")
        .in("user_id", assignedUserIds)
    : { data: [] };
  const profilesByUserId = new Map(
    ((profiles ?? []) as ProfileRow[]).map((profile) => [
      profile.user_id,
      profile,
    ]),
  );

  return NextResponse.json(
    ScheduleTaskAssignmentListResponseSchema.parse({
      ok: true,
      message: "Task assignments loaded.",
      assignments: await Promise.all(
        rows.map((row) => toAssignment(row, profilesByUserId)),
      ),
    }),
  );
}

export async function POST(request: Request) {
  const accessToken = bearerToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, message: "Your session has expired.", assignment: null },
      { status: 401 },
    );
  }

  const body = ClaimScheduleTaskRequestSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json(
      {
        ok: false,
        message: body.error.issues[0]?.message ?? "Review this request.",
        assignment: null,
      },
      { status: 400 },
    );
  }

  const supabase = createKinlightServerClient(accessToken);
  const { data: userData, error: userError } =
    await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return NextResponse.json(
      { ok: false, message: "Your session has expired.", assignment: null },
      { status: 401 },
    );
  }

  const input = body.data;
  const userId = userData.user.id;

  if (input.action === "claim" || input.action === "assign") {
    if (input.action === "assign" && !input.assigneeId) {
      return NextResponse.json(
        {
          ok: false,
          message: "Choose someone to assign this task to.",
          assignment: null,
        },
        { status: 400 },
      );
    }

    const assignedTo =
      input.action === "assign" ? input.assigneeId! : userId;
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("schedule_task_assignments")
      .upsert(
        {
          household_id: input.householdId,
          resource_type: input.resourceType,
          resource_id: input.resourceId,
          assigned_to: assignedTo,
          claimed_at: now,
          created_by: userId,
        },
        { onConflict: "household_id,resource_type,resource_id" },
      )
      .select("id, household_id, resource_type, resource_id, assigned_to, claimed_at")
      .single();

    if (error) {
      const status = error.code === "42501" ? 403 : 409;
      return NextResponse.json(
        {
          ok: false,
          message:
            status === 403
              ? input.action === "assign"
                ? "You cannot assign tasks for this household."
                : "You cannot claim this task."
              : "This task is already claimed by someone else.",
          assignment: null,
        },
        { status },
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name, username")
      .eq("user_id", assignedTo)
      .maybeSingle();
    const assignment = await toAssignment(
      data as AssignmentRow,
      new Map(profile ? [[assignedTo, profile as ProfileRow]] : []),
    );

    return NextResponse.json(
      ClaimScheduleTaskResponseSchema.parse({
        ok: true,
        message:
          input.action === "assign"
            ? "You assigned this task."
            : "You claimed this task.",
        assignment,
      }),
    );
  }

  const { error } = await supabase
    .from("schedule_task_assignments")
    .update({ assigned_to: null, claimed_at: null })
    .eq("household_id", input.householdId)
    .eq("resource_type", input.resourceType)
    .eq("resource_id", input.resourceId);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "You cannot release someone else's claim.",
        assignment: null,
      },
      { status: 403 },
    );
  }

  return NextResponse.json(
    ClaimScheduleTaskResponseSchema.parse({
      ok: true,
      message: "You released this task.",
      assignment: null,
    }),
  );
}
