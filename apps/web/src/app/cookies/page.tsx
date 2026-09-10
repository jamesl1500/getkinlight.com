import type { Metadata } from "next";
import styles from "../legal.module.scss";

export const metadata: Metadata = { title: "Cookie Policy" };

export default function CookiePolicyPage() {
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Device storage</p>
        <h1 className={styles.title}>Cookie Policy</h1>
        <p className={styles.updated}>Effective August 5, 2026</p>
        <p className={styles.intro}>
          Kinlight uses limited browser and device storage to keep accounts
          secure, remember preferences, and honor your observability choices.
        </p>
      </header>
      <div className={styles.content}>
        <Section title="Necessary storage">
          <p>
            Authentication cookies and local device storage keep you signed in,
            protect account requests, and remember settings. Kinlight cannot
            provide authenticated features without this storage.
          </p>
        </Section>
        <Section title="Optional analytics">
          <p>
            Anonymous product analytics are off by default. If you opt in,
            Kinlight records a small set of feature events without identity,
            care content, or session recording. You can withdraw consent in
            Settings at any time.
          </p>
        </Section>
        <Section title="Managing storage">
          <p>
            You can clear cookies and local storage through your browser or
            device. Clearing necessary storage signs you out and resets local
            preferences. For questions, contact{" "}
            <a href="mailto:support@getkinlight.com">support@getkinlight.com</a>
            .
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
