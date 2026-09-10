import type { NotificationPreferences } from "@getkinlight.com/shared";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { createMobileApiClient } from "@/lib/api";
import { MOBILE_PREFERENCES_KEY } from "@/lib/observability";

const INSTALLATION_ID_KEY = "kinlight-installation-id";

export type PushPreferences = NotificationPreferences & {
  pushNotifications: boolean;
};

export const defaultPushPreferences: PushPreferences = {
  pushNotifications: false,
  careUpdatesEnabled: true,
  scheduleRemindersEnabled: true,
  invitationsEnabled: true,
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function newInstallationId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (part) => {
    const value = Math.floor(Math.random() * 16);
    return (part === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

async function installationId(create = true) {
  const stored = await SecureStore.getItemAsync(INSTALLATION_ID_KEY);
  if (stored || !create) return stored;
  const created = newInstallationId();
  await SecureStore.setItemAsync(INSTALLATION_ID_KEY, created);
  return created;
}

async function configureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("household", {
    name: "Household updates",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 150, 250],
  });
}

function projectId() {
  const id =
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)
      ?.projectId;
  if (!id) {
    throw new Error(
      "Push notifications need an EAS project ID in the Expo app configuration.",
    );
  }
  return id;
}

export async function enablePushNotifications(
  preferences: NotificationPreferences,
) {
  if (Platform.OS !== "android" && Platform.OS !== "ios") {
    throw new Error("Push notifications require the iOS or Android app.");
  }
  if (!Device.isDevice) {
    throw new Error("Push notifications require a physical device.");
  }

  await configureAndroidChannel();
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted") {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (permission.status !== "granted") {
    throw new Error(
      "Notification permission was not granted. You can enable it in system settings.",
    );
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: projectId(),
  });
  const deviceId = await installationId();
  if (!deviceId) throw new Error("Unable to identify this app installation.");

  return createMobileApiClient().notifications.updateDevice({
    action: "register",
    deviceId,
    expoPushToken: token.data,
    platform: Platform.OS,
    preferences,
  });
}

export async function disablePushNotifications() {
  if (Platform.OS !== "android" && Platform.OS !== "ios") return;
  const deviceId = await installationId(false);
  if (!deviceId) return;
  await createMobileApiClient().notifications.updateDevice({
    action: "unregister",
    deviceId,
  });
}

export async function readPushPreferences(): Promise<PushPreferences> {
  try {
    const stored =
      Platform.OS === "web"
        ? globalThis.localStorage?.getItem(MOBILE_PREFERENCES_KEY)
        : await SecureStore.getItemAsync(MOBILE_PREFERENCES_KEY);
    return stored
      ? {
          ...defaultPushPreferences,
          ...(JSON.parse(stored) as Partial<PushPreferences>),
        }
      : defaultPushPreferences;
  } catch {
    return defaultPushPreferences;
  }
}

export async function refreshPushRegistration() {
  const preferences = await readPushPreferences();
  if (!preferences.pushNotifications) return;
  await enablePushNotifications(preferences);
}

export function addNotificationResponseListener(listener: () => void) {
  return Notifications.addNotificationResponseReceivedListener(listener);
}

export function consumeLastNotificationResponse() {
  const response = Notifications.getLastNotificationResponse();
  if (response) Notifications.clearLastNotificationResponse();
  return response;
}
