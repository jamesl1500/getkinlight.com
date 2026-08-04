import { getCareScheduleForDate } from "@/lib/care-schedule";
import {
  DashboardResponseSchema,
  createKinlightServerClient,
  type CareScheduleItem,
} from "@getkinlight.com/shared";
import { NextResponse } from "next/server";

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : null;
}

function requestedDate(request: Request) {
  const value = new URL(request.url).searchParams.get("date");
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00.000Z`)
    : new Date();
}

function recipientName(
  relation:
    | { first_name: string; preferred_name: string | null }
    | Array<{ first_name: string; preferred_name: string | null }>
    | null,
) {
  const recipient = Array.isArray(relation) ? relation[0] : relation;
  return recipient ? (recipient.preferred_name ?? recipient.first_name) : null;
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

  const [profileResult, householdResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name, username, role")
      .eq("user_id", userData.user.id)
      .maybeSingle(),
    supabase
      .from("households")
      .select("id, name")
      .order("name")
      .limit(1)
      .maybeSingle(),
  ]);
  const initialError = profileResult.error ?? householdResult.error;
  if (initialError) {
    return NextResponse.json(
      { ok: false, message: initialError.message },
      { status: 400 },
    );
  }

  const household = householdResult.data;
  let memberRole: "owner" | "member" | "caregiver" = "member";
  let schedule: CareScheduleItem[] = [];
  let recentUpdates: Array<{
    id: string;
    kind: "mood" | "note";
    summary: string;
    occurredAt: string;
    recipientName: string | null;
    authorName: null;
  }> = [];

  if (household) {
    const [membershipResult, checkInsResult, notesResult, scheduleResult] =
      await Promise.all([
        supabase
          .from("household_members")
          .select("role")
          .eq("household_id", household.id)
          .eq("user_id", userData.user.id)
          .maybeSingle(),
        supabase
          .from("household_check_ins")
          .select(
            "id, status, summary, occurred_at, care_recipients(first_name, preferred_name)",
          )
          .eq("household_id", household.id)
          .order("occurred_at", { ascending: false })
          .limit(5),
        supabase
          .from("household_notes")
          .select(
            "id, title, body, created_at, care_recipients(first_name, preferred_name)",
          )
          .eq("household_id", household.id)
          .order("created_at", { ascending: false })
          .limit(5),
        getCareScheduleForDate(requestedDate(request), supabase),
      ]);
    const queryError =
      membershipResult.error ?? checkInsResult.error ?? notesResult.error;
    if (queryError) {
      return NextResponse.json(
        { ok: false, message: queryError.message },
        { status: 400 },
      );
    }

    memberRole = membershipResult.data?.role ?? "member";
    schedule = scheduleResult.filter(
      (item) => item.householdId === household.id,
    );
    recentUpdates = [
      ...(checkInsResult.data ?? []).map((item) => ({
        id: item.id,
        kind: "mood" as const,
        summary:
          item.summary ?? `Check-in: ${item.status.replaceAll("_", " ")}`,
        occurredAt: item.occurred_at,
        recipientName: recipientName(item.care_recipients),
        authorName: null,
      })),
      ...(notesResult.data ?? []).map((item) => ({
        id: item.id,
        kind: "note" as const,
        summary: item.title ?? item.body,
        occurredAt: item.created_at,
        recipientName: recipientName(item.care_recipients),
        authorName: null,
      })),
    ]
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, 5);
  }

  const profile = profileResult.data;
  return NextResponse.json(
    DashboardResponseSchema.parse({
      ok: true,
      message: "Dashboard loaded.",
      profile: {
        firstName: profile?.first_name ?? null,
        lastName: profile?.last_name ?? null,
        username: profile?.username ?? null,
        role: profile?.role ?? null,
      },
      household: household
        ? { id: household.id, name: household.name, role: memberRole }
        : null,
      schedule,
      recentUpdates,
    }),
  );
}
