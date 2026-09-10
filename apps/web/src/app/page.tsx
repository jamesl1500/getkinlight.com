import {
  Bell,
  CalendarDays,
  ClipboardList,
  Heart,
  MessageCircle,
  Package,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { CtaBand } from "@/components/marketing/cta-band";
import { MarketingPage } from "@/components/marketing/decor";
import styles from "@/styles/pages/marketing/marketing.module.scss";

const pillars = [
  {
    icon: Heart,
    title: "Care timeline",
    body: "Check-ins, medications, moods, and notes land in one gentle thread everyone can follow — no group-text archaeology.",
  },
  {
    icon: CalendarDays,
    title: "Shared schedule",
    body: "Appointments, visits, and recurring routines in a calendar the whole household actually keeps up to date.",
  },
  {
    icon: ClipboardList,
    title: "Tasks with owners",
    body: "Assign the pharmacy run or the Tuesday call so nothing quietly falls between people.",
  },
  {
    icon: Package,
    title: "Supply list",
    body: "Track what's running low and who's picking it up, from incontinence supplies to favourite snacks.",
  },
  {
    icon: MessageCircle,
    title: "Household messages",
    body: "A calm place for the small updates that don't belong in a formal note but everyone should see.",
  },
  {
    icon: Sparkles,
    title: "Kinlight AI brief",
    body: "An optional daily summary that turns the week's updates into a few plain sentences. Always yours to review.",
  },
];

const rows = [
  {
    kicker: "Stay aligned",
    title: "Everyone sees the same picture",
    body: "When a sibling logs a rough night or a caregiver adds a new prescription, the rest of the household sees it in context — not as a forwarded screenshot three days later.",
    href: "/features",
    linkLabel: "Explore the features",
    panel: [
      {
        dot: "MW",
        label: "Mum — Wednesday",
        detail: "Slept better, ate a full breakfast",
      },
      {
        dot: "RX",
        label: "New medication",
        detail: "Added by Dr. Okafor's office",
      },
      {
        dot: "AV",
        label: "Visit logged",
        detail: "Priya stopped by after lunch",
      },
    ],
  },
  {
    kicker: "Share the load",
    title: "Help that's easy to hand off",
    body: "Roles and permissions mean you can bring in a neighbour for school pickups or a night nurse for a fortnight without handing over everything. Access fits the help.",
    href: "/how-it-works",
    linkLabel: "See how it works",
    panel: [
      {
        dot: "OW",
        label: "You — Owner",
        detail: "Full access, manages invites",
      },
      {
        dot: "CG",
        label: "Night nurse",
        detail: "Care log + schedule, two weeks",
      },
      { dot: "FA", label: "Aunt Fern", detail: "Read-only, family updates" },
    ],
  },
];

const quotes = [
  {
    text: "We stopped losing track of Dad's appointments the week we started. My brother and I finally feel like we're on the same team instead of chasing each other.",
    who: "Lena M.",
    role: "Caring for a parent, two cities apart",
    initials: "LM",
  },
  {
    text: "The daily brief is the first thing I read now. Ten years of sticky notes on the fridge, replaced by something the whole family can actually see.",
    who: "The Adeyemi family",
    role: "Three generations, one household",
    initials: "A",
  },
];

export default function HomePage() {
  return (
    <MarketingPage>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={`${styles.heroCopy} ${styles.reveal}`}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden />
            Family care, gently organized
          </p>
          <h1 className={styles.display}>
            One bright home for care updates,{" "}
            <span className={styles.gradientInk}>
              reminders, and everyday check-ins
            </span>
          </h1>
          <p className={styles.lead}>
            Kinlight keeps your family aligned without feeling clinical. Share
            routines, coordinate care, and keep everyone informed in a calm,
            private space that feels like it was made for people, not patients.
          </p>
          <div className={styles.actions}>
            <Link href="/auth/sign-up" className={styles.btnPrimary}>
              Create a family account
            </Link>
            <Link href="/how-it-works" className={styles.btnGhost}>
              See how it works
            </Link>
          </div>
          <div className={styles.heroTrust}>
            <span className={styles.heroTrustItem}>
              <ShieldCheck size={16} aria-hidden />
              Private by design
            </span>
            <span className={styles.heroTrustItem}>
              <UsersRound size={16} aria-hidden />
              Built for whole households
            </span>
            <span className={styles.heroTrustItem}>
              <Bell size={16} aria-hidden />
              Gentle, not noisy
            </span>
          </div>
        </div>

        <div className={`${styles.heroArt} ${styles.reveal} ${styles.d2}`}>
          <div className={`${styles.card} ${styles.heroPanel}`}>
            <div className={styles.heroPanelRow}>
              <span className={styles.heroPanelDot} aria-hidden>
                <Sparkles size={16} aria-hidden />
              </span>
              <span className={styles.heroPanelText}>
                <b>Today at a glance</b>
                <span>Thursday, gathered from 4 people</span>
              </span>
            </div>
            <div className={styles.heroPanelDivider} aria-hidden />
            <div className={styles.heroPanelRow}>
              <span className={styles.heroPanelDot} aria-hidden>
                <Heart size={16} aria-hidden />
              </span>
              <span className={styles.heroPanelText}>
                <b>Morning check-in logged</b>
                <span>Good mood, took all medications</span>
              </span>
            </div>
            <div className={styles.heroPanelRow}>
              <span className={styles.heroPanelDot} aria-hidden>
                <CalendarDays size={16} aria-hidden />
              </span>
              <span className={styles.heroPanelText}>
                <b>Physio at 2:30pm</b>
                <span>Sam is driving — reminder set</span>
              </span>
            </div>
            <div className={styles.heroPanelRow}>
              <span className={styles.heroPanelDot} aria-hidden>
                <Package size={16} aria-hidden />
              </span>
              <span className={styles.heroPanelText}>
                <b>Supplies running low</b>
                <span>Priya added 3 items to the list</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section>
        <div className={`${styles.card} ${styles.stats} ${styles.reveal}`}>
          <div className={styles.statItem}>
            <span className={styles.stat}>1 place</span>
            <span className={styles.statLabel}>
              for updates, schedule, tasks, and supplies
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.stat}>Minutes</span>
            <span className={styles.statLabel}>
              to set up your first household
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.stat}>Everyone</span>
            <span className={styles.statLabel}>
              on the same page, at their own access level
            </span>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section>
        <div className={styles.sectionHead}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden />
            What&rsquo;s inside
          </p>
          <h2 className={styles.title}>
            One home for everything care actually touches
          </h2>
          <p className={styles.prose}>
            Not another inbox. Kinlight brings the moving parts of caring for
            someone together, so the mental load stops living in one
            person&rsquo;s head.
          </p>
        </div>
        <div className={`${styles.grid} ${styles.grid3}`}>
          {pillars.map((pillar, i) => {
            const Icon = pillar.icon;
            return (
              <article
                key={pillar.title}
                className={`${styles.card} ${styles.tile} ${styles.reveal} ${
                  styles[`d${(i % 3) + 1}` as keyof typeof styles]
                }`}
              >
                <span className={styles.tileIcon} aria-hidden>
                  <Icon size={22} aria-hidden />
                </span>
                <h3 className={styles.cardTitle}>{pillar.title}</h3>
                <p className={styles.tileBody}>{pillar.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* Editorial rows */}
      <section className={styles.rows}>
        {rows.map((row, i) => (
          <div
            key={row.title}
            className={`${styles.row} ${i % 2 === 1 ? styles.rowReverse : ""} ${styles.reveal}`}
          >
            <div className={styles.rowText}>
              <span className={styles.rowKicker}>{row.kicker}</span>
              <h2 className={styles.title}>{row.title}</h2>
              <p className={styles.prose}>{row.body}</p>
              <Link href={row.href} className={styles.textLink}>
                {row.linkLabel} →
              </Link>
            </div>
            <div className={`${styles.card} ${styles.rowVisual}`}>
              <div className={styles.heroPanel} style={{ width: "100%" }}>
                {row.panel.map((p, idx) => (
                  <div key={p.label}>
                    {idx > 0 && (
                      <div className={styles.heroPanelDivider} aria-hidden />
                    )}
                    <div className={styles.heroPanelRow}>
                      <span className={styles.heroPanelDot} aria-hidden>
                        {p.dot}
                      </span>
                      <span className={styles.heroPanelText}>
                        <b>{p.label}</b>
                        <span>{p.detail}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Testimonials */}
      <section>
        <div className={styles.sectionHead}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden />
            In their words
          </p>
          <h2 className={styles.title}>
            Families who stopped juggling threads
          </h2>
        </div>
        <div className={styles.quotes}>
          {quotes.map((quote, i) => (
            <figure
              key={quote.who}
              className={`${styles.card} ${styles.quote} ${styles.reveal} ${
                i === 1 ? styles.d2 : ""
              }`}
            >
              <span className={styles.quoteMark} aria-hidden>
                &ldquo;
              </span>
              <blockquote className={styles.quoteText}>{quote.text}</blockquote>
              <figcaption className={styles.quoteWho}>
                <span className={styles.quoteAvatar} aria-hidden>
                  {quote.initials}
                </span>
                <span>
                  <b>{quote.who}</b>
                  <br />
                  {quote.role}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <CtaBand />
    </MarketingPage>
  );
}
