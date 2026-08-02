import Link from "next/link";
import styles from "../../styles/ui.module.scss";

const plans = [
  {
    accent: "SF",
    delay: "reveal-delay-1",
    name: "Starter Family",
    price: "$0",
    period: "/month",
    details: [
      "1 household",
      "Up to 5 members",
      "Core timeline and profile access",
    ],
  },
  {
    accent: "FP",
    delay: "reveal-delay-2",
    name: "Family Plus",
    price: "$12",
    period: "/month",
    details: [
      "Up to 3 households",
      "Advanced reminders",
      "Priority support and exports",
    ],
  },
  {
    accent: "CC",
    delay: "reveal-delay-3",
    name: "Care Circle",
    price: "Custom",
    period: "",
    details: ["Larger groups", "Custom onboarding", "White-glove migration"],
  },
];

export default function PricingPage() {
  return (
    <div className={styles.pageStack}>
      <main
        className={`${styles.pageContainer} mt-6 space-y-5 md:mt-8 md:space-y-8`}
      >
        <section className={`${styles.glassCard} ${styles.heroPanel}`}>
          <div className={`${styles.heroCopy} ${styles.fadeUp}`}>
            <p className={styles.heroPill}>Pricing</p>
            <h1 className={styles.sectionTitle}>Simple plans for real life</h1>
            <p className={styles.sectionCopy}>
              Start free while your family explores Kinlight, then upgrade when
              you need more space and deeper collaboration.
            </p>
          </div>
        </section>

        <section className={styles.planGrid}>
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`${styles.glassCard} ${styles.planCard} ${styles.fadeUp} ${styles[plan.delay as keyof typeof styles]}`}
            >
              <span className={styles.iconAccent}>{plan.accent}</span>
              <p className="text-sm font-medium text-ink-soft">{plan.name}</p>
              <p className={`${styles.priceValue} mt-2 text-4xl`}>
                {plan.price}
                <span className="ml-1 text-base text-ink-soft">
                  {plan.period}
                </span>
              </p>
              <ul className="mt-5 space-y-2 text-sm leading-7 text-ink-soft">
                {plan.details.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className={`${styles.glassCard} ${styles.ctaPanel}`}>
          <div className={styles.ctaActions}>
            <h2 className={styles.sectionTitle}>
              Create your free account today
            </h2>
            <Link href="/auth/sign-up" className={styles.buttonPrimary}>
              Get started
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
