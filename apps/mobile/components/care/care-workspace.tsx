import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type {
  CareCheckIn,
  CareNote,
  CareRecipient,
  CareScheduleItem,
  CareWorkspaceResponse,
  MedicationReminder,
} from "@getkinlight.com/shared";
import { useRouter } from "expo-router";
import {
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
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

const views = ["overview", "check-ins", "notes", "medications"] as const;
type CareView = (typeof views)[number];
type ColorsValue = (typeof Colors)[keyof typeof Colors];
type IconName = ComponentProps<typeof MaterialIcons>["name"];

const viewLabels: Record<CareView, string> = {
  overview: "Overview",
  "check-ins": "Check-ins",
  notes: "Notes",
  medications: "Meds",
};

const statusLabels: Record<CareCheckIn["status"], string> = {
  doing_well: "Doing well",
  okay: "Okay",
  needs_attention: "Needs attention",
  urgent: "Urgent",
};

function displayName(recipient: CareRecipient) {
  return recipient.preferredName ?? recipient.firstName;
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Kinlight could not load the care workspace.";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function CareWorkspace() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const router = useRouter();
  const [workspace, setWorkspace] = useState<CareWorkspaceResponse | null>(
    null,
  );
  const [activeView, setActiveView] = useState<CareView>("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [switchingRecipient, setSwitchingRecipient] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    createMobileApiClient()
      .careWorkspace.get()
      .then((response) => {
        if (active) setWorkspace(response);
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
  }, []);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      setWorkspace(
        await createMobileApiClient().careWorkspace.get(
          workspace?.selectedRecipient?.id,
        ),
      );
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function selectRecipient(recipientId: string) {
    if (recipientId === workspace?.selectedRecipient?.id) return;
    setSwitchingRecipient(true);
    setError(null);
    try {
      setWorkspace(
        await createMobileApiClient().careWorkspace.get(recipientId),
      );
      setActiveView("overview");
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setSwitchingRecipient(false);
    }
  }

  const recipient = workspace?.selectedRecipient ?? null;
  const title = recipient ? `Care for ${displayName(recipient)}` : "Care";

  return (
    <KinlightScreen
      eyebrow="Care workspace"
      title={title}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {loading ? (
        <View
          style={styles.loading}
          accessibilityLabel="Loading care workspace"
        >
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Gathering care details...
          </Text>
        </View>
      ) : null}

      {!loading && error ? (
        <MessagePanel
          icon="cloud-off"
          title="Care workspace unavailable"
          body={error}
          action="Try again"
          onAction={refresh}
          colors={colors}
        />
      ) : null}

      {!loading && !error && workspace && !recipient ? (
        <MessagePanel
          icon="person-add-alt"
          title={
            workspace.households.length
              ? "Add someone you support"
              : "Start your family space"
          }
          body={
            workspace.households.length
              ? "Create a care profile to organize check-ins, notes, medications, and daily routines."
              : "Create or join a household before adding care profiles."
          }
          action="Open Family"
          onAction={() => router.push("/(tabs)/family")}
          colors={colors}
        />
      ) : null}

      {!loading && !error && workspace && recipient ? (
        <>
          {workspace.recipients.length > 1 ? (
            <RecipientPicker
              recipients={workspace.recipients}
              selectedId={recipient.id}
              disabled={switchingRecipient}
              onSelect={selectRecipient}
              colors={colors}
            />
          ) : null}

          <IdentityBand recipient={recipient} colors={colors} />
          <ViewSelector
            activeView={activeView}
            onSelect={setActiveView}
            colors={colors}
          />

          {switchingRecipient ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <CareViewContent
              view={activeView}
              workspace={workspace}
              onSelectView={setActiveView}
              colors={colors}
            />
          )}
        </>
      ) : null}
    </KinlightScreen>
  );
}

function RecipientPicker({
  recipients,
  selectedId,
  disabled,
  onSelect,
  colors,
}: {
  recipients: CareRecipient[];
  selectedId: string;
  disabled: boolean;
  onSelect: (recipientId: string) => void;
  colors: ColorsValue;
}) {
  return (
    <View style={styles.pickerGroup}>
      <Text style={[styles.overline, { color: colors.textMuted }]}>
        CARE RECIPIENT
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pickerContent}
      >
        {recipients.map((recipient) => {
          const selected = recipient.id === selectedId;
          return (
            <Pressable
              key={recipient.id}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onSelect(recipient.id)}
              style={[
                styles.recipientChip,
                {
                  backgroundColor: selected ? colors.primary : colors.glass,
                  borderColor: selected ? colors.primary : colors.glassBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.recipientChipText,
                  { color: selected ? colors.background : colors.text },
                ]}
              >
                {displayName(recipient)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function IdentityBand({
  recipient,
  colors,
}: {
  recipient: CareRecipient;
  colors: ColorsValue;
}) {
  const initials =
    `${displayName(recipient).slice(0, 1)}${recipient.lastName.slice(0, 1)}`.toUpperCase();
  return (
    <View
      style={[
        styles.identity,
        Shadow,
        { backgroundColor: colors.glass, borderColor: colors.glassBorder },
      ]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.identityCopy}>
        <Text style={[styles.identityName, { color: colors.text }]}>
          {recipient.firstName} {recipient.lastName}
        </Text>
        <Text style={[styles.identityMeta, { color: colors.textMuted }]}>
          {[
            recipient.relationship,
            recipient.isActive ? "Active care profile" : "Archived",
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
      <View
        style={[
          styles.statusDot,
          {
            backgroundColor: recipient.isActive
              ? colors.success
              : colors.textMuted,
          },
        ]}
      />
    </View>
  );
}

function ViewSelector({
  activeView,
  onSelect,
  colors,
}: {
  activeView: CareView;
  onSelect: (view: CareView) => void;
  colors: ColorsValue;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.viewSelector,
        { backgroundColor: colors.glass, borderColor: colors.glassBorder },
      ]}
    >
      {views.map((view) => {
        const selected = view === activeView;
        return (
          <Pressable
            key={view}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onSelect(view)}
            style={[
              styles.viewButton,
              selected && { backgroundColor: colors.glassStrong },
            ]}
          >
            <Text
              style={[
                styles.viewButtonText,
                { color: selected ? colors.text : colors.textMuted },
              ]}
            >
              {viewLabels[view]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function CareViewContent({
  view,
  workspace,
  onSelectView,
  colors,
}: {
  view: CareView;
  workspace: CareWorkspaceResponse;
  onSelectView: (view: CareView) => void;
  colors: ColorsValue;
}) {
  if (view === "check-ins")
    return <CheckInList items={workspace.checkIns} colors={colors} />;
  if (view === "notes")
    return <NoteList items={workspace.notes} colors={colors} />;
  if (view === "medications")
    return <MedicationList items={workspace.medications} colors={colors} />;
  return (
    <Overview
      workspace={workspace}
      onSelectView={onSelectView}
      colors={colors}
    />
  );
}

function Overview({
  workspace,
  onSelectView,
  colors,
}: {
  workspace: CareWorkspaceResponse;
  onSelectView: (view: CareView) => void;
  colors: ColorsValue;
}) {
  const activeMedications = workspace.medications.filter(
    (item) => item.isActive,
  );
  const latestCheckIn = workspace.checkIns[0];

  return (
    <View style={styles.viewContent}>
      <View style={styles.metricGrid}>
        <Metric
          icon="medication"
          value={String(activeMedications.length)}
          label="Active meds"
          tone={Palette.aqua300}
          onPress={() => onSelectView("medications")}
          colors={colors}
        />
        <Metric
          icon="restaurant"
          value={String(
            workspace.eatingReminders.filter((item) => item.isActive).length,
          )}
          label="Meal reminders"
          tone={Palette.sun300}
          colors={colors}
        />
        <Metric
          icon="favorite"
          value={
            latestCheckIn ? statusLabels[latestCheckIn.status] : "No check-in"
          }
          label="Latest wellbeing"
          tone={Palette.peach300}
          onPress={() => onSelectView("check-ins")}
          colors={colors}
        />
      </View>

      <Section title="Upcoming care" icon="event" colors={colors}>
        {workspace.schedule.length ? (
          workspace.schedule
            .slice(0, 5)
            .map((item) => (
              <ScheduleRow key={item.id} item={item} colors={colors} />
            ))
        ) : (
          <EmptyCopy
            icon="event-available"
            text="No upcoming care is scheduled."
            colors={colors}
          />
        )}
      </Section>

      <Section title="Latest check-in" icon="monitor-heart" colors={colors}>
        {latestCheckIn ? (
          <CheckInRow item={latestCheckIn} colors={colors} />
        ) : (
          <EmptyCopy
            icon="favorite-border"
            text="No wellbeing check-ins yet."
            colors={colors}
          />
        )}
      </Section>
    </View>
  );
}

function Metric({
  icon,
  value,
  label,
  tone,
  onPress,
  colors,
}: {
  icon: IconName;
  value: string;
  label: string;
  tone: string;
  onPress?: () => void;
  colors: ColorsValue;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={[
        styles.metric,
        Shadow,
        { backgroundColor: colors.glass, borderColor: colors.glassBorder },
      ]}
    >
      <View style={[styles.metricIcon, { backgroundColor: tone }]}>
        <MaterialIcons name={icon} size={20} color={Palette.navy950} />
      </View>
      <Text
        style={[styles.metricValue, { color: colors.text }]}
        numberOfLines={2}
      >
        {value}
      </Text>
      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Section({
  title,
  icon,
  children,
  colors,
}: {
  title: string;
  icon: IconName;
  children: ReactNode;
  colors: ColorsValue;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {title}
        </Text>
        <MaterialIcons name={icon} size={21} color={colors.icon} />
      </View>
      <View
        style={[
          styles.list,
          Shadow,
          { backgroundColor: colors.glass, borderColor: colors.glassBorder },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function CheckInList({
  items,
  colors,
}: {
  items: CareCheckIn[];
  colors: ColorsValue;
}) {
  return (
    <Section title="Wellbeing timeline" icon="monitor-heart" colors={colors}>
      {items.length ? (
        items.map((item) => (
          <CheckInRow key={item.id} item={item} colors={colors} />
        ))
      ) : (
        <EmptyCopy
          icon="favorite-border"
          text="No check-ins have been recorded."
          colors={colors}
        />
      )}
    </Section>
  );
}

function CheckInRow({
  item,
  colors,
}: {
  item: CareCheckIn;
  colors: ColorsValue;
}) {
  const urgent = item.status === "urgent" || item.status === "needs_attention";
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View
        style={[
          styles.rowIcon,
          {
            backgroundColor: urgent
              ? colors.dangerSurface
              : colors.surfaceMuted,
          },
        ]}
      >
        <MaterialIcons
          name={urgent ? "priority-high" : "favorite"}
          size={20}
          color={urgent ? colors.danger : colors.success}
        />
      </View>
      <View style={styles.rowCopy}>
        <View style={styles.rowHeading}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>
            {statusLabels[item.status]}
          </Text>
          {item.mood ? (
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              Mood {item.mood}/5
            </Text>
          ) : null}
        </View>
        <Text
          style={[styles.rowBody, { color: colors.textMuted }]}
          numberOfLines={2}
        >
          {item.summary ?? "No summary added."}
        </Text>
        <Text style={[styles.rowTime, { color: colors.textMuted }]}>
          {formatDateTime(item.occurredAt)}
        </Text>
      </View>
    </View>
  );
}

function NoteList({
  items,
  colors,
}: {
  items: CareNote[];
  colors: ColorsValue;
}) {
  return (
    <Section title="Shared care notes" icon="notes" colors={colors}>
      {items.length ? (
        items.map((item) => (
          <View
            key={item.id}
            style={[styles.row, { borderBottomColor: colors.border }]}
          >
            <View
              style={[
                styles.rowIcon,
                {
                  backgroundColor: item.isPinned
                    ? Palette.sun300
                    : colors.surfaceMuted,
                },
              ]}
            >
              <MaterialIcons
                name={item.isPinned ? "push-pin" : "notes"}
                size={20}
                color={Palette.navy950}
              />
            </View>
            <View style={styles.rowCopy}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                {item.title ?? "Care note"}
              </Text>
              <Text
                style={[styles.rowBody, { color: colors.textMuted }]}
                numberOfLines={3}
              >
                {item.body}
              </Text>
              <Text style={[styles.rowTime, { color: colors.textMuted }]}>
                {formatDateTime(item.createdAt)}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <EmptyCopy
          icon="note-add"
          text="No care notes have been shared."
          colors={colors}
        />
      )}
    </Section>
  );
}

function MedicationList({
  items,
  colors,
}: {
  items: MedicationReminder[];
  colors: ColorsValue;
}) {
  return (
    <Section title="Medication reminders" icon="medication" colors={colors}>
      {items.length ? (
        items.map((item) => (
          <View
            key={item.id}
            style={[styles.row, { borderBottomColor: colors.border }]}
          >
            <View
              style={[
                styles.rowIcon,
                {
                  backgroundColor: item.isActive
                    ? Palette.aqua300
                    : colors.surfaceMuted,
                },
              ]}
            >
              <MaterialIcons
                name="medication"
                size={20}
                color={Palette.navy950}
              />
            </View>
            <View style={styles.rowCopy}>
              <View style={styles.rowHeading}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>
                  {item.medicationName}
                </Text>
                <Text
                  style={[
                    styles.meta,
                    {
                      color: item.isActive ? colors.success : colors.textMuted,
                    },
                  ]}
                >
                  {item.isActive ? "Active" : "Paused"}
                </Text>
              </View>
              <Text style={[styles.rowBody, { color: colors.textMuted }]}>
                {[item.dosage, item.reminderTimes.join(", ")]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              {item.instructions ? (
                <Text
                  style={[styles.rowTime, { color: colors.textMuted }]}
                  numberOfLines={2}
                >
                  {item.instructions}
                </Text>
              ) : null}
            </View>
          </View>
        ))
      ) : (
        <EmptyCopy
          icon="medication"
          text="No medication reminders yet."
          colors={colors}
        />
      )}
    </Section>
  );
}

function ScheduleRow({
  item,
  colors,
}: {
  item: CareScheduleItem;
  colors: ColorsValue;
}) {
  const time = item.isAllDay
    ? "All day"
    : new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(item.startsAt));
  const icon =
    item.kind === "medication"
      ? "medication"
      : item.kind === "meal"
        ? "restaurant"
        : item.kind === "appointment"
          ? "medical-services"
          : "event";

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={[styles.rowIcon, { backgroundColor: colors.surfaceMuted }]}>
        <MaterialIcons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>
          {item.title}
        </Text>
        <Text style={[styles.rowBody, { color: colors.textMuted }]}>
          {[time, item.detail].filter(Boolean).join(" · ")}
        </Text>
      </View>
    </View>
  );
}

function EmptyCopy({
  icon,
  text,
  colors,
}: {
  icon: IconName;
  text: string;
  colors: ColorsValue;
}) {
  return (
    <View style={styles.emptyCopy}>
      <MaterialIcons name={icon} size={27} color={colors.icon} />
      <Text style={[styles.emptyCopyText, { color: colors.textMuted }]}>
        {text}
      </Text>
    </View>
  );
}

function MessagePanel({
  icon,
  title,
  body,
  action,
  onAction,
  colors,
}: {
  icon: IconName;
  title: string;
  body: string;
  action: string;
  onAction: () => void;
  colors: ColorsValue;
}) {
  return (
    <View
      style={[
        styles.message,
        Shadow,
        { backgroundColor: colors.glass, borderColor: colors.glassBorder },
      ]}
    >
      <View
        style={[styles.messageIcon, { backgroundColor: colors.surfaceMuted }]}
      >
        <MaterialIcons name={icon} size={28} color={colors.primary} />
      </View>
      <Text style={[styles.messageTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.messageBody, { color: colors.textMuted }]}>
        {body}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onAction}
        style={({ pressed }) => [
          styles.primaryButton,
          {
            backgroundColor: pressed ? colors.primaryPressed : colors.primary,
          },
        ]}
      >
        <Text style={[styles.primaryButtonText, { color: colors.background }]}>
          {action}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  loadingText: { ...Type.body },
  pickerGroup: { gap: Spacing.sm },
  overline: { ...Type.caption },
  pickerContent: { gap: Spacing.sm },
  recipientChip: {
    minHeight: 40,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
  },
  recipientChipText: { ...Type.label },
  identity: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.aqua300,
  },
  avatarText: { ...Type.heading, color: Palette.navy950 },
  identityCopy: { flex: 1, gap: Spacing.xs },
  identityName: { ...Type.heading },
  identityMeta: { ...Type.caption },
  statusDot: { width: 10, height: 10, borderRadius: Radius.pill },
  viewSelector: {
    minWidth: "100%",
    borderWidth: 1,
    borderRadius: Radius.pill,
    padding: Spacing.xs,
  },
  viewButton: {
    flex: 1,
    minWidth: 82,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
  },
  viewButtonText: { ...Type.caption },
  viewContent: { gap: Spacing.xl },
  metricGrid: { flexDirection: "row", gap: Spacing.sm },
  metric: {
    flex: 1,
    minHeight: "auto",
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    justifyContent: "flex-start",
    gap: Spacing.xs,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  metricValue: { ...Type.label },
  metricLabel: { ...Type.caption },
  section: { gap: Spacing.md },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { ...Type.heading },
  list: { borderWidth: 1, borderRadius: Radius.lg, overflow: "hidden" },
  row: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCopy: { flex: 1, gap: Spacing.xs },
  rowHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  rowTitle: { ...Type.label, flex: 1 },
  rowBody: { ...Type.caption },
  rowTime: { ...Type.caption, fontSize: 11 },
  meta: { ...Type.caption },
  emptyCopy: {
    minHeight: 132,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  emptyCopyText: { ...Type.body, textAlign: "center" },
  message: {
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  messageIcon: {
    width: 54,
    height: 54,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  messageTitle: { ...Type.heading, textAlign: "center" },
  messageBody: { ...Type.body, textAlign: "center", maxWidth: 340 },
  primaryButton: {
    minHeight: 48,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  primaryButtonText: { ...Type.label },
});
