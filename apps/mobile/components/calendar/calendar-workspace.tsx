import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type {
  CareScheduleItem,
  CareScheduleRangeResponse,
  CreateCareScheduleRequest,
} from "@getkinlight.com/shared";
import { useEffect, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

const DAY_MS = 86_400_000;
const weekDays = ["S", "M", "T", "W", "T", "F", "S"];
const kinds = ["all", "event", "appointment", "medication", "meal"] as const;
const createKinds = ["event", "appointment", "medication", "meal"] as const;

type CalendarKind = (typeof kinds)[number];
type CreateKind = (typeof createKinds)[number];
type ColorsValue = (typeof Colors)[keyof typeof Colors];
type IconName = ComponentProps<typeof MaterialIcons>["name"];

const kindLabels: Record<CalendarKind, string> = {
  all: "All",
  event: "Events",
  appointment: "Visits",
  medication: "Meds",
  meal: "Meals",
};

const kindMeta: Record<
  CareScheduleItem["kind"],
  { icon: IconName; color: string; label: string }
> = {
  event: { icon: "event", color: Palette.peach300, label: "Event" },
  appointment: {
    icon: "medical-services",
    color: Palette.aqua300,
    label: "Appointment",
  },
  medication: {
    icon: "medication",
    color: Palette.sun300,
    label: "Medication",
  },
  meal: { icon: "restaurant", color: "#C7D9F3", label: "Meal" },
};

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(value: string) {
  return new Date(`${value}T12:00:00.000Z`);
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 12));
}

function addDays(date: Date, count: number) {
  return new Date(date.getTime() + count * DAY_MS);
}

function addMonths(date: Date, count: number) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1, 12),
  );
}

function calendarRange(month: Date) {
  const first = startOfMonth(month);
  const start = addDays(first, -first.getUTCDay());
  return { start, end: addDays(start, 42) };
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Kinlight could not load the family calendar.";
}

function formatTime(item: CareScheduleItem) {
  if (item.isAllDay) return "All day";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(item.startsAt));
}

export function CalendarWorkspace() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const today = dateFromKey(localDateKey(new Date()));
  const [month, setMonth] = useState(startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(dateKey(today));
  const [activeKind, setActiveKind] = useState<CalendarKind>("all");
  const [calendar, setCalendar] = useState<CareScheduleRangeResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const range = calendarRange(month);
  const rangeStart = dateKey(range.start);
  const rangeEnd = dateKey(range.end);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    createMobileApiClient()
      .schedule.getRange(rangeStart, rangeEnd)
      .then((response) => {
        if (active) setCalendar(response);
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
  }, [rangeEnd, rangeStart]);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      setCalendar(
        await createMobileApiClient().schedule.getRange(rangeStart, rangeEnd),
      );
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function moveMonth(offset: number) {
    const next = addMonths(month, offset);
    setMonth(next);
    setSelectedDate(dateKey(next));
  }

  function goToday() {
    setMonth(startOfMonth(today));
    setSelectedDate(dateKey(today));
  }

  const filteredItems = (calendar?.items ?? []).filter(
    (item) => activeKind === "all" || item.kind === activeKind,
  );
  const selectedItems = filteredItems
    .filter((item) => item.startsAt.slice(0, 10) === selectedDate)
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt));

  return (
    <KinlightScreen
      eyebrow="Plan together"
      title="Calendar"
      refreshing={refreshing}
      onRefresh={refresh}
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add calendar item"
          disabled={!calendar?.households.length}
          onPress={() => setShowCreate(true)}
          style={({ pressed }) => [
            styles.addButton,
            {
              backgroundColor: colors.primary,
              opacity: !calendar?.households.length ? 0.4 : pressed ? 0.78 : 1,
            },
          ]}
        >
          <MaterialIcons name="add" size={22} color={colors.background} />
        </Pressable>
      }
    >
      <MonthHeader
        month={month}
        onPrevious={() => moveMonth(-1)}
        onNext={() => moveMonth(1)}
        onToday={goToday}
        colors={colors}
      />

      {loading ? (
        <View style={styles.loading} accessibilityLabel="Loading calendar">
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Gathering family plans...
          </Text>
        </View>
      ) : null}

      {!loading && error ? (
        <MessagePanel
          icon="cloud-off"
          title="Calendar unavailable"
          body={error}
          action="Try again"
          onAction={refresh}
          colors={colors}
        />
      ) : null}

      {!loading && !error && calendar ? (
        <>
          <KindFilters
            activeKind={activeKind}
            onSelect={setActiveKind}
            colors={colors}
          />
          <MonthGrid
            month={month}
            selectedDate={selectedDate}
            today={dateKey(today)}
            items={filteredItems}
            onSelect={setSelectedDate}
            colors={colors}
          />
          <Agenda
            selectedDate={selectedDate}
            items={selectedItems}
            hasHousehold={calendar.households.length > 0}
            onAdd={() => setShowCreate(true)}
            colors={colors}
          />
        </>
      ) : null}

      {calendar ? (
        <CreateScheduleModal
          visible={showCreate}
          selectedDate={selectedDate}
          calendar={calendar}
          onClose={() => setShowCreate(false)}
          onSaved={async () => {
            setShowCreate(false);
            await refresh();
          }}
          colors={colors}
        />
      ) : null}
    </KinlightScreen>
  );
}

function MonthHeader({
  month,
  onPrevious,
  onNext,
  onToday,
  colors,
}: {
  month: Date;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  colors: ColorsValue;
}) {
  const label = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(month);

  return (
    <View style={styles.monthHeader}>
      <View style={styles.monthTitleRow}>
        <Text style={[styles.monthTitle, { color: colors.text }]}>{label}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onToday}
          style={[styles.todayButton, { borderColor: colors.glassBorder }]}
        >
          <Text style={[styles.todayText, { color: colors.accent }]}>
            Today
          </Text>
        </Pressable>
      </View>
      <View style={styles.monthControls}>
        <IconButton
          icon="chevron-left"
          label="Previous month"
          onPress={onPrevious}
          colors={colors}
        />
        <IconButton
          icon="chevron-right"
          label="Next month"
          onPress={onNext}
          colors={colors}
        />
      </View>
    </View>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  colors,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  colors: ColorsValue;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        {
          backgroundColor: colors.glass,
          borderColor: colors.glassBorder,
          opacity: pressed ? 0.65 : 1,
        },
      ]}
    >
      <MaterialIcons name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

function KindFilters({
  activeKind,
  onSelect,
  colors,
}: {
  activeKind: CalendarKind;
  onSelect: (kind: CalendarKind) => void;
  colors: ColorsValue;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRow}
    >
      {kinds.map((kind) => {
        const selected = activeKind === kind;
        return (
          <Pressable
            key={kind}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onSelect(kind)}
            style={[
              styles.filterChip,
              {
                backgroundColor: selected ? colors.primary : colors.glass,
                borderColor: selected ? colors.primary : colors.glassBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.filterText,
                { color: selected ? colors.background : colors.textMuted },
              ]}
            >
              {kindLabels[kind]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function MonthGrid({
  month,
  selectedDate,
  today,
  items,
  onSelect,
  colors,
}: {
  month: Date;
  selectedDate: string;
  today: string;
  items: CareScheduleItem[];
  onSelect: (date: string) => void;
  colors: ColorsValue;
}) {
  const range = calendarRange(month);
  const cells = Array.from({ length: 42 }, (_, index) =>
    addDays(range.start, index),
  );

  return (
    <View
      style={[
        styles.calendar,
        Shadow,
        { backgroundColor: colors.glass, borderColor: colors.glassBorder },
      ]}
    >
      <View style={styles.weekRow}>
        {weekDays.map((day, index) => (
          <Text
            key={`${day}-${index}`}
            style={[styles.weekDay, { color: colors.textMuted }]}
          >
            {day}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((date) => {
          const key = dateKey(date);
          const selected = key === selectedDate;
          const isToday = key === today;
          const inMonth = date.getUTCMonth() === month.getUTCMonth();
          const dayItems = items.filter(
            (item) => item.startsAt.slice(0, 10) === key,
          );
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={new Intl.DateTimeFormat("en-US", {
                dateStyle: "full",
                timeZone: "UTC",
              }).format(date)}
              accessibilityState={{ selected }}
              onPress={() => onSelect(key)}
              style={[
                styles.dayCell,
                selected && { backgroundColor: colors.primary },
              ]}
            >
              <View
                style={[
                  styles.dayNumberWrap,
                  isToday && !selected && { borderColor: colors.accent },
                ]}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    {
                      color: selected
                        ? colors.background
                        : inMonth
                          ? colors.text
                          : colors.textMuted,
                      opacity: inMonth || selected ? 1 : 0.48,
                    },
                  ]}
                >
                  {date.getUTCDate()}
                </Text>
              </View>
              <View style={styles.dots}>
                {dayItems.slice(0, 3).map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: selected
                          ? colors.background
                          : kindMeta[item.kind].color,
                      },
                    ]}
                  />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Agenda({
  selectedDate,
  items,
  hasHousehold,
  onAdd,
  colors,
}: {
  selectedDate: string;
  items: CareScheduleItem[];
  hasHousehold: boolean;
  onAdd: () => void;
  colors: ColorsValue;
}) {
  const label = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(dateFromKey(selectedDate));

  return (
    <View style={styles.agendaSection}>
      <View style={styles.agendaHeader}>
        <View style={styles.agendaTitleWrap}>
          <Text style={[styles.agendaEyebrow, { color: colors.accent }]}>
            AGENDA
          </Text>
          <Text style={[styles.agendaTitle, { color: colors.text }]}>
            {label}
          </Text>
        </View>
        {hasHousehold ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAdd}
            style={[styles.smallAdd, { backgroundColor: colors.glassStrong }]}
          >
            <MaterialIcons name="add" size={18} color={colors.primary} />
            <Text style={[styles.smallAddText, { color: colors.primary }]}>
              Add
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View
        style={[
          styles.agendaList,
          Shadow,
          { backgroundColor: colors.glass, borderColor: colors.glassBorder },
        ]}
      >
        {items.length ? (
          items.map((item) => (
            <AgendaItem key={item.id} item={item} colors={colors} />
          ))
        ) : (
          <View style={styles.emptyAgenda}>
            <MaterialIcons
              name={hasHousehold ? "event-available" : "group-add"}
              size={28}
              color={colors.icon}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {hasHousehold ? "A clear day" : "No household calendar yet"}
            </Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
              {hasHousehold
                ? "Nothing is scheduled. Add a plan when your family needs one."
                : "Create or join a household to start planning together."}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function AgendaItem({
  item,
  colors,
}: {
  item: CareScheduleItem;
  colors: ColorsValue;
}) {
  const meta = kindMeta[item.kind];
  const [expanded, setExpanded] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={() => setExpanded((value) => !value)}
      style={[styles.agendaItem, { borderBottomColor: colors.border }]}
    >
      <View style={[styles.agendaIcon, { backgroundColor: meta.color }]}>
        <MaterialIcons name={meta.icon} size={20} color={Palette.navy950} />
      </View>
      <View style={styles.agendaCopy}>
        <View style={styles.agendaItemTop}>
          <Text style={[styles.itemTitle, { color: colors.text }]}>
            {item.title}
          </Text>
          <Text style={[styles.itemTime, { color: colors.textMuted }]}>
            {formatTime(item)}
          </Text>
        </View>
        <Text style={[styles.itemMeta, { color: colors.textMuted }]}>
          {[meta.label, item.recipientName, item.detail]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        {expanded && item.details.length ? (
          <View style={styles.details}>
            {item.details.map((detail) => (
              <View
                key={`${detail.label}-${detail.value}`}
                style={styles.detailRow}
              >
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                  {detail.label}
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {detail.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <MaterialIcons
        name={expanded ? "expand-less" : "expand-more"}
        size={20}
        color={colors.icon}
      />
    </Pressable>
  );
}

function CreateScheduleModal({
  visible,
  selectedDate,
  calendar,
  onClose,
  onSaved,
  colors,
}: {
  visible: boolean;
  selectedDate: string;
  calendar: CareScheduleRangeResponse;
  onClose: () => void;
  onSaved: () => Promise<void>;
  colors: ColorsValue;
}) {
  const [kind, setKind] = useState<CreateKind>("event");
  const [householdId, setHouseholdId] = useState(
    calendar.households[0]?.id ?? "",
  );
  const [recipientId, setRecipientId] = useState<string | undefined>();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(selectedDate);
  const [time, setTime] = useState("09:00");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) setDate(selectedDate);
  }, [selectedDate, visible]);

  const valid =
    householdId.length > 0 &&
    title.trim().length > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(time) &&
    !saving;

  async function save() {
    if (!valid) return;
    setSaving(true);
    setError(null);
    const common = {
      householdId,
      recipientId,
      title: title.trim(),
      date,
      time,
      notes: notes.trim() || undefined,
    };
    let input: CreateCareScheduleRequest;
    if (kind === "event") input = { ...common, type: kind, isAllDay: false };
    else if (kind === "appointment") input = { ...common, type: kind };
    else if (kind === "medication") input = { ...common, type: kind };
    else input = { ...common, type: kind, mealType: "meal" };

    try {
      await createMobileApiClient().schedule.create(input);
      setTitle("");
      setNotes("");
      await onSaved();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.modalSafe, { backgroundColor: colors.background }]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalFlex}
        >
          <View
            style={[styles.modalHeader, { borderBottomColor: colors.border }]}
          >
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <Text style={[styles.modalCancel, { color: colors.textMuted }]}>
                Cancel
              </Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Add to calendar
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !valid }}
              disabled={!valid}
              onPress={() => void save()}
              hitSlop={8}
            >
              {saving ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text
                  style={[
                    styles.modalSave,
                    { color: colors.accent, opacity: valid ? 1 : 0.4 },
                  ]}
                >
                  Save
                </Text>
              )}
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.form}
          >
            <FormLabel text="Kind" colors={colors} />
            <View style={styles.createKinds}>
              {createKinds.map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: kind === value }}
                  onPress={() => setKind(value)}
                  style={[
                    styles.createKind,
                    {
                      backgroundColor:
                        kind === value ? colors.primary : colors.glass,
                      borderColor:
                        kind === value ? colors.primary : colors.glassBorder,
                    },
                  ]}
                >
                  <MaterialIcons
                    name={kindMeta[value].icon}
                    size={19}
                    color={kind === value ? colors.background : colors.text}
                  />
                  <Text
                    style={[
                      styles.createKindText,
                      {
                        color: kind === value ? colors.background : colors.text,
                      },
                    ]}
                  >
                    {kindMeta[value].label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {calendar.households.length > 1 ? (
              <>
                <FormLabel text="Household" colors={colors} />
                <ChipRow>
                  {calendar.households.map((household) => (
                    <ChoiceChip
                      key={household.id}
                      label={household.name}
                      selected={householdId === household.id}
                      onPress={() => {
                        setHouseholdId(household.id);
                        setRecipientId(undefined);
                      }}
                      colors={colors}
                    />
                  ))}
                </ChipRow>
              </>
            ) : null}

            <FormLabel text="Care recipient" colors={colors} />
            <ChipRow>
              <ChoiceChip
                label="Household-wide"
                selected={!recipientId}
                onPress={() => setRecipientId(undefined)}
                colors={colors}
              />
              {calendar.recipients
                .filter((recipient) => recipient.householdId === householdId)
                .map((recipient) => (
                  <ChoiceChip
                    key={recipient.id}
                    label={recipient.name}
                    selected={recipientId === recipient.id}
                    onPress={() => setRecipientId(recipient.id)}
                    colors={colors}
                  />
                ))}
            </ChipRow>

            <FormLabel text="Title" colors={colors} />
            <FormInput
              value={title}
              onChangeText={setTitle}
              placeholder="What is planned?"
              colors={colors}
            />
            <View style={styles.dateTimeRow}>
              <View style={styles.formColumn}>
                <FormLabel text="Date" colors={colors} />
                <FormInput
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                  colors={colors}
                />
              </View>
              <View style={styles.formColumn}>
                <FormLabel text="Time" colors={colors} />
                <FormInput
                  value={time}
                  onChangeText={setTime}
                  placeholder="HH:MM"
                  colors={colors}
                />
              </View>
            </View>
            <FormLabel text="Notes" colors={colors} />
            <FormInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional details"
              multiline
              colors={colors}
            />
            {error ? (
              <Text
                accessibilityRole="alert"
                style={[styles.formError, { color: colors.danger }]}
              >
                {error}
              </Text>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function FormLabel({ text, colors }: { text: string; colors: ColorsValue }) {
  return <Text style={[styles.formLabel, { color: colors.text }]}>{text}</Text>;
}

function FormInput({
  colors,
  multiline,
  ...props
}: ComponentProps<typeof TextInput> & {
  colors: ColorsValue;
}) {
  return (
    <TextInput
      {...props}
      multiline={multiline}
      placeholderTextColor={colors.textMuted}
      style={[
        styles.input,
        multiline && styles.notesInput,
        {
          backgroundColor: colors.glassStrong,
          borderColor: colors.glassBorder,
          color: colors.text,
        },
      ]}
    />
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      {children}
    </ScrollView>
  );
}

function ChoiceChip({
  label,
  selected,
  onPress,
  colors,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: ColorsValue;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.choiceChip,
        {
          backgroundColor: selected ? colors.primary : colors.glass,
          borderColor: selected ? colors.primary : colors.glassBorder,
        },
      ]}
    >
      <Text
        style={[
          styles.choiceText,
          { color: selected ? colors.background : colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
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
      <MaterialIcons name={icon} size={30} color={colors.primary} />
      <Text style={[styles.messageTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.messageBody, { color: colors.textMuted }]}>
        {body}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onAction}
        style={[styles.retryButton, { backgroundColor: colors.primary }]}
      >
        <Text style={[styles.retryText, { color: colors.background }]}>
          {action}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  loading: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  loadingText: { ...Type.body },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  monthTitleRow: { flex: 1, gap: Spacing.sm },
  monthTitle: { ...Type.heading },
  todayButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  todayText: { ...Type.caption },
  monthControls: { flexDirection: "row", gap: Spacing.sm },
  iconButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  filterRow: { gap: Spacing.sm },
  filterChip: {
    minHeight: 38,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
  },
  filterText: { ...Type.caption },
  calendar: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    overflow: "hidden",
  },
  weekRow: { flexDirection: "row", height: 28 },
  weekDay: { ...Type.caption, width: "14.2857%", textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: "14.2857%",
    height: 52,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  dayNumberWrap: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumber: { ...Type.caption },
  dots: { height: 4, flexDirection: "row", gap: 2 },
  dot: { width: 4, height: 4, borderRadius: Radius.pill },
  agendaSection: { gap: Spacing.md },
  agendaHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  agendaTitleWrap: { flex: 1, gap: Spacing.xs },
  agendaEyebrow: { ...Type.caption },
  agendaTitle: { ...Type.heading },
  smallAdd: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
  },
  smallAddText: { ...Type.label },
  agendaList: { borderWidth: 1, borderRadius: Radius.lg, overflow: "hidden" },
  agendaItem: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
  },
  agendaIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  agendaCopy: { flex: 1, gap: Spacing.xs },
  agendaItemTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  itemTitle: { ...Type.label, flex: 1 },
  itemTime: { ...Type.caption },
  itemMeta: { ...Type.caption },
  details: { gap: Spacing.sm, paddingTop: Spacing.sm },
  detailRow: { flexDirection: "row", gap: Spacing.md },
  detailLabel: { ...Type.caption, width: 88 },
  detailValue: { ...Type.caption, flex: 1 },
  emptyAgenda: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  emptyTitle: { ...Type.heading, textAlign: "center" },
  emptyBody: { ...Type.body, textAlign: "center" },
  message: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
  },
  messageTitle: { ...Type.heading, textAlign: "center" },
  messageBody: { ...Type.body, textAlign: "center" },
  retryButton: {
    alignSelf: "stretch",
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },
  retryText: { ...Type.label },
  modalSafe: { flex: 1 },
  modalFlex: { flex: 1 },
  modalHeader: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.xl,
  },
  modalCancel: { ...Type.label },
  modalTitle: { ...Type.heading },
  modalSave: { ...Type.label },
  form: { padding: Spacing.xl, paddingBottom: Spacing["3xl"], gap: Spacing.md },
  formLabel: { ...Type.label },
  createKinds: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  createKind: {
    width: "48%",
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  createKindText: { ...Type.caption },
  chipRow: { gap: Spacing.sm },
  choiceChip: {
    minHeight: 40,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
  },
  choiceText: { ...Type.label },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    ...Type.body,
  },
  notesInput: {
    minHeight: 110,
    paddingTop: Spacing.md,
    textAlignVertical: "top",
  },
  dateTimeRow: { flexDirection: "row", gap: Spacing.md },
  formColumn: { flex: 1, gap: Spacing.md },
  formError: { ...Type.label },
});
