import { createKinlightServerComponentClient } from "@/lib/supabase/server";

export type CareScheduleItem = {
  id: string;
  sourceId: string;
  householdId: string;
  recipientId: string | null;
  kind: "appointment" | "event" | "medication" | "meal";
  title: string;
  detail: string | null;
  recipientName: string | null;
  startsAt: string;
  isAllDay: boolean;
  details: Array<{ label: string; value: string }>;
};

type Recipient = {
  first_name: string;
  preferred_name: string | null;
};

type TimedRow = {
  id: string;
  household_id: string;
  care_recipient_id: string | null;
  title: string;
  starts_at: string;
  location: string | null;
  is_all_day?: boolean;
  provider_name?: string | null;
  description?: string | null;
  ends_at?: string | null;
  specialty?: string | null;
  status?: string;
  preparation_notes?: string | null;
  transportation_notes?: string | null;
  households: { name: string } | { name: string }[] | null;
  care_recipients: Recipient | Recipient[] | null;
};

type ReminderRow = {
  id: string;
  household_id: string;
  care_recipient_id: string | null;
  title?: string;
  medication_name?: string;
  dosage?: string | null;
  meal_type?: string;
  reminder_times: string[];
  days_of_week: number[];
  instructions?: string | null;
  starts_on: string;
  ends_on: string | null;
  timezone: string;
  households: { name: string } | { name: string }[] | null;
  care_recipients: Recipient | Recipient[] | null;
};

function relatedName(relation: { name: string } | { name: string }[] | null) {
  return Array.isArray(relation)
    ? (relation[0]?.name ?? null)
    : (relation?.name ?? null);
}

function detailRows(entries: Array<[string, string | null | undefined]>) {
  return entries.flatMap(([label, value]) => (value ? [{ label, value }] : []));
}

function recurrenceLabel(
  daysOfWeek: number[],
  startsOn: string,
  endsOn: string | null,
) {
  if (startsOn === endsOn) return "One time";
  if (daysOfWeek.length === 0) return "Every day";
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return daysOfWeek
    .map((day) => dayNames[day])
    .filter(Boolean)
    .join(", ");
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function recipientName(recipient: Recipient | Recipient[] | null) {
  const person = Array.isArray(recipient) ? recipient[0] : recipient;
  return person ? (person.preferred_name ?? person.first_name) : null;
}

function reminderOccursOn(row: ReminderRow, date: Date) {
  return (
    row.days_of_week.length === 0 || row.days_of_week.includes(date.getUTCDay())
  );
}

function reminderItems(
  rows: ReminderRow[],
  dates: Date[],
  kind: "medication" | "meal",
): CareScheduleItem[] {
  return dates.flatMap((date) =>
    rows
      .filter((row) => reminderOccursOn(row, date))
      .flatMap((row) =>
        row.reminder_times.map((time) => ({
          id: `${kind}-${row.id}-${dateKey(date)}-${time}`,
          sourceId: row.id,
          householdId: row.household_id,
          recipientId: row.care_recipient_id,
          kind,
          title:
            kind === "medication"
              ? (row.medication_name ?? "Medication")
              : (row.title ?? "Meal reminder"),
          detail:
            kind === "medication"
              ? (row.dosage ?? null)
              : (row.meal_type?.replaceAll("_", " ") ?? null),
          recipientName: recipientName(row.care_recipients),
          startsAt: `${dateKey(date)}T${time}Z`,
          isAllDay: false,
          details: detailRows([
            ["Household", relatedName(row.households)],
            [
              "Care recipient",
              recipientName(row.care_recipients) ?? "Household-wide",
            ],
            [
              kind === "medication" ? "Dosage" : "Reminder kind",
              kind === "medication"
                ? row.dosage
                : row.meal_type?.replaceAll("_", " "),
            ],
            ["Instructions", row.instructions],
            [
              "Repeats",
              recurrenceLabel(row.days_of_week, row.starts_on, row.ends_on),
            ],
            ["Reminder times", row.reminder_times.join(", ")],
            ["Schedule starts", row.starts_on],
            ["Schedule ends", row.ends_on],
            ["Timezone", row.timezone],
          ]),
        })),
      ),
  );
}

function datesInRange(start: Date, end: Date) {
  const dates: Date[] = [];
  const cursor = new Date(start);

  while (cursor < end) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

export async function getCareScheduleForRange(
  start: Date,
  end: Date,
): Promise<CareScheduleItem[]> {
  const supabase = await createKinlightServerComponentClient();
  const startDay = dateKey(start);
  const endDay = dateKey(end);
  const finalDay = new Date(end);
  finalDay.setUTCDate(finalDay.getUTCDate() - 1);
  const recipientSelect = "care_recipients(first_name, preferred_name)";
  const householdSelect = "households(name)";

  const [eventsResult, appointmentsResult, medicationResult, eatingResult] =
    await Promise.all([
      supabase
        .from("household_events")
        .select(
          `id, household_id, care_recipient_id, title, description, starts_at, ends_at, location, is_all_day, ${householdSelect}, ${recipientSelect}`,
        )
        .gte("starts_at", `${startDay}T00:00:00.000Z`)
        .lt("starts_at", `${endDay}T00:00:00.000Z`),
      supabase
        .from("appointments")
        .select(
          `id, household_id, care_recipient_id, title, provider_name, specialty, location, starts_at, ends_at, status, preparation_notes, transportation_notes, ${householdSelect}, ${recipientSelect}`,
        )
        .neq("status", "cancelled")
        .gte("starts_at", `${startDay}T00:00:00.000Z`)
        .lt("starts_at", `${endDay}T00:00:00.000Z`),
      supabase
        .from("medication_reminders")
        .select(
          `id, household_id, care_recipient_id, medication_name, dosage, instructions, starts_on, ends_on, reminder_times, days_of_week, timezone, ${householdSelect}, ${recipientSelect}`,
        )
        .eq("is_active", true)
        .lte("starts_on", dateKey(finalDay))
        .or(`ends_on.is.null,ends_on.gte.${startDay}`),
      supabase
        .from("eating_reminders")
        .select(
          `id, household_id, care_recipient_id, title, meal_type, instructions, starts_on, ends_on, reminder_times, days_of_week, timezone, ${householdSelect}, ${recipientSelect}`,
        )
        .eq("is_active", true)
        .lte("starts_on", dateKey(finalDay))
        .or(`ends_on.is.null,ends_on.gte.${startDay}`),
    ]);

  const events = (eventsResult.data ?? []).map((row) => {
    const event = row as TimedRow;
    return {
      id: `event-${event.id}`,
      sourceId: event.id,
      householdId: event.household_id,
      recipientId: event.care_recipient_id,
      kind: "event" as const,
      title: event.title,
      detail: event.location,
      recipientName: recipientName(event.care_recipients),
      startsAt: event.starts_at,
      isAllDay: event.is_all_day ?? false,
      details: detailRows([
        ["Household", relatedName(event.households)],
        [
          "Care recipient",
          recipientName(event.care_recipients) ?? "Household-wide",
        ],
        ["Location", event.location],
        ["Description", event.description],
        ["Ends", event.ends_at],
      ]),
    };
  });
  const appointments = (appointmentsResult.data ?? []).map((row) => {
    const appointment = row as TimedRow;
    return {
      id: `appointment-${appointment.id}`,
      sourceId: appointment.id,
      householdId: appointment.household_id,
      recipientId: appointment.care_recipient_id,
      kind: "appointment" as const,
      title: appointment.title,
      detail: appointment.provider_name ?? appointment.location,
      recipientName: recipientName(appointment.care_recipients),
      startsAt: appointment.starts_at,
      isAllDay: false,
      details: detailRows([
        ["Household", relatedName(appointment.households)],
        [
          "Care recipient",
          recipientName(appointment.care_recipients) ?? "Household-wide",
        ],
        ["Provider", appointment.provider_name],
        ["Specialty", appointment.specialty],
        ["Location", appointment.location],
        ["Status", appointment.status?.replaceAll("_", " ")],
        ["Ends", appointment.ends_at],
        ["Preparation notes", appointment.preparation_notes],
        ["Transportation notes", appointment.transportation_notes],
      ]),
    };
  });

  return [
    ...events,
    ...appointments,
    ...reminderItems(
      (medicationResult.data ?? []) as ReminderRow[],
      datesInRange(start, end),
      "medication",
    ),
    ...reminderItems(
      (eatingResult.data ?? []) as ReminderRow[],
      datesInRange(start, end),
      "meal",
    ),
  ].sort((left, right) => left.startsAt.localeCompare(right.startsAt));
}

export async function getCareScheduleForDate(
  date: Date,
): Promise<CareScheduleItem[]> {
  const start = new Date(`${dateKey(date)}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return getCareScheduleForRange(start, end);
}
