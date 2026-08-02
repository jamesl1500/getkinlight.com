"use client";

import {
  FamilyMutationResponseSchema,
  createKinlightClient,
} from "@getkinlight.com/shared";
import { ArrowRight, Check, House, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./join-household.module.scss";

export function JoinHousehold({
  invitationToken,
}: {
  invitationToken: string;
}) {
  const router = useRouter();
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");
  const [hasJoined, setHasJoined] = useState(false);

  async function acceptInvitation() {
    setIsJoining(true);
    setError("");
    const supabase = createKinlightClient();
    const { data } = await supabase.auth.getSession();

    if (!data.session) {
      const next = `/family/join?token=${encodeURIComponent(invitationToken)}`;
      router.push(`/auth/sign-up?next=${encodeURIComponent(next)}`);
      return;
    }

    try {
      const response = await fetch("/api/family", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ action: "accept-invitation", invitationToken }),
      });
      const result = FamilyMutationResponseSchema.parse(await response.json());
      if (!response.ok || !result.ok) throw new Error(result.message);
      setHasJoined(true);
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to accept this invitation.",
      );
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <main className={styles.joinPage}>
      <section className={styles.joinPanel}>
        <span className={styles.icon}>
          {hasJoined ? (
            <Check size={28} aria-hidden />
          ) : (
            <House size={28} aria-hidden />
          )}
        </span>
        <p className={styles.eyebrow}>
          {hasJoined ? "Invitation accepted" : "Household invitation"}
        </p>
        <h1>
          {hasJoined
            ? "You’re part of the household"
            : "Join your family space"}
        </h1>
        <p className={styles.copy}>
          {hasJoined
            ? "You can now see shared household members, care recipients, schedules, and notes."
            : "Accept this invitation with the signed-in account that matches the invited email address."}
        </p>
        {!invitationToken && (
          <p className={styles.error} role="alert">
            This invitation link is incomplete.
          </p>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {hasJoined ? (
          <Link href="/family">
            Open family workspace <ArrowRight size={16} aria-hidden />
          </Link>
        ) : (
          <button
            type="button"
            onClick={acceptInvitation}
            disabled={!invitationToken || isJoining}
          >
            {isJoining ? "Joining..." : "Accept invitation"}
          </button>
        )}
        <aside>
          <ShieldCheck size={16} aria-hidden />
          <span>
            Invitation links expire after seven days and only work for the
            invited email.
          </span>
        </aside>
      </section>
    </main>
  );
}
