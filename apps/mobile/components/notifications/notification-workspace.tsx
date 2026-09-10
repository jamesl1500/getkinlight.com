import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { HouseholdActivity } from "@getkinlight.com/shared";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { KinlightScreen } from "@/components/kinlight-screen";
import { Colors, Radius, Shadow, Spacing, Type } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { createMobileApiClient } from "@/lib/api";

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";

  const elapsedMinutes = Math.round((timestamp - Date.now()) / 60_000);
  if (elapsedMinutes === 0) return "Just now";
  if (Math.abs(elapsedMinutes) < 60) {
    return relativeUnit(elapsedMinutes, "minute");
  }

  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (Math.abs(elapsedHours) < 24) {
    return relativeUnit(elapsedHours, "hour");
  }

  return relativeUnit(Math.round(elapsedHours / 24), "day");
}

function relativeUnit(value: number, unit: "minute" | "hour" | "day") {
  const label = `${unit}${Math.abs(value) === 1 ? "" : "s"}`;
  return value < 0 ? `${Math.abs(value)} ${label} ago` : `In ${value} ${label}`;
}

function mobileDestination(href: string | null) {
  if (href?.startsWith("/care")) return "/(tabs)/care" as const;
  if (href?.startsWith("/calendar")) return "/(tabs)/calendar" as const;
  if (href?.startsWith("/family")) return "/(tabs)/family" as const;
  return "/(tabs)" as const;
}

export function NotificationWorkspace() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const router = useRouter();
  const [activities, setActivities] = useState<HouseholdActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unreadCount = activities.filter((activity) => !activity.readAt).length;

  async function load() {
    setError(null);
    try {
      const response = await createMobileApiClient().notifications.get();
      setActivities(response.activities);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load notifications.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function markAllRead() {
    try {
      await createMobileApiClient().notifications.markRead({
        action: "mark-all-read",
      });
      const readAt = new Date().toISOString();
      setActivities((current) =>
        current.map((activity) => ({ ...activity, readAt })),
      );
    } catch (markError) {
      setError(
        markError instanceof Error
          ? markError.message
          : "Unable to update notifications.",
      );
    }
  }

  async function openActivity(activity: HouseholdActivity) {
    if (!activity.readAt) {
      try {
        await createMobileApiClient().notifications.markRead({
          action: "mark-read",
          activityId: activity.id,
        });
      } catch (markError) {
        setError(
          markError instanceof Error
            ? markError.message
            : "Unable to update notification.",
        );
        return;
      }
    }
    router.push(mobileDestination(activity.href));
  }

  return (
    <KinlightScreen
      eyebrow="Household"
      title="Activity"
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void load();
      }}
      action={
        unreadCount ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void markAllRead()}
            hitSlop={8}
          >
            <Text style={[styles.markAll, { color: colors.accent }]}>
              Mark all read
            </Text>
          </Pressable>
        ) : undefined
      }
    >
      {loading ? (
        <ActivityIndicator color={colors.accent} size="large" />
      ) : null}
      {error ? (
        <View
          style={[
            styles.message,
            {
              backgroundColor: colors.dangerSurface,
              borderColor: colors.danger,
            },
          ]}
        >
          <Text style={[styles.messageText, { color: colors.text }]}>
            {error}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => void load()}>
            <Text style={[styles.retry, { color: colors.danger }]}>
              Try again
            </Text>
          </Pressable>
        </View>
      ) : null}
      {!loading && activities.length === 0 ? (
        <View
          style={[
            styles.empty,
            { backgroundColor: colors.glass, borderColor: colors.glassBorder },
          ]}
        >
          <MaterialIcons
            name="notifications-none"
            size={30}
            color={colors.icon}
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            All caught up
          </Text>
          <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
            Household updates will appear here.
          </Text>
        </View>
      ) : null}
      {activities.map((activity) => (
        <Pressable
          key={activity.id}
          accessibilityRole="button"
          onPress={() => void openActivity(activity)}
          style={({ pressed }) => [
            styles.activity,
            Shadow,
            {
              backgroundColor: pressed ? colors.surfaceMuted : colors.glass,
              borderColor: activity.readAt ? colors.glassBorder : colors.accent,
            },
          ]}
        >
          <View
            style={[
              styles.dot,
              {
                backgroundColor: activity.readAt
                  ? colors.border
                  : colors.accent,
              },
            ]}
          />
          <View style={styles.activityCopy}>
            <Text style={[styles.activityTitle, { color: colors.text }]}>
              {activity.title}
            </Text>
            <Text style={[styles.activityBody, { color: colors.textMuted }]}>
              {activity.body}
            </Text>
            <Text style={[styles.activityTime, { color: colors.icon }]}>
              {relativeTime(activity.createdAt)}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={colors.icon} />
        </Pressable>
      ))}
    </KinlightScreen>
  );
}

const styles = StyleSheet.create({
  markAll: { ...Type.label },
  message: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  messageText: { ...Type.body },
  retry: { ...Type.label },
  empty: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing["2xl"],
    alignItems: "center",
    gap: Spacing.sm,
  },
  emptyTitle: { ...Type.heading },
  emptyBody: { ...Type.body, textAlign: "center" },
  activity: {
    minHeight: 104,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  dot: { width: 8, height: 8, borderRadius: Radius.pill },
  activityCopy: { flex: 1, gap: Spacing.xs },
  activityTitle: { ...Type.label },
  activityBody: { ...Type.body },
  activityTime: { ...Type.caption },
});
