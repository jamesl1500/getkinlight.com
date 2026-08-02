import Link from "next/link";
import styles from "../../styles/ui.module.scss";

const features = [
  {
    accent: "FT",
    delay: "reveal-delay-1",
    title: "Family timeline",
    body: "Post updates with context so relatives and caregivers stay in sync without repeated calls.",
  },
  {
    accent: "RT",
    delay: "reveal-delay-2",
    title: "Care routines",
    body: "Track recurring tasks and milestones with clear ownership and history.",
  },
  {
    accent: "HR",
    delay: "reveal-delay-3",
    title: "Household roles",
    body: "Control who can invite members or edit records with owner and caregiver permissions.",
  },
  {
    accent: "PD",
    delay: "reveal-delay-4",
    title: "Private by design",
    body: "Every household is scoped by row-level security so members only see their own family data.",
  },
  {
    accent: "GN",
    delay: "reveal-delay-5",
    title: "Gentle notifications",
    body: "Nudges for what matters most, with fewer noisy pings and better timing.",
  },
  {
    accent: "SA",
    delay: "reveal-delay-6",
    title: "Supabase-backed auth",
    body: "Reliable sign-in, password recovery, and profile bootstrapping from a secure auth stack.",
  },
];

export default function FeaturesPage() {
  return (
    <div className={styles.pageStack}>
      <main
        className={`${styles.pageContainer} mt-6 space-y-5 md:mt-8 md:space-y-8`}
      >
        <section className={`${styles.glassCard} ${styles.heroPanel}`}>
          <div className={`${styles.heroCopy} ${styles.fadeUp}`}>
            <p className={styles.heroPill}>Features</p>
            <h1 className={styles.sectionTitle}>
              Purpose-built for caring families
            </h1>
            <p className={styles.sectionCopy}>
              Kinlight keeps support practical and warm. You get structure for
              important information, while your family gets an interface that
              feels easy and human.
            </p>
          </div>
        </section>

        <section className={styles.featureGrid}>
          {features.map((feature) => (
            <article
              key={feature.title}
              className={`${styles.glassCard} ${styles.featureCard} ${styles.fadeUp} ${styles[feature.delay as keyof typeof styles]}`}
            >
              <span className={styles.iconAccent}>{feature.accent}</span>
              <h2 className={styles.cardTitle}>{feature.title}</h2>
              <p className={styles.cardCopy}>{feature.body}</p>
            </article>
          ))}
        </section>

        <section className={`${styles.glassCard} ${styles.ctaPanel}`}>
          <div className={styles.ctaActions}>
            <h2 className={styles.sectionTitle}>
              See it in your own household
            </h2>
            <Link href="/auth/sign-up" className={styles.buttonPrimary}>
              Start now
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
