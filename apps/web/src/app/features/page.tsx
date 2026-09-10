import type { Metadata } from "next";
import {
  Bell,
  CalendarDays,
  ClipboardList,
  Heart,
  Lock,
  MessageCircle,
  Package,
  Sparkles,
  UsersRound,
} from "lucide-react";

import { CtaBand } from "@/components/marketing/cta-band";
import { MarketingPage } from "@/components/marketing/decor";
import styles from "@/styles/pages/marketing/marketing.module.scss";

export const metadata: Metadata = {
  title: "Features",
  description:
    "The care timeline, shared schedule, tasks, supply list, household messages, and an optional AI brief — all in one private family space.",
};

const features = [
  {
    icon: Heart,
    title: "Care timeline",
    body: "Post check-ins, medications, moods, and notes with context, so relatives and caregivers stay in sync without repeated calls.",
  },
  {
    icon: CalendarDays,
    title: "Shared schedule",
    body: "Appointments, visits, and recurring routines in one calendar the whole household keeps current.",
  },
  {
    icon: ClipboardList,
    title: "Tasks with owners",
    body: "Assign the pharmacy run or the weekly call, track what's done, and see what's still open at a glance.",
  },
  {
    icon: Package,
    title: "Supply list",
    body: "Know what's running low and who is picking it up — from medical supplies to the small comforts that matter.",
  },
  {
    icon: MessageCircle,
    title: "Household messages",
    body: "A calm channel for the small updates that don't belong in a formal note but everyone should see.",
  },
  {
    icon: Sparkles,
    title: "Kinlight AI brief",
    body: "An optional daily summary that turns the week's updates into a few plain sentences. Opt-in, always yours to review.",
  },
  {
    icon: UsersRound,
    title: "Roles & permissions",
    body: "Owner, caregiver, and family-member access so help fits the person — bring in a neighbour without oversharing.",
  },
  {
    icon: Lock,
    title: "Private by design",
    body: "Every household is isolated with row-level security. Members only ever see their own family's data.",
  },
  {
    icon: Bell,
    title: "Gentle notifications",
    body: "Nudges for what matters most, with fewer noisy pings and better timing. Nothing that manufactures urgency.",
  },
];

export default function FeaturesPage() {
  return (
    <MarketingPage>
      <section className={styles.hero} style={{ gridTemplateColumns: "1fr" }}>
        <div className={`${styles.heroCopy} ${styles.reveal}`}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden />
            Features
          </p>
          <h1 className={styles.display}>Purpose-built for caring families</h1>
          <p className={styles.lead}>
            Kinlight keeps support practical and warm. You get structure for the
            important information, while your family gets an interface that
            feels easy and human.
          </p>
        </div>
      </section>

      <section>
        <div className={`${styles.grid} ${styles.grid3}`}>
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className={`${styles.card} ${styles.tile} ${styles.reveal} ${
                  styles[`d${(i % 3) + 1}` as keyof typeof styles]
                }`}
              >
                <span className={styles.tileIcon} aria-hidden>
                  <Icon size={22} aria-hidden />
                </span>
                <h2 className={styles.cardTitle}>{feature.title}</h2>
                <p className={styles.tileBody}>{feature.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <CtaBand
        eyebrow="See it live"
        title="See it in your own household"
        body="Create a free account, set up a household, and invite one other person. The difference shows up within a day."
      />
    </MarketingPage>
  );
}
