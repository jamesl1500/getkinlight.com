import type { ReactNode } from "react";

import styles from "@/styles/pages/marketing/marketing.module.scss";

/**
 * Shared decorative layer for marketing pages — soft lantern-glow auras and a
 * few drifting sparks that echo the Kinlight star mark. Purely presentational.
 */
export function MarketingBackdrop() {
  return (
    <>
      <div className={`${styles.aura} ${styles.auraPeach}`} aria-hidden />
      <div className={`${styles.aura} ${styles.auraAqua}`} aria-hidden />
      <div className={`${styles.aura} ${styles.auraSun}`} aria-hidden />

      <Spark
        style={{ top: "6rem", right: "8%", width: "1.5rem", height: "1.5rem" }}
        delay="0s"
      />
      <Spark
        style={{ top: "22rem", left: "5%", width: "1rem", height: "1rem" }}
        delay="1.4s"
      />
      <Spark
        style={{
          top: "40rem",
          right: "14%",
          width: "0.85rem",
          height: "0.85rem",
        }}
        delay="2.7s"
      />
    </>
  );
}

function Spark({
  style,
  delay,
}: {
  style: React.CSSProperties;
  delay: string;
}) {
  return (
    <span
      className={styles.spark}
      style={{ ...style, animationDelay: delay }}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" fill="none">
        <path
          d="M16 2.5c1 6.5 7 12.5 13.5 13.5C23 17 17 23 16 29.5 15 23 9 17 2.5 16 9 15 15 9 16 2.5Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

export function MarketingPage({ children }: { children: ReactNode }) {
  return (
    <main className={styles.page}>
      <MarketingBackdrop />
      <div className={styles.container}>
        <div className={styles.stack}>{children}</div>
      </div>
    </main>
  );
}
