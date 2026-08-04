import { getCareScheduleForRange } from "@/lib/care-schedule";
import { createKinlightServerComponentClient } from "@/lib/supabase/server";
import type {
  CareCheckIn,
  CareNote,
  CareRecipient,
  CareWorkspaceResponse,
  EatingReminder,
  MedicationReminder,
} from "@getkinlight.com/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export type {
  CareCheckIn,
  CareNote,
  CareRecipient,
  EatingReminder,
  MedicationReminder,
};

export type CareWorkspaceData = Omit<CareWorkspaceResponse, "ok" | "message">;

export async function getCareWorkspaceData(
  requestedRecipientId?: string,
  client?: SupabaseClient,
): Promise<CareWorkspaceData> {
  const supabase = client ?? (await createKinlightServerComponentClient());
  const [householdsResult, recipientsResult] = await Promise.all([
    supabase.from("households").select("id, name").order("name"),
    supabase
      .from("care_recipients")
      .select(
        "id, household_id, first_name, last_name, preferred_name, date_of_birth, relationship, care_preferences, is_active",
      )
      .order("first_name"),
  ]);

  if (householdsResult.error) throw householdsResult.error;
  if (recipientsResult.error) throw recipientsResult.error;

  const recipients = (recipientsResult.data ?? []).map((recipient) => ({
    id: recipient.id,
    householdId: recipient.household_id,
    firstName: recipient.first_name,
    lastName: recipient.last_name,
    preferredName: recipient.preferred_name,
    dateOfBirth: recipient.date_of_birth,
    relationship: recipient.relationship,
    carePreferences: recipient.care_preferences,
    isActive: recipient.is_active,
  }));
  const selectedRecipient =
    recipients.find((recipient) => recipient.id === requestedRecipientId) ??
    recipients.find((recipient) => recipient.isActive) ??
    recipients[0] ??
    null;

  if (!selectedRecipient) {
    return {
      households: householdsResult.data ?? [],
      recipients,
      selectedRecipient: null,
      medications: [],
      eatingReminders: [],
      checkIns: [],
      notes: [],
      schedule: [],
    };
  }

  const scheduleStart = new Date();
  scheduleStart.setUTCHours(0, 0, 0, 0);
  const scheduleEnd = new Date(scheduleStart);
  scheduleEnd.setUTCDate(scheduleEnd.getUTCDate() + 14);
  const [
    medicationsResult,
    eatingResult,
    checkInsResult,
    notesResult,
    householdSchedule,
  ] = await Promise.all([
    supabase
      .from("medication_reminders")
      .select(
        "id, medication_name, dosage, instructions, starts_on, ends_on, reminder_times, days_of_week, is_active",
      )
      .eq("care_recipient_id", selectedRecipient.id)
      .order("medication_name"),
    supabase
      .from("eating_reminders")
      .select("id, title, meal_type, reminder_times, is_active")
      .eq("care_recipient_id", selectedRecipient.id)
      .order("title"),
    supabase
      .from("household_check_ins")
      .select("id, status, mood, summary, occurred_at")
      .eq("care_recipient_id", selectedRecipient.id)
      .order("occurred_at", { ascending: false })
      .limit(50),
    supabase
      .from("household_notes")
      .select("id, title, body, is_pinned, created_at")
      .eq("care_recipient_id", selectedRecipient.id)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
    getCareScheduleForRange(scheduleStart, scheduleEnd, supabase),
  ]);

  const queryError =
    medicationsResult.error ??
    eatingResult.error ??
    checkInsResult.error ??
    notesResult.error;
  if (queryError) throw queryError;

  return {
    households: householdsResult.data ?? [],
    recipients,
    selectedRecipient,
    medications: (medicationsResult.data ?? []).map((item) => ({
      id: item.id,
      medicationName: item.medication_name,
      dosage: item.dosage,
      instructions: item.instructions,
      startsOn: item.starts_on,
      endsOn: item.ends_on,
      reminderTimes: item.reminder_times,
      daysOfWeek: item.days_of_week,
      isActive: item.is_active,
    })),
    eatingReminders: (eatingResult.data ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      mealType: item.meal_type,
      reminderTimes: item.reminder_times,
      isActive: item.is_active,
    })),
    checkIns: (checkInsResult.data ?? []).map((item) => ({
      id: item.id,
      status: item.status as CareCheckIn["status"],
      mood: item.mood,
      summary: item.summary,
      occurredAt: item.occurred_at,
    })),
    notes: (notesResult.data ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      isPinned: item.is_pinned,
      createdAt: item.created_at,
    })),
    schedule: householdSchedule.filter(
      (item) => item.recipientId === selectedRecipient.id,
    ),
  };
}
