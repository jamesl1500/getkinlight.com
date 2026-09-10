import type { Metadata } from "next";
import { Compass, HandHeart, Leaf, Lock } from "lucide-react";
import Link from "next/link";

import { CtaBand } from "@/components/marketing/cta-band";
import { MarketingPage } from "@/components/marketing/decor";
import styles from "@/styles/pages/marketing/marketing.module.scss";

export const metadata: Metadata = {
  title: "About",
  description:
    "Kinlight is a calm, private space for families and caregivers to coordinate the everyday work of looking after someone.",
};

const values = [
  {
    icon: HandHeart,
    title: "People, not patients",
    body: "Care software usually feels like a hospital chart. We design for the kitchen table — warm, plain-spoken, and easy for a grandparent or a teenager to use.",
  },
  {
    icon: Lock,
    title: "Privacy is the product",
    body: "Every household is isolated by row-level security. Analytics and crash reporting are optional and off by default. Your family's information is not a growth lever.",
  },
  {
    icon: Leaf,
    title: "Calm by default",
    body: "We would rather send one useful nudge than ten anxious ones. Fewer notifications, better timing, nothing that manufactures urgency.",
  },
  {
    icon: Compass,
    title: "Built with caregivers",
    body: "Every feature starts from a real coordination problem a family told us about — a missed dose, a double-booked ride, a sibling left out of the loop.",
  },
];

export default function AboutPage() {
  return (
    <MarketingPage>
      <section className={styles.hero}>
        <div className={`${styles.heroCopy} ${styles.reveal}`}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden />
            Our story
          </p>
          <h1 className={styles.display}>
            We built the tool we wished our own families had
          </h1>
          <p className={styles.lead}>
            Kinlight started with a whiteboard full of medication times, a group
            chat nobody could follow, and the feeling that one person was
            quietly holding all of it. We thought coordinating care for someone
            you love should feel lighter than that.
          </p>
        </div>
        <div
          className={`${styles.card} ${styles.cardPad} ${styles.reveal} ${styles.d2}`}
        >
          <p className={styles.prose}>
            <strong>Kinlight</strong> — <em>kin</em>, the people who show up,
            and <em>light</em>, the small warmth of knowing someone else is
            paying attention too. That is the whole idea: a shared lantern for
            the people caring for someone, so no one is left carrying the dark
            stretch alone.
          </p>
        </div>
      </section>

      <section>
        <div className={styles.sectionHead}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden />
            What we believe
          </p>
          <h2 className={styles.title}>The principles behind every screen</h2>
        </div>
        <div className={`${styles.grid} ${styles.grid2}`}>
          {values.map((value, i) => {
            const Icon = value.icon;
            return (
              <article
                key={value.title}
                className={`${styles.card} ${styles.tile} ${styles.reveal} ${
                  styles[`d${(i % 3) + 1}` as keyof typeof styles]
                }`}
              >
                <span className={styles.tileIcon} aria-hidden>
                  <Icon size={22} aria-hidden />
                </span>
                <h3 className={styles.cardTitle}>{value.title}</h3>
                <p className={styles.tileBody}>{value.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.rows}>
        <div className={`${styles.row} ${styles.reveal}`}>
          <div className={styles.rowText}>
            <span className={styles.rowKicker}>Where we are</span>
            <h2 className={styles.title}>A small team, a focused product</h2>
            <p className={styles.prose}>
              We are early, and deliberately so. Kinlight does a handful of
              things — the timeline, the schedule, tasks, supplies, messages,
              and an optional AI brief — and tries to do them gently and well.
              We would rather earn one family&rsquo;s trust than chase every
              feature request.
            </p>
            <p className={styles.prose}>
              If you are living this right now and something is missing, we want
              to hear it. That feedback is how the roadmap gets written.
            </p>
            <Link href="/contact" className={styles.textLink}>
              Tell us what you need &rarr;
            </Link>
          </div>
          <div className={`${styles.card} ${styles.rowVisual}`}>
            <div className={styles.heroPanel} style={{ width: "100%" }}>
              <div className={styles.heroPanelRow}>
                <span className={styles.heroPanelDot} aria-hidden>
                  1
                </span>
                <span className={styles.heroPanelText}>
                  <b>Listen to a real family</b>
                  <span>Every feature starts here</span>
                </span>
              </div>
              <div className={styles.heroPanelDivider} aria-hidden />
              <div className={styles.heroPanelRow}>
                <span className={styles.heroPanelDot} aria-hidden>
                  2
                </span>
                <span className={styles.heroPanelText}>
                  <b>Ship the smallest calm version</b>
                  <span>No dashboards for the sake of it</span>
                </span>
              </div>
              <div className={styles.heroPanelDivider} aria-hidden />
              <div className={styles.heroPanelRow}>
                <span className={styles.heroPanelDot} aria-hidden>
                  3
                </span>
                <span className={styles.heroPanelText}>
                  <b>Keep the data theirs</b>
                  <span>Isolated, exportable, deletable</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CtaBand
        eyebrow="Join early"
        title="Be one of the first families on Kinlight"
        body="You will help shape a product that thousands of caregivers will lean on. Start free and bring your household in today."
        secondaryHref="/features"
        secondaryLabel="Browse the features"
      />
    </MarketingPage>
  );
}
