import {
  NotificationDeviceRequestSchema,
  NotificationDeviceResponseSchema,
  createKinlightServerClient,
} from "@getkinlight.com/shared";
import { NextResponse } from "next/server";

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : null;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function PATCH(request: Request) {
  const accessToken = bearerToken(request);
  if (!accessToken) return errorResponse("Your session has expired.", 401);

  const client = createKinlightServerClient(accessToken);
  const { data: userData, error: userError } =
    await client.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return errorResponse("Your session has expired.", 401);
  }

  const input = NotificationDeviceRequestSchema.safeParse(await request.json());
  if (!input.success) {
    return errorResponse("Invalid notification device request.", 400);
  }

  const userId = userData.user.id;
  if (input.data.action === "unregister") {
    const { error } = await client
      .from("notification_devices")
      .delete()
      .eq("user_id", userId)
      .eq("device_id", input.data.deviceId);
    if (error) return errorResponse("Unable to unregister this device.", 400);

    return NextResponse.json(
      NotificationDeviceResponseSchema.parse({
        ok: true,
        registered: false,
        preferences: null,
        message: "Notifications disabled on this device.",
      }),
    );
  }

  const preferences = input.data.preferences;
  const preferenceColumns = {
    care_updates_enabled: preferences.careUpdatesEnabled,
    schedule_reminders_enabled: preferences.scheduleRemindersEnabled,
    invitations_enabled: preferences.invitationsEnabled,
    last_seen_at: new Date().toISOString(),
  };

  const result =
    input.data.action === "register"
      ? await client.from("notification_devices").upsert(
          {
            user_id: userId,
            device_id: input.data.deviceId,
            expo_push_token: input.data.expoPushToken,
            platform: input.data.platform,
            ...preferenceColumns,
          },
          { onConflict: "user_id,device_id" },
        )
      : await client
          .from("notification_devices")
          .update(preferenceColumns)
          .eq("user_id", userId)
          .eq("device_id", input.data.deviceId);

  if (result.error) {
    return errorResponse("Unable to update notifications on this device.", 400);
  }

  return NextResponse.json(
    NotificationDeviceResponseSchema.parse({
      ok: true,
      registered: true,
      preferences,
      message:
        input.data.action === "register"
          ? "Notifications enabled on this device."
          : "Notification preferences updated.",
    }),
  );
}
