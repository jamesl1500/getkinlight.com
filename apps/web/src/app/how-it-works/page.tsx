import type { Metadata } from "next";
import {
  Bell,
  CalendarDays,
  Heart,
  Sparkles,
  UserPlus,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { CtaBand } from "@/components/marketing/cta-band";
import { MarketingPage } from "@/components/marketing/decor";
import styles from "@/styles/pages/marketing/marketing.module.scss";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Set up a household, invite the people who help, and let Kinlight keep the care timeline, schedule, and tasks in sync.",
};

const steps = [
  {
    title: "Create your household",
    body: "Sign up and set up a space for the person being cared for. Kinlight handles the profile, membership, and privacy scoping so you can start adding real information right away.",
  },
  {
    title: "Invite the people who help",
    body: "Add siblings, parents, and trusted caregivers by email. Give each person the access that fits — full partner, care-log contributor, or read-only family member.",
  },
  {
    title: "Log the day as it happens",
    body: "Check-ins, medications, moods, visits, and notes go into one shared timeline. A two-line update from your phone replaces a round of phone calls.",
  },
  {
    title: "Coordinate what's next",
    body: "Put appointments on the shared schedule, assign the tasks that come with them, and keep the supply list current so pickups don't get missed.",
  },
  {
    title: "Read the brief, not the backlog",
    body: "Turn on the optional Kinlight AI brief and each day starts with a few plain sentences: how things went, what's coming, what needs a decision. Always yours to review.",
  },
];

const dayItems = [
  {
    icon: Heart,
    time: "7:40am",
    label: "Morning check-in",
    detail: "Rested well, took all medications — logged by the night carer",
  },
  {
    icon: Bell,
    time: "9:00am",
    label: "Gentle reminder",
    detail: "Refill the blood pressure prescription — assigned to Sam",
  },
  {
    icon: CalendarDays,
    time: "2:30pm",
    label: "Physiotherapy",
    detail: "Priya is driving; back by 4pm",
  },
  {
    icon: Sparkles,
    time: "8:00pm",
    label: "Tomorrow's brief is ready",
    detail: "One new decision: confirm the weekend visit rota",
  },
];

const roles = [
  {
    icon: UsersRound,
    title: "Owner",
    body: "Manages the household, invites and removes members, sees everything. Usually the primary coordinator.",
  },
  {
    icon: UserPlus,
    title: "Caregiver",
    body: "Adds to the care log and schedule, completes tasks. Perfect for a hired carer or a hands-on relative.",
  },
  {
    icon: Heart,
    title: "Family member",
    body: "Follows updates and the schedule without editing records. Keeps distant relatives in the loop, calmly.",
  },
];

export default function HowItWorksPage() {
  return (
    <MarketingPage>
      <section className={styles.hero}>
        <div className={`${styles.heroCopy} ${styles.reveal}`}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden />
            How it works
          </p>
          <h1 className={styles.display}>
            From scattered threads to one shared rhythm
          </h1>
          <p className={styles.lead}>
            Kinlight takes about ten minutes to set up and starts paying that
            back the same day. Here is the whole flow, start to finish.
          </p>
          <div className={styles.actions}>
            <Link href="/auth/sign-up" className={styles.btnPrimary}>
              Start your household
            </Link>
            <Link href="/features" className={styles.btnGhost}>
              See the features
            </Link>
          </div>
        </div>
        <div
          className={`${styles.card} ${styles.heroPanel} ${styles.reveal} ${styles.d2}`}
        >
          <div className={styles.heroPanelRow}>
            <span className={styles.heroPanelDot} aria-hidden>
              <Sparkles size={16} aria-hidden />
            </span>
            <span className={styles.heroPanelText}>
              <b>A day on Kinlight</b>
              <span>What the household sees</span>
            </span>
          </div>
          {dayItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label}>
                <div className={styles.heroPanelDivider} aria-hidden />
                <div className={styles.heroPanelRow}>
                  <span className={styles.heroPanelDot} aria-hidden>
                    <Icon size={16} aria-hidden />
                  </span>
                  <span className={styles.heroPanelText}>
                    <b>
                      {item.time} · {item.label}
                    </b>
                    <span>{item.detail}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className={styles.sectionHead}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden />
            Five steps
          </p>
          <h2 className={styles.title}>Set it up once, lean on it daily</h2>
        </div>
        <div className={styles.steps}>
          {steps.map((step, i) => (
            <article
              key={step.title}
              className={`${styles.card} ${styles.step} ${styles.reveal} ${
                styles[`d${(i % 4) + 1}` as keyof typeof styles]
              }`}
            >
              <span className={styles.stepNum} aria-hidden />
              <div className={styles.stepBody}>
                <h3 className={styles.cardTitle}>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className={styles.sectionHead}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden />
            Access that fits the help
          </p>
          <h2 className={styles.title}>Three roles, no oversharing</h2>
          <p className={styles.prose}>
            You decide how much each person sees. Bring in a neighbour for a
            week without handing over the medical history.
          </p>
        </div>
        <div className={`${styles.grid} ${styles.grid3}`}>
          {roles.map((role, i) => {
            const Icon = role.icon;
            return (
              <article
                key={role.title}
                className={`${styles.card} ${styles.tile} ${styles.reveal} ${
                  styles[`d${(i % 3) + 1}` as keyof typeof styles]
                }`}
              >
                <span className={styles.tileIcon} aria-hidden>
                  <Icon size={22} aria-hidden />
                </span>
                <h3 className={styles.cardTitle}>{role.title}</h3>
                <p className={styles.tileBody}>{role.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <CtaBand
        title="Your first household is a few minutes away"
        secondaryHref="/faq"
        secondaryLabel="Read common questions"
      />
    </MarketingPage>
  );
}
