import { CalendarBoard } from "@/components/calendar/calendar-board";
import { getCareScheduleForRange } from "@/lib/care-schedule";
import { createKinlightServerComponentClient } from "@/lib/supabase/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import styles from "./calendar.module.scss";

export const metadata: Metadata = {
  title: "Calendar",
};

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function requestedMonth(value?: string) {
  if (value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    const [year, month] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, 1));
  }

  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function monthHref(date: Date) {
  return `/calendar?month=${dateKey(date).slice(0, 7)}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const monthStart = requestedMonth(month);
  const gridStart = new Date(monthStart);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());
  const gridEnd = new Date(gridStart);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + 42);
  const supabase = await createKinlightServerComponentClient();
  const [schedule, householdsResult, recipientsResult] = await Promise.all([
    getCareScheduleForRange(gridStart, gridEnd),
    supabase.from("households").select("id, name").order("name"),
    supabase
      .from("care_recipients")
      .select("id, household_id, first_name, preferred_name")
      .eq("is_active", true)
      .order("first_name"),
  ]);
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(date.getUTCDate() + index);
    return dateKey(date);
  });
  const todayKey = dateKey(new Date());
  const selectedDate = days.includes(todayKey) ? todayKey : dateKey(monthStart);
  const households = (householdsResult.data ?? []).map((household) => ({
    id: household.id,
    name: household.name,
  }));
  const recipients = (recipientsResult.data ?? []).map((recipient) => ({
    id: recipient.id,
    householdId: recipient.household_id,
    name: recipient.preferred_name ?? recipient.first_name,
  }));
  const previousMonth = new Date(monthStart);
  previousMonth.setUTCMonth(previousMonth.getUTCMonth() - 1);
  const nextMonth = new Date(monthStart);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);

  return (
    <main className={styles.calendarPage}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Care calendar</p>
          <h1>
            {new Intl.DateTimeFormat("en-US", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }).format(monthStart)}
          </h1>
          <p>
            Appointments, events, medication, and eating reminders in one place.
          </p>
        </div>
        <div className={styles.monthControls}>
          <Link
            href={monthHref(previousMonth)}
            aria-label="Previous month"
            title="Previous month"
          >
            <ChevronLeft size={19} aria-hidden />
          </Link>
          <a href="/calendar" className={styles.todayButton}>
            Today
          </a>
          <Link
            href={monthHref(nextMonth)}
            aria-label="Next month"
            title="Next month"
          >
            <ChevronRight size={19} aria-hidden />
          </Link>
        </div>
      </header>

      <CalendarBoard
        days={days}
        month={monthStart.getUTCMonth()}
        today={todayKey}
        initialSelectedDate={selectedDate}
        initialItems={schedule}
        households={households}
        recipients={recipients}
      />
    </main>
  );
}
