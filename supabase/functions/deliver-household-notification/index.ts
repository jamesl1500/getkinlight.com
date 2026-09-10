import { createClient } from "npm:@supabase/supabase-js@2";

type Activity = {
  id: string;
  household_id: string;
  actor_user_id: string | null;
  activity_type: string;
  title: string;
  body: string;
  href: string | null;
};

type WebhookPayload = {
  type: "INSERT";
  table: "household_activity";
  schema: "public";
  record: Activity;
};

type Device = {
  expo_push_token: string;
  care_updates_enabled: boolean;
  schedule_reminders_enabled: boolean;
  invitations_enabled: boolean;
};

const careActivities = new Set([
  "care-recipient-created",
  "care-recipient-updated",
  "check-in-created",
  "note-created",
  "medication-created",
  "medication-updated",
  "household-updated",
]);

const scheduleActivities = new Set([
  "event-created",
  "event-updated",
  "appointment-created",
  "meal-reminder-created",
]);

function acceptsActivity(device: Device, activityType: string) {
  if (careActivities.has(activityType)) return device.care_updates_enabled;
  if (scheduleActivities.has(activityType)) {
    return device.schedule_reminders_enabled;
  }
  return device.invitations_enabled;
}

function secretsMatch(received: string | null, expected: string) {
  if (!received || received.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const webhookSecret = Deno.env.get("PUSH_WEBHOOK_SECRET");
  if (
    !webhookSecret ||
    !secretsMatch(request.headers.get("x-webhook-secret"), webhookSecret)
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = (await request.json()) as WebhookPayload;
  if (
    payload.type !== "INSERT" ||
    payload.schema !== "public" ||
    payload.table !== "household_activity" ||
    !payload.record?.id
  ) {
    return new Response("Invalid webhook payload", { status: 400 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response("Server configuration is incomplete", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const activity = payload.record;
  const membersResult = await supabase
    .from("household_members")
    .select("user_id")
    .eq("household_id", activity.household_id);
  if (membersResult.error) {
    return new Response("Unable to resolve recipients", { status: 500 });
  }

  const recipientIds = (membersResult.data ?? [])
    .map((member) => member.user_id as string)
    .filter((userId) => userId !== activity.actor_user_id);
  if (!recipientIds.length) {
    return Response.json({ ok: true, delivered: 0 });
  }

  const devicesResult = await supabase
    .from("notification_devices")
    .select(
      "expo_push_token, care_updates_enabled, schedule_reminders_enabled, invitations_enabled",
    )
    .in("user_id", recipientIds);
  if (devicesResult.error) {
    return new Response("Unable to resolve notification devices", {
      status: 500,
    });
  }

  const devices = ((devicesResult.data ?? []) as Device[]).filter((device) =>
    acceptsActivity(device, activity.activity_type),
  );
  if (!devices.length) {
    return Response.json({ ok: true, delivered: 0 });
  }

  const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      ...(expoAccessToken
        ? { Authorization: `Bearer ${expoAccessToken}` }
        : {}),
    },
    body: JSON.stringify(
      devices.map((device) => ({
        to: device.expo_push_token,
        title: activity.title,
        body: activity.body,
        data: { activityId: activity.id, href: activity.href ?? "/dashboard" },
        channelId: "household",
      })),
    ),
  });

  if (!expoResponse.ok) {
    return new Response("Expo rejected the notification batch", {
      status: 502,
    });
  }

  const expoResult = (await expoResponse.json()) as {
    data?: Array<{ status: string; details?: { error?: string } }>;
  };
  const invalidTokens = devices
    .filter(
      (_, index) =>
        expoResult.data?.[index]?.details?.error === "DeviceNotRegistered",
    )
    .map((device) => device.expo_push_token);
  if (invalidTokens.length) {
    await supabase
      .from("notification_devices")
      .delete()
      .in("expo_push_token", invalidTokens);
  }

  return Response.json({
    ok: true,
    delivered: devices.length - invalidTokens.length,
  });
});