import { createKinlightServerClient } from "@getkinlight.com/shared";

type KinlightServerClient = ReturnType<typeof createKinlightServerClient>;

export async function getHouseholdAiContext(
  supabase: KinlightServerClient,
  householdId: string,
) {
  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - 30);
  const rangeEnd = new Date(now);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 30);

  const [
    household,
    recipients,
    events,
    appointments,
    medications,
    meals,
    checkIns,
    notes,
  ] = await Promise.all([
    supabase
      .from("households")
      .select("id, name")
      .eq("id", householdId)
      .single(),
    supabase
      .from("care_recipients")
      .select(
        "id, first_name, last_name, preferred_name, relationship, care_preferences, is_active",
      )
      .eq("household_id", householdId)
      .order("first_name"),
    supabase
      .from("household_events")
      .select(
        "id, care_recipient_id, title, description, starts_at, ends_at, location, is_all_day",
      )
      .eq("household_id", householdId)
      .gte("starts_at", rangeStart.toISOString())
      .lte("starts_at", rangeEnd.toISOString())
      .order("starts_at"),
    supabase
      .from("appointments")
      .select(
        "id, care_recipient_id, title, provider_name, specialty, location, starts_at, ends_at, status, preparation_notes, transportation_notes",
      )
      .eq("household_id", householdId)
      .gte("starts_at", rangeStart.toISOString())
      .lte("starts_at", rangeEnd.toISOString())
      .neq("status", "cancelled")
      .order("starts_at"),
    supabase
      .from("medication_reminders")
      .select(
        "id, care_recipient_id, medication_name, dosage, instructions, starts_on, ends_on, reminder_times, days_of_week, is_active",
      )
      .eq("household_id", householdId)
      .eq("is_active", true)
      .order("medication_name"),
    supabase
      .from("eating_reminders")
      .select(
        "id, care_recipient_id, title, meal_type, instructions, starts_on, ends_on, reminder_times, days_of_week, is_active",
      )
      .eq("household_id", householdId)
      .eq("is_active", true)
      .order("title"),
    supabase
      .from("household_check_ins")
      .select("id, care_recipient_id, status, mood, summary, occurred_at")
      .eq("household_id", householdId)
      .order("occurred_at", { ascending: false })
      .limit(40),
    supabase
      .from("household_notes")
      .select(
        "id, care_recipient_id, title, body, is_pinned, created_at, updated_at",
      )
      .eq("household_id", householdId)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  if (household.error) throw household.error;
  const queryError =
    recipients.error ??
    events.error ??
    appointments.error ??
    medications.error ??
    meals.error ??
    checkIns.error ??
    notes.error;
  if (queryError) throw queryError;

  return {
    generatedAt: now.toISOString(),
    household: household.data,
    recipients: recipients.data ?? [],
    schedule: {
      events: events.data ?? [],
      appointments: appointments.data ?? [],
      medications: medications.data ?? [],
      meals: meals.data ?? [],
    },
    checkIns: checkIns.data ?? [],
    notes: notes.data ?? [],
  };
}

export type HouseholdAiContext = Awaited<
  ReturnType<typeof getHouseholdAiContext>
>;
