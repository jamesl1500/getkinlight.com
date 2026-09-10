import { getCareScheduleForRange, type CareScheduleItem } from "@/lib/care-schedule";
import { createKinlightServerComponentClient } from "@/lib/supabase/server";
import type { ScheduleTaskAssignment } from "@getkinlight.com/shared";
import { getScheduleAssignments } from "@/lib/schedule-assignments";

const WINDOW_DAYS_BACK = 7;
const WINDOW_DAYS_FORWARD = 30;

export type TaskBoardMember = { userId: string; displayName: string };

export type TaskBoardItem = CareScheduleItem & {
  assignedTo: string | null;
  assignedToName: string | null;
};

export type TaskBoardData = {
  households: Array<{ id: string; name: string }>;
  selectedHousehold: { id: string; name: string } | null;
  currentUserId: string;
  canAssign: boolean;
  members: TaskBoardMember[];
  items: TaskBoardItem[];
};

type DirectoryRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  email: string | null;
};

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

export async function getTasksBoardData(
  requestedHouseholdId?: string,
): Promise<TaskBoardData> {
  const supabase = await createKinlightServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication is required.");

  const { data: householdRows, error: householdsError } = await supabase
    .from("households")
    .select("id, name")
    .order("name");
  if (householdsError) throw householdsError;

  const households = householdRows ?? [];
  const selectedHousehold =
    households.find((household) => household.id === requestedHouseholdId) ??
    households[0] ??
    null;

  if (!selectedHousehold) {
    return {
      households,
      selectedHousehold: null,
      currentUserId: user.id,
      canAssign: false,
      members: [],
      items: [],
    };
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
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.rpc("get_household_member_directory", {
        target_household_id: selectedHousehold.id,
      }),
    ]);
  if (directoryResult.error) throw directoryResult.error;

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

  return {
    households,
    selectedHousehold,
    currentUserId: user.id,
    canAssign,
    members,
    items,
  };
}
