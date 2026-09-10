import { ScheduleTaskAssignmentSchema, type ScheduleTaskAssignment } from "@getkinlight.com/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

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

function displayName(profile: ProfileRow | undefined) {
  if (!profile) return null;
  return (
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    profile.username ||
    null
  );
}

export async function getScheduleAssignments(
  householdIds: string[],
  client: SupabaseClient,
): Promise<ScheduleTaskAssignment[]> {
  if (householdIds.length === 0) return [];

  const { data, error } = await client
    .from("schedule_task_assignments")
    .select("id, household_id, resource_type, resource_id, assigned_to, claimed_at")
    .in("household_id", householdIds);
  if (error) throw error;

  const rows = (data ?? []) as AssignmentRow[];
  const assignedUserIds = Array.from(
    new Set(rows.flatMap((row) => (row.assigned_to ? [row.assigned_to] : []))),
  );
  const { data: profiles } = assignedUserIds.length
    ? await client
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

  return rows.map((row) =>
    ScheduleTaskAssignmentSchema.parse({
      id: row.id,
      householdId: row.household_id,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      assignedTo: row.assigned_to,
      assignedToName: row.assigned_to
        ? displayName(profilesByUserId.get(row.assigned_to))
        : null,
      claimedAt: row.claimed_at,
    }),
  );
}

export type AssignableHouseholdMember = { userId: string; displayName: string };

type HouseholdMemberRow = {
  household_id: string;
  role: "owner" | "caregiver" | "member";
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

/** Only owners and caregivers may assign schedule tasks to other members. */
export async function getAssignableMembersByHousehold(
  households: Array<{ id: string }>,
  currentUserId: string,
  client: SupabaseClient,
): Promise<{
  canAssignByHousehold: Record<string, boolean>;
  membersByHousehold: Record<string, AssignableHouseholdMember[]>;
}> {
  if (households.length === 0) {
    return { canAssignByHousehold: {}, membersByHousehold: {} };
  }

  const { data: membershipRows, error: membershipError } = await client
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", currentUserId)
    .in(
      "household_id",
      households.map((household) => household.id),
    );
  if (membershipError) throw membershipError;

  const canAssignByHousehold = Object.fromEntries(
    ((membershipRows ?? []) as HouseholdMemberRow[]).map((row) => [
      row.household_id,
      row.role === "owner" || row.role === "caregiver",
    ]),
  );

  const directories = await Promise.all(
    households.map((household) =>
      canAssignByHousehold[household.id]
        ? client.rpc("get_household_member_directory", {
            target_household_id: household.id,
          })
        : Promise.resolve({ data: [] as DirectoryRow[], error: null }),
    ),
  );

  const membersByHousehold = Object.fromEntries(
    households.map((household, index) => [
      household.id,
      ((directories[index].data ?? []) as DirectoryRow[]).map((member) => ({
        userId: member.user_id,
        displayName: directoryName(member),
      })),
    ]),
  );

  return { canAssignByHousehold, membersByHousehold };
}
