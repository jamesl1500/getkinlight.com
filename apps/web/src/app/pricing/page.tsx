import type { Metadata } from "next";
import { Check } from "lucide-react";
import Link from "next/link";

import { MarketingPage } from "@/components/marketing/decor";
import styles from "@/styles/pages/marketing/marketing.module.scss";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Start free while your family explores Kinlight, then upgrade when you need more households and deeper collaboration.",
};

const plans = [
  {
    name: "Starter Family",
    price: "$0",
    period: "forever",
    featured: false,
    cta: { href: "/auth/sign-up", label: "Create free account" },
    features: [
      "1 household",
      "Up to 5 members",
      "Care timeline, schedule & tasks",
      "Supply list and household messages",
    ],
  },
  {
    name: "Family Plus",
    price: "$12",
    period: "/ month",
    featured: true,
    cta: { href: "/auth/sign-up", label: "Start Family Plus" },
    features: [
      "Up to 3 households",
      "Unlimited members",
      "Advanced reminders & scheduling",
      "Kinlight AI daily brief",
      "Priority support and data exports",
    ],
  },
  {
    name: "Care Circle",
    price: "Custom",
    period: "",
    featured: false,
    cta: { href: "/contact", label: "Talk to us" },
    features: [
      "Larger groups and care teams",
      "Custom onboarding",
      "White-glove migration",
      "Dedicated point of contact",
    ],
  },
];

export default function PricingPage() {
  return (
    <MarketingPage>
      <section
        className={styles.hero}
        style={{ gridTemplateColumns: "1fr", textAlign: "center" }}
      >
        <div
          className={`${styles.heroCopy} ${styles.reveal}`}
          style={{ marginInline: "auto", alignItems: "center" }}
        >
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden />
            Pricing
          </p>
          <h1 className={styles.display}>Simple plans for real life</h1>
          <p className={styles.lead} style={{ marginInline: "auto" }}>
            Start free while your family explores Kinlight, then upgrade when
            you need more space and deeper collaboration. No lock-in, cancel any
            time.
          </p>
        </div>
      </section>

      <section>
        <div className={styles.planGrid}>
          {plans.map((plan, i) => (
            <article
              key={plan.name}
              className={`${styles.card} ${styles.plan} ${
                plan.featured ? styles.planFeatured : ""
              } ${styles.reveal} ${styles[`d${(i % 3) + 1}` as keyof typeof styles]}`}
            >
              {plan.featured ? (
                <span className={styles.planTag}>Most chosen</span>
              ) : null}
              <p className={styles.planName}>{plan.name}</p>
              <p className={styles.planPrice}>
                {plan.price}
                {plan.period ? (
                  <span className={styles.planPeriod}>{plan.period}</span>
                ) : null}
              </p>
              <ul className={styles.planList}>
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <Check size={16} aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
              <div className={styles.planCta}>
                <Link
                  href={plan.cta.href}
                  className={
                    plan.featured ? styles.btnPrimary : styles.btnGhost
                  }
                >
                  {plan.cta.label}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className={`${styles.card} ${styles.cta} ${styles.reveal}`}>
          <span className={styles.ctaGlow} aria-hidden />
          <h2 className={styles.title}>Every plan includes the essentials</h2>
          <p className={styles.prose}>
            Private, household-scoped data. Optional, off-by-default analytics.
            Account deletion whenever you want it. The free plan is genuinely
            useful on its own — upgrade only when your family outgrows it.
          </p>
          <div className={styles.actions}>
            <Link href="/faq" className={styles.btnGhost}>
              Read common questions
            </Link>
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
