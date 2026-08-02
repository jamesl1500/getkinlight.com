import { createKinlightServerComponentClient } from "@/lib/supabase/server";
import { CareScheduleList } from "@/components/dashboard/care-schedule-list";
import { DailyAiBrief } from "@/components/dashboard/daily-ai-brief";
import { getCareScheduleForDate } from "@/lib/care-schedule";
import {
  CalendarDays,
  Check,
  HeartHandshake,
  LockKeyhole,
  UserRound,
} from "lucide-react";
import type { Metadata } from "next";
import styles from "./dashboard.module.scss";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const supabase = await createKinlightServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("first_name, last_name, username, role")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const firstName = profile?.first_name ?? "there";
  const role = profile?.role?.replaceAll("_", " ") ?? "Family member";
  let householdId: string | null = null;

  if (user) {
    const { data: household, error: householdError } = await supabase
      .from("households")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (householdError) {
      throw householdError;
    }

    if (!household) {
      const householdName = profile?.first_name
        ? `${profile.first_name}'s Household`
        : "My Household";
      const { data: createdHousehold, error: createHouseholdError } =
        await supabase
          .from("households")
          .insert({
            name: householdName,
            created_by: user.id,
          })
          .select("id")
          .single();

      if (createHouseholdError) {
        throw createHouseholdError;
      }
      householdId = createdHousehold.id;
    } else {
      householdId = household.id;
    }
  }

  const careSchedule = await getCareScheduleForDate(new Date());
  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <main className={styles.dashboard}>
      <header className={styles.welcome}>
        <div>
          <p className={styles.date}>{today}</p>
          <h1>Welcome back, {firstName}.</h1>
          <p className={styles.intro}>
            Here is what is happening with your family today.
          </p>
        </div>
        <div className={styles.secureBadge}>
          <LockKeyhole size={15} aria-hidden />
          Private family space
        </div>
      </header>

      {householdId && <DailyAiBrief householdId={householdId} />}

      <section className={styles.summaryGrid} aria-label="Account summary">
        <article className={`${styles.summaryCard} ${styles.profileCard}`}>
          <div className={styles.cardIcon}>
            <UserRound size={20} aria-hidden />
          </div>
          <div>
            <p className={styles.cardLabel}>Your profile</p>
            <p className={styles.cardValue}>
              {profile?.first_name} {profile?.last_name}
            </p>
            <p className={styles.cardMeta}>@{profile?.username}</p>
          </div>
        </article>

        <article className={styles.summaryCard}>
          <div className={styles.cardIcon}>
            <HeartHandshake size={20} aria-hidden />
          </div>
          <div>
            <p className={styles.cardLabel}>Family role</p>
            <p className={styles.cardValue}>{role}</p>
            <p className={styles.cardMeta}>Profile complete</p>
          </div>
          <span className={styles.checkMark} aria-label="Complete">
            <Check size={14} aria-hidden />
          </span>
        </article>

        <article className={`${styles.summaryCard} ${styles.securityCard}`}>
          <div className={styles.cardIcon}>
            <LockKeyhole size={20} aria-hidden />
          </div>
          <div>
            <p className={styles.cardLabel}>Account</p>
            <p className={styles.cardValue}>Protected</p>
            <p className={styles.cardMeta}>Email verified</p>
          </div>
        </article>
      </section>

      <section className={styles.contentGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Today</p>
              <h2>Care schedule</h2>
            </div>
            <CalendarDays size={20} aria-hidden />
          </div>
          <CareScheduleList items={careSchedule} />
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Family circle</p>
              <h2>Recent updates</h2>
            </div>
            <HeartHandshake size={20} aria-hidden />
          </div>
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>
              <HeartHandshake size={22} aria-hidden />
            </span>
            <h3>All quiet for now</h3>
            <p>New notes and check-ins from your family will collect here.</p>
          </div>
        </article>
      </section>
    </main>
  );
}
