"use client";

import { OPEN_KINLIGHT_AI_EVENT } from "@/components/ai/ai-assistant-modal";
import {
  AiRequestSchema,
  AiResponseSchema,
  createKinlightClient,
  type AiDailyBrief,
} from "@getkinlight.com/shared";
import { ArrowRight, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "@/app/(authenticated)/dashboard/dashboard.module.scss";

function localDate() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function fetchBrief(householdId: string, refresh: boolean) {
  const supabase = createKinlightClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session)
    throw new Error("Your session has expired. Sign in again.");

  const input = AiRequestSchema.parse({
    action: "daily-brief",
    householdId,
    date: localDate(),
    refresh,
  });
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify(input),
  });
  const result = AiResponseSchema.parse(await response.json());
  if (!response.ok || !result.ok)
    throw new Error(
      result.ok ? "Today's brief is unavailable." : result.message,
    );
  if (result.action !== "daily-brief")
    throw new Error("Kinlight AI returned an unexpected response.");
  return result.data;
}

export function DailyAiBrief({ householdId }: { householdId: string }) {
  const [brief, setBrief] = useState<AiDailyBrief | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    fetchBrief(householdId, false)
      .then((data) => {
        if (isCurrent) setBrief(data);
      })
      .catch((reason) => {
        if (isCurrent)
          setError(
            reason instanceof Error
              ? reason.message
              : "Today's brief is unavailable.",
          );
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [householdId]);

  async function refresh() {
    setIsLoading(true);
    setError("");
    try {
      setBrief(await fetchBrief(householdId, true));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Today's brief is unavailable.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function discussBrief() {
    const prompt = brief
      ? `I want to discuss today's family brief: ${brief.summary}`
      : "Help me understand what needs attention for my family today.";
    window.dispatchEvent(
      new CustomEvent(OPEN_KINLIGHT_AI_EVENT, { detail: { prompt } }),
    );
  }

  return (
    <section
      className={styles.aiBrief}
      aria-labelledby="daily-ai-brief-title"
      aria-busy={isLoading}
    >
      <header className={styles.aiBriefHeader}>
        <div className={styles.aiBriefTitle}>
          <span>
            <Sparkles size={18} aria-hidden />
          </span>
          <div>
            <p className={styles.eyebrow}>Prepared for today</p>
            <h2 id="daily-ai-brief-title">Kinlight brief</h2>
          </div>
        </div>
        <button
          type="button"
          className={styles.refreshButton}
          onClick={refresh}
          disabled={isLoading}
          aria-label="Refresh today's brief"
          title="Refresh today's brief"
        >
          <RefreshCw size={16} aria-hidden />
        </button>
      </header>

      {isLoading && !brief && (
        <div className={styles.briefLoading}>
          <span />
          <span />
          <span />
          <p>Reviewing your family space...</p>
        </div>
      )}
      {error && !brief && (
        <div className={styles.briefError}>
          <p>{error}</p>
          <button type="button" onClick={refresh}>
            Try again
          </button>
        </div>
      )}
      {brief && (
        <div className={styles.briefBody}>
          <div className={styles.briefSummary}>
            <h3>{brief.greeting}</h3>
            <p>{brief.summary}</p>
          </div>
          {brief.priorities.length > 0 && (
            <div className={styles.briefPriorities}>
              <strong>Today’s priorities</strong>
              <ul>
                {brief.priorities.slice(0, 3).map((priority) => (
                  <li key={priority}>{priority}</li>
                ))}
              </ul>
            </div>
          )}
          {brief.insights.length > 0 && (
            <div className={styles.briefInsights}>
              {brief.insights.slice(0, 2).map((insight) => (
                <div
                  key={`${insight.title}-${insight.detail}`}
                  data-severity={insight.severity}
                >
                  <strong>{insight.title}</strong>
                  <span>{insight.detail}</span>
                </div>
              ))}
            </div>
          )}
          <footer>
            <small>{brief.disclaimer}</small>
            <button type="button" onClick={discussBrief}>
              Ask Kinlight <ArrowRight size={15} aria-hidden />
            </button>
          </footer>
        </div>
      )}
    </section>
  );
}
