import type { Metadata } from "next";
import { BookOpen, LifeBuoy, Mail, MessageSquareHeart } from "lucide-react";
import Link from "next/link";

import { ContactForm } from "@/components/marketing/contact-form";
import { MarketingPage } from "@/components/marketing/decor";
import styles from "@/styles/pages/marketing/marketing.module.scss";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with the Kinlight team — questions, feedback, privacy requests, or help getting your family set up.",
};

const channels = [
  {
    icon: Mail,
    title: "Email us",
    node: <a href="mailto:support@getkinlight.com">support@getkinlight.com</a>,
  },
  {
    icon: LifeBuoy,
    title: "Getting set up",
    node: (
      <span>
        The <Link href="/how-it-works">how it works</Link> walkthrough covers
        most setup questions.
      </span>
    ),
  },
  {
    icon: BookOpen,
    title: "Common questions",
    node: (
      <span>
        Check the <Link href="/faq">FAQ</Link> for privacy, roles, and the AI
        brief.
      </span>
    ),
  },
  {
    icon: MessageSquareHeart,
    title: "Privacy requests",
    node: (
      <span>
        Data access or deletion questions go to the same address and reach a
        person, not a queue.
      </span>
    ),
  },
];

export default function ContactPage() {
  return (
    <MarketingPage>
      <section className={styles.hero} style={{ gridTemplateColumns: "1fr" }}>
        <div className={`${styles.heroCopy} ${styles.reveal}`}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden />
            Contact
          </p>
          <h1 className={styles.display}>Talk to a real person</h1>
          <p className={styles.lead}>
            We are a small team and we read every message. Whether you are
            weighing up Kinlight for your family or you have hit a snag, send it
            over.
          </p>
        </div>
      </section>

      <section className={styles.contactGrid}>
        <aside className={`${styles.contactAside} ${styles.reveal}`}>
          {channels.map((channel) => {
            const Icon = channel.icon;
            return (
              <div
                key={channel.title}
                className={`${styles.card} ${styles.contactChannel}`}
              >
                <span className={styles.tileIcon} aria-hidden>
                  <Icon size={20} aria-hidden />
                </span>
                <span>
                  <b>{channel.title}</b>
                  {channel.node}
                </span>
              </div>
            );
          })}
        </aside>

        <div className={`${styles.reveal} ${styles.d2}`}>
          <ContactForm />
        </div>
      </section>
    </MarketingPage>
  );
}
