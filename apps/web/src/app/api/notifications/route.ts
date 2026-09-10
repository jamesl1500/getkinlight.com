import {
  ActivityTypeSchema,
  MarkNotificationsReadRequestSchema,
  MarkNotificationsReadResponseSchema,
  NotificationListResponseSchema,
  createKinlightServerClient,
} from "@getkinlight.com/shared";
import { NextResponse } from "next/server";

type ActivityRow = {
  id: string;
  household_id: string;
  actor_user_id: string | null;
  activity_type: string;
  title: string;
  body: string;
  resource_type: string | null;
  resource_id: string | null;
  href: string | null;
  created_at: string;
};

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : null;
}

async function authenticatedClient(request: Request) {
  const accessToken = bearerToken(request);
  if (!accessToken) return null;
  const client = createKinlightServerClient(accessToken);
  const { data, error } = await client.auth.getUser(accessToken);
  return error || !data.user ? null : { client, user: data.user };
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function GET(request: Request) {
  const authenticated = await authenticatedClient(request);
  if (!authenticated) return errorResponse("Your session has expired.", 401);

  const [activityResult, readsResult] = await Promise.all([
    authenticated.client
      .from("household_activity")
      .select(
        "id, household_id, actor_user_id, activity_type, title, body, resource_type, resource_id, href, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(40),
    authenticated.client
      .from("notification_reads")
      .select("activity_id, read_at"),
  ]);

  if (activityResult.error || readsResult.error) {
    return errorResponse("Unable to load notifications.", 400);
  }

  try {
    const readTimes = new Map(
      (readsResult.data ?? []).map((read) => [read.activity_id, read.read_at]),
    );
    const activities = ((activityResult.data ?? []) as ActivityRow[]).map(
      (row) => ({
        id: row.id,
        householdId: row.household_id,
        actorUserId: row.actor_user_id,
        activityType: ActivityTypeSchema.parse(row.activity_type),
        title: row.title,
        body: row.body,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        href: row.href,
        createdAt: row.created_at,
        readAt:
          readTimes.get(row.id) ??
          (row.actor_user_id === authenticated.user.id ? row.created_at : null),
      }),
    );

    return NextResponse.json(
      NotificationListResponseSchema.parse({
        ok: true,
        activities,
        unreadCount: activities.filter((activity) => !activity.readAt).length,
        message: null,
      }),
    );
  } catch {
    return errorResponse(
      "Notification data was not in the expected format.",
      500,
    );
  }
}

export async function PATCH(request: Request) {
  const authenticated = await authenticatedClient(request);
  if (!authenticated) return errorResponse("Your session has expired.", 401);

  const input = MarkNotificationsReadRequestSchema.safeParse(
    await request.json(),
  );
  if (!input.success)
    return errorResponse("Invalid notification request.", 400);

  let activityIds: string[];
  if (input.data.action === "mark-read") {
    activityIds = [input.data.activityId];
  } else {
    const { data, error } = await authenticated.client
      .from("household_activity")
      .select("id");
    if (error) return errorResponse("Unable to mark notifications read.", 400);
    activityIds = (data ?? []).map((activity) => activity.id);
  }

  if (activityIds.length) {
    const readAt = new Date().toISOString();
    const { error } = await authenticated.client
      .from("notification_reads")
      .upsert(
        activityIds.map((activityId) => ({
          activity_id: activityId,
          user_id: authenticated.user.id,
          read_at: readAt,
        })),
        { onConflict: "activity_id,user_id" },
      );
    if (error) return errorResponse("Unable to mark notifications read.", 400);
  }

  return NextResponse.json(
    MarkNotificationsReadResponseSchema.parse({
      ok: true,
      message:
        input.data.action === "mark-all-read"
          ? "All notifications marked read."
          : "Notification marked read.",
    }),
  );
}
