import { SupplyItemSchema, type SupplyItem } from "@getkinlight.com/shared";
import { createKinlightServerComponentClient } from "@/lib/supabase/server";

type SupplyRow = {
  id: string;
  household_id: string;
  care_recipient_id: string | null;
  name: string;
  quantity: string | null;
  category:
    | "medication"
    | "diapers"
    | "groceries"
    | "hygiene"
    | "general"
    | "other";
  is_checked: boolean;
  checked_by: string | null;
  checked_at: string | null;
  created_at: string;
  care_recipients:
    | { first_name: string; preferred_name: string | null }
    | { first_name: string; preferred_name: string | null }[]
    | null;
};

type ProfileRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
};

export type SupplyWorkspaceData = {
  households: Array<{ id: string; name: string }>;
  selectedHousehold: { id: string; name: string } | null;
  recipients: Array<{ id: string; householdId: string; name: string }>;
  items: SupplyItem[];
};

function recipientName(recipient: SupplyRow["care_recipients"]) {
  const person = Array.isArray(recipient) ? recipient[0] : recipient;
  return person ? (person.preferred_name ?? person.first_name) : null;
}

function displayName(profile: ProfileRow | undefined) {
  if (!profile) return null;
  return (
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    profile.username ||
    null
  );
}

export async function getSupplyWorkspaceData(
  requestedHouseholdId?: string,
): Promise<SupplyWorkspaceData> {
  const supabase = await createKinlightServerComponentClient();
  const [householdsResult, recipientsResult] = await Promise.all([
    supabase.from("households").select("id, name").order("name"),
    supabase
      .from("care_recipients")
      .select("id, household_id, first_name, preferred_name")
      .eq("is_active", true)
      .order("first_name"),
  ]);
  if (householdsResult.error) throw householdsResult.error;
  if (recipientsResult.error) throw recipientsResult.error;

  const households = householdsResult.data ?? [];
  const recipients = (recipientsResult.data ?? []).map((recipient) => ({
    id: recipient.id,
    householdId: recipient.household_id,
    name: recipient.preferred_name ?? recipient.first_name,
  }));
  const selectedHousehold =
    households.find((household) => household.id === requestedHouseholdId) ??
    households[0] ??
    null;

  if (!selectedHousehold) {
    return { households, selectedHousehold: null, recipients, items: [] };
  }

  const { data: itemRows, error: itemsError } = await supabase
    .from("household_supply_items")
    .select(
      "id, household_id, care_recipient_id, name, quantity, category, is_checked, checked_by, checked_at, created_at, care_recipients(first_name, preferred_name)",
    )
    .eq("household_id", selectedHousehold.id)
    .order("is_checked")
    .order("created_at", { ascending: false });
  if (itemsError) throw itemsError;

  const rows = (itemRows ?? []) as SupplyRow[];
  const checkedByIds = Array.from(
    new Set(rows.flatMap((row) => (row.checked_by ? [row.checked_by] : []))),
  );
  const { data: profiles } = checkedByIds.length
    ? await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, username")
        .in("user_id", checkedByIds)
    : { data: [] };
  const profilesByUserId = new Map(
    ((profiles ?? []) as ProfileRow[]).map((profile) => [
      profile.user_id,
      profile,
    ]),
  );

  const items = rows.map((row) =>
    SupplyItemSchema.parse({
      id: row.id,
      householdId: row.household_id,
      recipientId: row.care_recipient_id,
      recipientName: recipientName(row.care_recipients),
      name: row.name,
      quantity: row.quantity,
      category: row.category,
      isChecked: row.is_checked,
      checkedByName: row.checked_by
        ? displayName(profilesByUserId.get(row.checked_by))
        : null,
      checkedAt: row.checked_at,
      createdAt: row.created_at,
    }),
  );

  return { households, selectedHousehold, recipients, items };
}
