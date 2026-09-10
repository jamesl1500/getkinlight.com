import {
  TaskBoardResponseSchema,
  createKinlightServerClient,
  type ScheduleTaskAssignment,
} from "@getkinlight.com/shared";
import { getCareScheduleForRange } from "@/lib/care-schedule";
import { getScheduleAssignments } from "@/lib/schedule-assignments";
import { NextResponse } from "next/server";

const WINDOW_DAYS_BACK = 7;
const WINDOW_DAYS_FORWARD = 30;

type DirectoryRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  email: string | null;
};

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : null;
}

function directoryName(member: DirectoryRow) {
  return (
    [member.first_name, member.last_name].filter(Boolean).join(" ") ||
    member.username ||
    member.email ||
    "Household member"
  );
}

function assignmentKey(kind: string, sourceId: string) {
  return `${kind}:${sourceId}`;
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

  const url = new URL(request.url);
  const requestedHouseholdId = url.searchParams.get("household") ?? undefined;

  const { data: householdRows, error: householdsError } = await supabase
    .from("households")
    .select("id, name")
    .order("name");
  if (householdsError) {
    return NextResponse.json(
      { ok: false, message: "Unable to load tasks." },
      { status: 400 },
    );
  }

  const households = householdRows ?? [];
  const selectedHousehold =
    households.find((household) => household.id === requestedHouseholdId) ??
    households[0] ??
    null;

  if (!selectedHousehold) {
    return NextResponse.json(
      TaskBoardResponseSchema.parse({
        ok: true,
        message: "Tasks loaded.",
        households,
        selectedHousehold: null,
        currentUserId: userData.user.id,
        canAssign: false,
        members: [],
        items: [],
      }),
    );
  }

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - WINDOW_DAYS_BACK);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + WINDOW_DAYS_BACK + WINDOW_DAYS_FORWARD);

  const [scheduleItems, assignments, membershipResult, directoryResult] =
    await Promise.all([
      getCareScheduleForRange(start, end, supabase),
      getScheduleAssignments([selectedHousehold.id], supabase),
      supabase
        .from("household_members")
        .select("role")
        .eq("household_id", selectedHousehold.id)
        .eq("user_id", userData.user.id)
        .maybeSingle(),
      supabase.rpc("get_household_member_directory", {
        target_household_id: selectedHousehold.id,
      }),
    ]);
  if (directoryResult.error) {
    return NextResponse.json(
      { ok: false, message: "Unable to load tasks." },
      { status: 400 },
    );
  }

  const canAssign =
    membershipResult.data?.role === "owner" ||
    membershipResult.data?.role === "caregiver";
  const members = ((directoryResult.data ?? []) as DirectoryRow[]).map(
    (member) => ({
      userId: member.user_id,
      displayName: directoryName(member),
    }),
  );

  const assignmentsByKey = new Map<string, ScheduleTaskAssignment>(
    assignments.map((assignment) => [
      assignmentKey(assignment.resourceType, assignment.resourceId),
      assignment,
    ]),
  );
  const items = scheduleItems
    .filter((item) => item.householdId === selectedHousehold.id)
    .map((item) => {
      const assignment = assignmentsByKey.get(
        assignmentKey(item.kind, item.sourceId),
      );
      return {
        ...item,
        assignedTo: assignment?.assignedTo ?? null,
        assignedToName: assignment?.assignedToName ?? null,
      };
    });

  return NextResponse.json(
    TaskBoardResponseSchema.parse({
      ok: true,
      message: "Tasks loaded.",
      households,
      selectedHousehold,
      currentUserId: userData.user.id,
      canAssign,
      members,
      items,
    }),
  );
}
