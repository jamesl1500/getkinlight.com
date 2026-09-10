import type { Metadata } from "next";
import styles from "../legal.module.scss";

export const metadata: Metadata = { title: "Privacy Notice" };

export default function PrivacyPage() {
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Your information</p>
        <h1 className={styles.title}>Privacy Notice</h1>
        <p className={styles.updated}>Effective August 5, 2026</p>
        <p className={styles.intro}>
          Kinlight is a private coordination space for families and caregivers.
          This notice explains what we collect, why we use it, and the choices
          available to you.
        </p>
      </header>
      <div className={styles.content}>
        <Section title="Information you provide">
          <p>
            We process account and profile details, household membership,
            invitations, care recipient details, schedules, notes, check-ins,
            messages, and files you choose to submit. This information may be
            sensitive, so only add information you are authorized to share.
          </p>
        </Section>
        <Section title="How we use information">
          <p>
            We use information to authenticate accounts, provide household
            collaboration, deliver reminders and notifications, prevent abuse,
            support account deletion, and maintain service reliability.
          </p>
        </Section>
        <Section title="AI features">
          <p>
            When you use Kinlight AI, the information needed for that request is
            sent to our AI service provider to generate the requested draft or
            summary. AI output may be inaccurate and should be reviewed.
            Kinlight does not use AI to diagnose, prescribe, or make automated
            decisions about access to the service.
          </p>
        </Section>
        <Section title="Analytics and crash reporting">
          <p>
            Product analytics and technical crash reports are optional and off
            by default. If enabled, we send allowlisted events or scrubbed error
            details without care content, request bodies, access tokens, screen
            recordings, or user identity. You can change these choices in
            Settings at any time.
          </p>
        </Section>
        <Section title="Service providers and disclosure">
          <p>
            We use vetted providers for hosting, authentication, database
            services, AI processing, notifications, analytics, and error
            reporting. They process information on our behalf under their
            applicable terms. We may also disclose information when required by
            law or to protect users and the service. We do not sell personal
            information.
          </p>
        </Section>
        <Section title="Retention, security, and deletion">
          <p>
            We retain information while your account or household needs it and
            as required for security or legal obligations. We use access
            controls, encryption in transit, and row-level authorization, but no
            online service can guarantee absolute security. You can delete your
            account in Settings. Shared household records may be preserved under
            another owner so they are not removed from other members.
          </p>
        </Section>
        <Section title="Your choices">
          <ul>
            <li>
              Update your profile, household, and notification preferences.
            </li>
            <li>Disable optional analytics and crash reporting.</li>
            <li>Remove care records you are authorized to manage.</li>
            <li>
              Delete your account, subject to household ownership transfer.
            </li>
          </ul>
        </Section>
        <Section title="Children and changes">
          <p>
            Kinlight accounts are not directed to children under 13. Adults may
            manage care information about family members when authorized. We may
            update this notice as the service changes and will revise the
            effective date when we do.
          </p>
        </Section>
        <Section title="Contact">
          <p>
            Privacy questions and requests can be sent to{" "}
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
