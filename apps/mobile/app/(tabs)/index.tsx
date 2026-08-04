import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type {
  CareScheduleItem,
  DashboardCareUpdate,
  DashboardResponse,
} from "@getkinlight.com/shared";
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
import {
  Colors,
  Palette,
  Radius,
  Shadow,
  Spacing,
  Type,
} from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { createMobileApiClient } from "@/lib/api";

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Kinlight could not load your family dashboard.";
}

export default function HomeScreen() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const dateKey = localDateKey(new Date());
  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  useEffect(() => {
    let active = true;
    createMobileApiClient()
      .dashboard.get(dateKey)
      .then((response) => {
        if (active) setDashboard(response);
      })
      .catch((loadError: unknown) => {
        if (active) setError(errorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [dateKey]);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      setDashboard(await createMobileApiClient().dashboard.get(dateKey));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const name =
    dashboard?.profile.firstName ?? dashboard?.profile.username ?? "there";

  return (
    <KinlightScreen
      eyebrow={today}
      title={`Welcome back, ${name}.`}
      refreshing={refreshing}
      onRefresh={refresh}
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          onPress={() => router.push("/(tabs)/settings")}
          style={[
            styles.settingsButton,
            {
              backgroundColor: colors.glassStrong,
              borderColor: colors.glassBorder,
            },
          ]}
        >
          <MaterialIcons name="settings" size={22} color={colors.primary} />
        </Pressable>
      }
    >
      {loading ? (
        <View style={styles.loading} accessibilityLabel="Loading dashboard">
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Gathering today&apos;s family details...
          </Text>
        </View>
      ) : null}

      {!loading && error ? (
        <View
          style={[
            styles.message,
            {
              backgroundColor: colors.dangerSurface,
              borderColor: colors.danger,
            },
          ]}
        >
          <MaterialIcons name="cloud-off" size={28} color={colors.danger} />
          <View style={styles.messageCopy}>
            <Text style={[styles.messageTitle, { color: colors.text }]}>
              Dashboard unavailable
            </Text>
            <Text style={[styles.messageBody, { color: colors.textMuted }]}>
              {error}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={refresh}
            style={({ pressed }) => [
              styles.retryButton,
              {
                backgroundColor: pressed
                  ? colors.primaryPressed
                  : colors.primary,
              },
            ]}
          >
            <Text style={[styles.retryText, { color: colors.background }]}>
              Try again
            </Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && dashboard ? (
        <>
          <View
            style={[styles.hero, Shadow, { backgroundColor: colors.primary }]}
          >
            <View style={styles.heroCopy}>
              <Text
                style={[
                  styles.heroLabel,
                  {
                    color:
                      scheme === "dark" ? Palette.navy950 : Palette.aqua300,
                  },
                ]}
              >
                TODAY AT A GLANCE
              </Text>
              <Text style={[styles.heroTitle, { color: colors.background }]}>
                {dashboard.household?.name ?? "Start your family space"}
              </Text>
              <Text style={[styles.heroBody, { color: colors.background }]}>
                {dashboard.household
                  ? `${dashboard.schedule.length} plan${dashboard.schedule.length === 1 ? "" : "s"} today and ${dashboard.recentUpdates.length} recent update${dashboard.recentUpdates.length === 1 ? "" : "s"}.`
                  : "Create or join a household to coordinate care together."}
              </Text>
            </View>
            <View
              style={[
                styles.privateBadge,
                {
                  backgroundColor: colors.glassStrong,
                  borderColor: colors.glassBorder,
                },
              ]}
            >
              <View
                style={[styles.statusDot, { backgroundColor: colors.success }]}
              />
              <Text style={[styles.privateText, { color: colors.primary }]}>
                Private
              </Text>
            </View>
          </View>

          <DashboardSection
            title="Today's plan"
            action="Open calendar"
            onAction={() => router.push("/(tabs)/calendar")}
            colors={colors}
          >
            {dashboard.schedule.length ? (
              dashboard.schedule.map((item) => (
                <ScheduleRow key={item.id} item={item} colors={colors} />
              ))
            ) : (
              <EmptyRow
                icon="event-available"
                text="No plans are scheduled for today."
                colors={colors}
              />
            )}
          </DashboardSection>

          <DashboardSection
            title="Recent family updates"
            action="Open care"
            onAction={() => router.push("/(tabs)/care")}
            colors={colors}
          >
            {dashboard.recentUpdates.length ? (
              dashboard.recentUpdates.map((update) => (
                <UpdateRow
                  key={`${update.kind}-${update.id}`}
                  update={update}
                  colors={colors}
                />
              ))
            ) : (
              <EmptyRow
                icon="favorite-border"
                text="No recent care updates yet."
                colors={colors}
              />
            )}
          </DashboardSection>
        </>
      ) : null}
    </KinlightScreen>
  );
}

function DashboardSection({
  title,
  action,
  onAction,
  children,
  colors,
}: {
  title: string;
  action: string;
  onAction: () => void;
  children: React.ReactNode;
  colors: (typeof Colors)[keyof typeof Colors];
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {title}
        </Text>
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text style={[styles.sectionAction, { color: colors.accent }]}>
            {action}
          </Text>
        </Pressable>
      </View>
      <View
        style={[
          styles.list,
          Shadow,
          {
            backgroundColor: colors.glass,
            borderColor: colors.glassBorder,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function ScheduleRow({
  item,
  colors,
}: {
  item: CareScheduleItem;
  colors: (typeof Colors)[keyof typeof Colors];
}) {
  const time = item.isAllDay
    ? "All day"
    : new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(item.startsAt));
  const icon =
    item.kind === "appointment"
      ? "medical-services"
      : item.kind === "medication"
        ? "medication"
        : item.kind === "meal"
          ? "restaurant"
          : "event";
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={[styles.iconWell, { backgroundColor: colors.surfaceMuted }]}>
        <MaterialIcons name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>
          {item.title}
        </Text>
        <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
          {[time, item.recipientName, item.detail].filter(Boolean).join(" · ")}
        </Text>
      </View>
    </View>
  );
}

function UpdateRow({
  update,
  colors,
}: {
  update: DashboardCareUpdate;
  colors: (typeof Colors)[keyof typeof Colors];
}) {
  const when = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(update.occurredAt));
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View
        style={[
          styles.iconWell,
          {
            backgroundColor:
              update.kind === "mood" ? Palette.sun300 : Palette.aqua300,
          },
        ]}
      >
        <MaterialIcons
          name={update.kind === "mood" ? "mood" : "notes"}
          size={22}
          color={Palette.navy950}
        />
      </View>
      <View style={styles.rowCopy}>
        <Text
          style={[styles.rowTitle, { color: colors.text }]}
          numberOfLines={2}
        >
          {update.summary}
        </Text>
        <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
          {[update.recipientName, when].filter(Boolean).join(" · ")}
        </Text>
      </View>
    </View>
  );
}

function EmptyRow({
  icon,
  text,
  colors,
}: {
  icon: "event-available" | "favorite-border";
  text: string;
  colors: (typeof Colors)[keyof typeof Colors];
}) {
  return (
    <View style={styles.emptyRow}>
      <MaterialIcons name={icon} size={26} color={colors.icon} />
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  settingsButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.pill,
  },
  loading: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  loadingText: { ...Type.body, textAlign: "center" },
  message: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  messageCopy: { gap: Spacing.xs },
  messageTitle: { ...Type.heading },
  messageBody: { ...Type.body },
  retryButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
  },
  retryText: { ...Type.label },
  hero: {
    minHeight: 220,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  heroCopy: { gap: Spacing.sm, maxWidth: 310 },
  heroLabel: { ...Type.caption },
  heroTitle: { ...Type.title },
  heroBody: { ...Type.body, opacity: 0.82 },
  privateBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  statusDot: { width: 8, height: 8, borderRadius: Radius.pill },
  privateText: { ...Type.caption },
  section: { gap: Spacing.md },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  sectionTitle: { ...Type.heading, flex: 1 },
  sectionAction: { ...Type.label },
  list: { borderWidth: 1, borderRadius: Radius.lg, overflow: "hidden" },
  row: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWell: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCopy: { flex: 1, gap: Spacing.xs },
  rowTitle: { ...Type.label },
  rowMeta: { ...Type.caption },
  emptyRow: {
    minHeight: 116,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  emptyText: { ...Type.body, textAlign: "center" },
});
