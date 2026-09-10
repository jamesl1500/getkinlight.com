"use client";

import { useId, useState } from "react";

import styles from "@/styles/pages/marketing/marketing.module.scss";

const SUPPORT_EMAIL = "support@getkinlight.com";

const topics = [
  "General question",
  "Getting my family set up",
  "Privacy & data",
  "Billing & plans",
  "Feedback or a feature idea",
  "Something isn't working",
];

export function ContactForm() {
  const nameId = useId();
  const emailId = useId();
  const topicId = useId();
  const messageId = useId();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState(topics[0]);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const subject = `Kinlight — ${topic}`;
    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Topic: ${topic}`,
      "",
      message,
    ].join("\n");

    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  return (
    <form className={`${styles.card} ${styles.form}`} onSubmit={handleSubmit}>
      <div className={styles.formRow}>
        <div className={styles.field}>
          <label htmlFor={nameId}>Your name</label>
          <input
            id={nameId}
            name="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={emailId}>Email</label>
          <input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor={topicId}>What&rsquo;s this about?</label>
        <select
          id={topicId}
          name="topic"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
        >
          {topics.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor={messageId}>Message</label>
        <textarea
          id={messageId}
          name="message"
          required
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Tell us what you need. The more detail, the better we can help."
        />
      </div>

      <button type="submit" className={styles.btnPrimary}>
        Compose email
      </button>

      {sent ? (
        <p className={styles.formStatus} role="status">
          Your email app should have opened with everything filled in. If it
          didn&rsquo;t, write to us directly at {SUPPORT_EMAIL}.
        </p>
      ) : (
        <p className={styles.formNote}>
          This opens a pre-filled message in your own email app — nothing is
          sent until you press send there. Prefer to write directly? Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      )}
    </form>
  );
}
