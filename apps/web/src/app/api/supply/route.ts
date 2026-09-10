import {
  CreateSupplyItemRequestSchema,
  DeleteSupplyItemRequestSchema,
  DeleteSupplyItemResponseSchema,
  SupplyItemResponseSchema,
  SupplyItemSchema,
  SupplyListResponseSchema,
  ToggleSupplyItemRequestSchema,
  createKinlightServerClient,
} from "@getkinlight.com/shared";
import { NextResponse } from "next/server";

type SupplyRow = {
  id: string;
  household_id: string;
  care_recipient_id: string | null;
  name: string;
  quantity: string | null;
  category: "medication" | "diapers" | "groceries" | "hygiene" | "general" | "other";
  is_checked: boolean;
  checked_by: string | null;
  checked_at: string | null;
  created_at: string;
  care_recipients: { first_name: string; preferred_name: string | null } | { first_name: string; preferred_name: string | null }[] | null;
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

function recipientName(
  recipient: SupplyRow["care_recipients"],
) {
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

function toItem(row: SupplyRow, profilesByUserId: Map<string, ProfileRow>) {
  return SupplyItemSchema.parse({
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

  const [householdsResult, recipientsResult] = await Promise.all([
    supabase.from("households").select("id, name").order("name"),
    supabase
      .from("care_recipients")
      .select("id, household_id, first_name, preferred_name")
      .eq("is_active", true)
      .order("first_name"),
  ]);
  if (householdsResult.error || recipientsResult.error) {
    return NextResponse.json(
      { ok: false, message: "Unable to load the supply list." },
      { status: 400 },
    );
  }

  const selectedHouseholdId =
    householdId ?? householdsResult.data?.[0]?.id ?? null;
  let items: SupplyRow[] = [];
  if (selectedHouseholdId) {
    const { data, error } = await supabase
      .from("household_supply_items")
      .select(
        "id, household_id, care_recipient_id, name, quantity, category, is_checked, checked_by, checked_at, created_at, care_recipients(first_name, preferred_name)",
      )
      .eq("household_id", selectedHouseholdId)
      .order("is_checked")
      .order("created_at", { ascending: false });
    if (error) {
      return NextResponse.json(
        { ok: false, message: "Unable to load the supply list." },
        { status: 400 },
      );
    }
    items = (data ?? []) as SupplyRow[];
  }

  const checkedByIds = Array.from(
    new Set(items.flatMap((item) => (item.checked_by ? [item.checked_by] : []))),
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

  return NextResponse.json(
    SupplyListResponseSchema.parse({
      ok: true,
      message: "Supply list loaded.",
      items: items.map((item) => toItem(item, profilesByUserId)),
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
}

export async function POST(request: Request) {
  const accessToken = bearerToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, message: "Your session has expired.", item: null },
      { status: 401 },
    );
  }

  const body = CreateSupplyItemRequestSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json(
      {
        ok: false,
        message: body.error.issues[0]?.message ?? "Review this supply item.",
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
  const { data, error } = await supabase
    .from("household_supply_items")
    .insert({
      household_id: input.householdId,
      care_recipient_id: input.recipientId ?? null,
      name: input.name,
      quantity: input.quantity || null,
      category: input.category,
      created_by: userData.user.id,
    })
    .select(
      "id, household_id, care_recipient_id, name, quantity, category, is_checked, checked_by, checked_at, created_at, care_recipients(first_name, preferred_name)",
    )
    .single();

  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json(
      {
        ok: false,
        message:
          status === 403
            ? "You cannot add items to this household."
            : error.message,
        item: null,
      },
      { status },
    );
  }

  return NextResponse.json(
    SupplyItemResponseSchema.parse({
      ok: true,
      message: "Supply item added.",
      item: toItem(data as SupplyRow, new Map()),
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

  const body = ToggleSupplyItemRequestSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json(
      {
        ok: false,
        message: body.error.issues[0]?.message ?? "Review this supply item.",
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
  const updates: Record<string, unknown> = {};
  if (input.isChecked !== undefined) {
    updates.is_checked = input.isChecked;
    updates.checked_by = input.isChecked ? userData.user.id : null;
    updates.checked_at = input.isChecked ? new Date().toISOString() : null;
  }
  if (input.name !== undefined) updates.name = input.name;
  if (input.quantity !== undefined) updates.quantity = input.quantity || null;
  if (input.category !== undefined) updates.category = input.category;

  const { data, error } = await supabase
    .from("household_supply_items")
    .update(updates)
    .eq("id", input.itemId)
    .eq("household_id", input.householdId)
    .select(
      "id, household_id, care_recipient_id, name, quantity, category, is_checked, checked_by, checked_at, created_at, care_recipients(first_name, preferred_name)",
    )
    .single();

  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json(
      {
        ok: false,
        message:
          status === 403
            ? "You cannot update this supply item."
            : "Unable to update this supply item.",
        item: null,
      },
      { status },
    );
  }

  const { data: profile } = input.isChecked
    ? await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, username")
        .eq("user_id", userData.user.id)
        .maybeSingle()
    : { data: null };

  return NextResponse.json(
    SupplyItemResponseSchema.parse({
      ok: true,
      message:
        input.isChecked !== undefined
          ? input.isChecked
            ? "Marked as picked up."
            : "Marked as needed."
          : "Supply item updated.",
      item: toItem(
        data as SupplyRow,
        new Map(profile ? [[userData.user.id, profile as ProfileRow]] : []),
      ),
    }),
  );
}

export async function DELETE(request: Request) {
  const accessToken = bearerToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, message: "Your session has expired." },
      { status: 401 },
    );
  }

  const body = DeleteSupplyItemRequestSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json(
      {
        ok: false,
        message: body.error.issues[0]?.message ?? "Review this supply item.",
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

  const input = body.data;
  const { error, count } = await supabase
    .from("household_supply_items")
    .delete({ count: "exact" })
    .eq("id", input.itemId)
    .eq("household_id", input.householdId);

  if (error) {
    return NextResponse.json(
      { ok: false, message: "You cannot remove this supply item." },
      { status: 403 },
    );
  }
  if (!count) {
    return NextResponse.json(
      { ok: false, message: "You cannot remove this supply item." },
      { status: 403 },
    );
  }

  return NextResponse.json(
    DeleteSupplyItemResponseSchema.parse({
      ok: true,
      message: "Supply item removed.",
    }),
  );
}
