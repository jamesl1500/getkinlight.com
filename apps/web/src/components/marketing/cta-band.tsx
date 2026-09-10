import Link from "next/link";

import styles from "@/styles/pages/marketing/marketing.module.scss";

export function CtaBand({
  eyebrow = "Get started",
  title = "Bring your people into one calm space",
  body = "Create a household in a couple of minutes, invite the people who help, and let the day organize itself.",
  primaryHref = "/auth/sign-up",
  primaryLabel = "Create a family account",
  secondaryHref = "/how-it-works",
  secondaryLabel = "See how it works",
}: {
  eyebrow?: string;
  title?: string;
  body?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <section>
      <div className={`${styles.card} ${styles.cta} ${styles.reveal}`}>
        <span className={styles.ctaGlow} aria-hidden />
        <p className={styles.eyebrow}>
          <span className={styles.eyebrowDot} aria-hidden />
          {eyebrow}
        </p>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.prose}>{body}</p>
        <div className={styles.actions}>
          <Link href={primaryHref} className={styles.btnPrimary}>
            {primaryLabel}
          </Link>
          <Link href={secondaryHref} className={styles.btnGhost}>
            {secondaryLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
