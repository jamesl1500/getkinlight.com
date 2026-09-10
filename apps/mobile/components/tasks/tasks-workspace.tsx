import type { TaskBoardItem, TaskBoardResponse } from "@getkinlight.com/shared";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { KinlightScreen } from "@/components/kinlight-screen";
import { Colors, Radius, Shadow, Spacing, Type } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { createMobileApiClient } from "@/lib/api";

const UNCLAIMED = "unclaimed";

const kindLabels: Record<TaskBoardItem["kind"], string> = {
  appointment: "Appointment",
  event: "Family event",
  medication: "Medication",
  meal: "Eating reminder",
};

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Kinlight could not load your tasks.";
}

function cardTime(item: TaskBoardItem) {
  return item.isAllDay
    ? "All day"
    : new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(item.startsAt));
}

export function TasksWorkspace() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const [board, setBoard] = useState<TaskBoardResponse | null>(null);
  const [items, setItems] = useState<TaskBoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const result = await createMobileApiClient().tasks.get();
      setBoard(result);
      setItems(result.items);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function moveTo(item: TaskBoardItem, destination: string) {
    if (!board?.selectedHousehold || busyId) return;
    const household = board.selectedHousehold;
    setBusyId(item.id);
    setError("");
    try {
      const client = createMobileApiClient();
      const result = await client.schedule.claimTask(
        destination === UNCLAIMED
          ? {
              action: "unclaim",
              householdId: household.id,
              resourceType: item.kind,
              resourceId: item.sourceId,
            }
          : destination === board.currentUserId
            ? {
                action: "claim",
                householdId: household.id,
                resourceType: item.kind,
                resourceId: item.sourceId,
              }
            : {
                action: "assign",
                householdId: household.id,
                resourceType: item.kind,
                resourceId: item.sourceId,
                assigneeId: destination,
              },
      );
      if (!result.ok) throw new Error(result.message);
      setItems((current) =>
        current.map((existing) =>
          existing.id === item.id
            ? {
                ...existing,
                assignedTo: result.assignment?.assignedTo ?? null,
                assignedToName: result.assignment?.assignedToName ?? null,
              }
            : existing,
        ),
      );
    } catch (moveError) {
      setError(errorMessage(moveError));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <KinlightScreen eyebrow="Family tasks" title="Tasks">
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </KinlightScreen>
    );
  }

  if (!board?.selectedHousehold) {
    return (
      <KinlightScreen eyebrow="Family tasks" title="Tasks">
        <Text style={[styles.body, { color: colors.textMuted }]}>
          Create or join a household to start assigning family tasks.
        </Text>
      </KinlightScreen>
    );
  }

  const sections = [
    { id: UNCLAIMED, label: "Unclaimed", items: items.filter((item) => !item.assignedTo) },
    ...board.members.map((member) => ({
      id: member.userId,
      label:
        member.userId === board.currentUserId
          ? `${member.displayName} (you)`
          : member.displayName,
      items: items.filter((item) => item.assignedTo === member.userId),
    })),
  ];

  return (
    <KinlightScreen
      eyebrow="Family tasks"
      title="Tasks"
      refreshing={refreshing}
      onRefresh={() => void load(true)}
    >
      {error ? (
        <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
      ) : null}

      {sections.map((section) => (
        <View key={section.id} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {section.label}
            </Text>
            <Text style={[styles.sectionCount, { color: colors.textMuted }]}>
              {section.items.length}
            </Text>
          </View>
          {section.items.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              No tasks here.
            </Text>
          ) : null}
          {section.items
            .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
            .map((item) => {
              const canMove =
                !item.assignedTo ||
                item.assignedTo === board.currentUserId ||
                board.canAssign;
              const destinations = [
                { id: UNCLAIMED, label: "Unclaimed" },
                ...board.members
                  .filter(
                    (member) =>
                      member.userId === board.currentUserId || board.canAssign,
                  )
                  .map((member) => ({
                    id: member.userId,
                    label:
                      member.userId === board.currentUserId
                        ? "Me"
                        : member.displayName,
                  })),
              ];

              return (
                <View
                  key={item.id}
                  style={[
                    styles.card,
                    Shadow,
                    { backgroundColor: colors.glass, borderColor: colors.glassBorder },
                  ]}
                >
                  <Text style={[styles.cardKind, { color: colors.accent }]}>
                    {kindLabels[item.kind]}
                  </Text>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
                    {cardTime(item)}
                    {item.recipientName ? ` · ${item.recipientName}` : ""}
                  </Text>
                  {canMove ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.chipRow}
                    >
                      {destinations.map((destination) => {
                        const selected =
                          (item.assignedTo ?? UNCLAIMED) === destination.id;
                        return (
                          <Pressable
                            key={destination.id}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            disabled={busyId === item.id}
                            onPress={() => void moveTo(item, destination.id)}
                            style={[
                              styles.chip,
                              {
                                backgroundColor: selected
                                  ? colors.primary
                                  : colors.glassStrong,
                                borderColor: selected
                                  ? colors.primary
                                  : colors.glassBorder,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                {
                                  color: selected
                                    ? colors.background
                                    : colors.text,
                                },
                              ]}
                            >
                              {destination.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <Text style={[styles.readOnly, { color: colors.textMuted }]}>
                      Assigned by a household owner or caregiver
                    </Text>
                  )}
                </View>
              );
            })}
        </View>
      ))}
    </KinlightScreen>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: Spacing["2xl"], alignItems: "center" },
  body: { ...Type.body },
  error: { ...Type.caption, marginBottom: Spacing.sm },
  section: { marginBottom: Spacing.lg },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  sectionTitle: { ...Type.heading },
  sectionCount: { ...Type.caption },
  empty: { ...Type.caption },
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: 4,
  },
  cardKind: { ...Type.caption, fontWeight: "700", textTransform: "uppercase" },
  cardTitle: { ...Type.label },
  cardMeta: { ...Type.caption },
  chipRow: { gap: Spacing.xs, marginTop: Spacing.xs },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  chipText: { ...Type.caption, fontWeight: "700" },
  readOnly: { ...Type.caption, fontStyle: "italic", marginTop: Spacing.xs },
});
