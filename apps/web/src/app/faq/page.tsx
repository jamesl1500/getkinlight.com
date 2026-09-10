import type { Metadata } from "next";
import Link from "next/link";

import { CtaBand } from "@/components/marketing/cta-band";
import { MarketingPage } from "@/components/marketing/decor";
import styles from "@/styles/pages/marketing/marketing.module.scss";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Common questions about Kinlight — privacy, roles, the AI brief, pricing, and getting your family set up.",
};

const groups = [
  {
    heading: "Getting started",
    items: [
      {
        q: "Who is Kinlight for?",
        a: "Families and caregivers coordinating support for someone — an ageing parent, a child with ongoing needs, a partner recovering from illness. If more than one person helps, Kinlight is for you.",
      },
      {
        q: "How long does setup take?",
        a: "About ten minutes. You create a household, add the person being cared for, and invite the people who help. You can start logging updates immediately and add detail over time.",
      },
      {
        q: "Do the people I invite need to be tech-savvy?",
        a: "No. The interface is deliberately plain — large text, clear labels, no jargon. Most family members are up and running after their first update.",
      },
    ],
  },
  {
    heading: "Privacy & data",
    items: [
      {
        q: "Who can see our household's information?",
        a: "Only the members you invite, at the access level you give them. Every household is isolated at the database level with row-level security, so members only ever see their own family's data.",
      },
      {
        q: "Do you use our data to train AI or sell to advertisers?",
        a: "No. We do not sell personal information, and your care content is not used to train models. When you use the AI brief, only the information needed for that request is sent to our AI provider to generate it.",
      },
      {
        q: "Is analytics tracking on by default?",
        a: "No. Product analytics and crash reporting are optional and off by default. If you turn them on, we send allowlisted events or scrubbed error details — never care content, tokens, or identity.",
      },
      {
        q: "Can we export or delete everything?",
        a: "Yes. You can delete your account from Settings at any time. Shared household records may be preserved under another owner so they are not removed from other members.",
      },
    ],
  },
  {
    heading: "Roles & the AI brief",
    items: [
      {
        q: "What are the different roles?",
        a: "Owners manage the household and see everything. Caregivers contribute to the care log, schedule, and tasks. Family members follow updates without editing. You can change anyone's role or remove them at any time.",
      },
      {
        q: "Is the AI brief accurate? Does it give medical advice?",
        a: "The brief summarizes what your household has already logged — it does not diagnose, prescribe, or make decisions. AI output can be wrong and should always be reviewed. It is a convenience, never a clinical tool.",
      },
      {
        q: "Can I turn the AI features off entirely?",
        a: "Yes. The AI brief is opt-in. If you never enable it, no care information is ever sent to an AI provider.",
      },
    ],
  },
  {
    heading: "Plans & support",
    items: [
      {
        q: "How much does Kinlight cost?",
        a: "There is a free plan for a single household with up to five members. Paid plans add more households, advanced reminders, and priority support. See the pricing page for current details.",
      },
      {
        q: "How do I get help?",
        a: "Email support@getkinlight.com or use the contact form. We are a small team and read every message.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <MarketingPage>
      <section className={styles.hero} style={{ gridTemplateColumns: "1fr" }}>
        <div className={`${styles.heroCopy} ${styles.reveal}`}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden />
            Questions
          </p>
          <h1 className={styles.display}>Answers before you sign up</h1>
          <p className={styles.lead}>
            The things families ask us most. Still unsure about something?{" "}
            <Link href="/contact" className={styles.textLink}>
              Get in touch
            </Link>{" "}
            — we would rather answer now than have you wonder.
          </p>
        </div>
      </section>

      {groups.map((group, gi) => (
        <section key={group.heading}>
          <div className={styles.sectionHead}>
            <h2 className={styles.title}>{group.heading}</h2>
          </div>
          <div className={styles.faq}>
            {group.items.map((item, i) => (
              <details
                key={item.q}
                className={`${styles.card} ${styles.faqItem} ${styles.reveal} ${
                  styles[`d${(i % 4) + 1}` as keyof typeof styles]
                }`}
                {...(gi === 0 && i === 0 ? { open: true } : {})}
              >
                <summary>{item.q}</summary>
                <p className={styles.faqAnswer}>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}

      <CtaBand
        eyebrow="Still deciding"
        title="Try it with your own household"
        body="The free plan is genuinely useful on its own. Set it up, invite one other person, and see how the week feels."
        secondaryHref="/pricing"
        secondaryLabel="See pricing"
      />
    </MarketingPage>
  );
}
