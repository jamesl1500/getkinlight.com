import type { CareRecipient } from "@/lib/care";
import { createKinlightServerComponentClient } from "@/lib/supabase/server";

export type HouseholdRole = "owner" | "member" | "caregiver";

export type FamilyMember = {
  id: string;
  userId: string;
  role: HouseholdRole;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  email: string | null;
  joinedAt: string;
};

export type FamilyInvitation = {
  id: string;
  email: string;
  role: "member" | "caregiver";
  token: string;
  expiresAt: string;
};

type HouseholdDirectoryRow = {
  member_id: string;
  user_id: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  email: string | null;
  joined_at: string;
};

export type FamilyWorkspaceData = {
  currentUserId: string;
  households: Array<{ id: string; name: string; createdAt: string }>;
  selectedHousehold: { id: string; name: string; createdAt: string } | null;
  members: FamilyMember[];
  invitations: FamilyInvitation[];
  recipients: CareRecipient[];
  currentUserRole: HouseholdRole | null;
};

export async function getFamilyWorkspaceData(
  requestedHouseholdId?: string,
): Promise<FamilyWorkspaceData> {
  const supabase = await createKinlightServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication is required.");
  }

  const householdsResult = await supabase
    .from("households")
    .select("id, name, created_at")
    .order("created_at");
  if (householdsResult.error) throw householdsResult.error;

  const households = (householdsResult.data ?? []).map((household) => ({
    id: household.id,
    name: household.name,
    createdAt: household.created_at,
  }));
  const selectedHousehold =
    households.find((household) => household.id === requestedHouseholdId) ??
    households[0] ??
    null;

  if (!selectedHousehold) {
    return {
      currentUserId: user.id,
      households,
      selectedHousehold: null,
      members: [],
      invitations: [],
      recipients: [],
      currentUserRole: null,
    };
  }

  const [membersResult, invitationsResult, recipientsResult] =
    await Promise.all([
      supabase.rpc("get_household_member_directory", {
        target_household_id: selectedHousehold.id,
      }),
      supabase
        .from("household_invitations")
        .select("id, invited_email, role, invite_token, expires_at")
        .eq("household_id", selectedHousehold.id)
        .is("accepted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("care_recipients")
        .select(
          "id, household_id, first_name, last_name, preferred_name, date_of_birth, relationship, care_preferences, is_active",
        )
        .eq("household_id", selectedHousehold.id)
        .order("is_active", { ascending: false })
        .order("first_name"),
    ]);
  const queryError =
    membersResult.error ?? invitationsResult.error ?? recipientsResult.error;
  if (queryError) throw queryError;

  const directory = (membersResult.data ?? []) as HouseholdDirectoryRow[];
  const members = directory.map((member) => ({
    id: member.member_id,
    userId: member.user_id,
    role: member.role as HouseholdRole,
    firstName: member.first_name,
    lastName: member.last_name,
    username: member.username,
    email: member.email,
    joinedAt: member.joined_at,
  }));

  return {
    currentUserId: user.id,
    households,
    selectedHousehold,
    members,
    invitations: (invitationsResult.data ?? []).map((invitation) => ({
      id: invitation.id,
      email: invitation.invited_email,
      role: invitation.role as FamilyInvitation["role"],
      token: invitation.invite_token,
      expiresAt: invitation.expires_at,
    })),
    recipients: (recipientsResult.data ?? []).map((recipient) => ({
      id: recipient.id,
      householdId: recipient.household_id,
      firstName: recipient.first_name,
      lastName: recipient.last_name,
      preferredName: recipient.preferred_name,
      dateOfBirth: recipient.date_of_birth,
      relationship: recipient.relationship,
      carePreferences: recipient.care_preferences,
      isActive: recipient.is_active,
    })),
    currentUserRole:
      members.find((member) => member.userId === user.id)?.role ?? null,
  };
}
