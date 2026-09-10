import type { Metadata } from "next";
import styles from "../legal.module.scss";

export const metadata: Metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Using Kinlight</p>
        <h1 className={styles.title}>Terms of Use</h1>
        <p className={styles.updated}>Effective August 5, 2026</p>
        <p className={styles.intro}>
          These terms govern your use of Kinlight. By creating an account or
          using the service, you agree to them.
        </p>
      </header>
      <div className={styles.content}>
        <Section title="Purpose of the service">
          <p>
            Kinlight provides tools for family communication, schedules, care
            records, reminders, and drafts generated with AI. Kinlight is not a
            healthcare provider, emergency service, medical device, or
            substitute for professional advice.
          </p>
        </Section>
        <Section title="Emergencies and medical decisions">
          <p>
            Do not use Kinlight for emergencies. Contact local emergency
            services or a qualified professional when someone may be in danger.
            Verify medications, appointments, AI output, and other important
            information with an authoritative source before acting.
          </p>
        </Section>
        <Section title="Accounts and household access">
          <p>
            You are responsible for your credentials, activity, and invited
            household members. Only upload or share information you have the
            right to manage. Household owners control membership and must
            transfer ownership before deleting an account when required to
            preserve shared records.
          </p>
        </Section>
        <Section title="Acceptable use">
          <p>You may not use Kinlight to:</p>
          <ul>
            <li>break the law or violate another person&apos;s rights;</li>
            <li>access a household or account without authorization;</li>
            <li>upload malicious code or interfere with service operation;</li>
            <li>harass, exploit, or endanger another person; or</li>
            <li>misrepresent AI output as verified professional advice.</li>
          </ul>
        </Section>
        <Section title="Your content and AI output">
          <p>
            You retain rights in content you provide and grant us permission to
            process it to operate Kinlight. AI output is probabilistic and may
            be incomplete or incorrect. You remain responsible for reviewing
            drafts before saving, sharing, or relying on them.
          </p>
        </Section>
        <Section title="Availability and changes">
          <p>
            We may update, suspend, or discontinue features and may restrict
            accounts that threaten users or the service. Staging and preview
            environments may be reset and should not contain production data.
          </p>
        </Section>
        <Section title="Disclaimers and liability">
          <p>
            Kinlight is provided on an “as available” basis to the extent
            permitted by law. We do not guarantee uninterrupted service or the
            accuracy of user-entered or AI-generated content. Liability is
            limited to the maximum extent permitted by applicable law.
          </p>
        </Section>
        <Section title="Contact and updates">
          <p>
            Questions can be sent to{" "}
            <a href="mailto:support@getkinlight.com">support@getkinlight.com</a>
            . We may update these terms and will revise the effective date when
            changes are made.
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
