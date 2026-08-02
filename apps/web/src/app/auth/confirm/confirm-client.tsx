"use client";

import { createKinlightClient } from "@getkinlight.com/shared";
import type { EmailOtpType } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "../status.module.scss";

type ConfirmClientProps = {
  code?: string;
  tokenHash?: string;
  type?: string;
  redirectTo: string;
};

export function ConfirmClient({
  code,
  tokenHash,
  type,
  redirectTo,
}: ConfirmClientProps) {
  const router = useRouter();
  const [title, setTitle] = useState("Confirming your email...");
  const [copy, setCopy] = useState(
    "We are securing your session and preparing your onboarding flow.",
  );
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function confirmEmail() {
      try {
        const supabase = createKinlightClient();

        if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as EmailOtpType,
          });

          if (error) {
            throw error;
          }
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            throw error;
          }
        } else {
          const { data } = await supabase.auth.getSession();

          if (!data.session) {
            throw new Error(
              "This confirmation link is invalid or has expired.",
            );
          }
        }

        if (!isActive) {
          return;
        }

        setTitle("Email confirmed");
        setCopy(
          "Your account is ready. Taking you to the onboarding flow now.",
        );
        window.setTimeout(
          () =>
            router.replace(
              `/auth/onboarding?next=${encodeURIComponent(redirectTo)}`,
            ),
          700,
        );
      } catch (error) {
        if (!isActive) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Unable to confirm this email.";
        setIsError(true);
        setTitle("Confirmation failed");
        setCopy(message);
      }
    }

    void confirmEmail();

    return () => {
      isActive = false;
    };
  }, [code, redirectTo, router, tokenHash, type]);

  return (
    <section className={styles.statusCard}>
      <div className={styles.statusBody}>
        <p className={styles.eyebrow}>Email confirmation</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={`${styles.copy} ${isError ? styles.error : ""}`}>
          {copy}
        </p>
        {isError ? (
          <div className={styles.actions}>
            <a
              href={`/auth/sign-up?next=${encodeURIComponent(redirectTo)}`}
              className={styles.secondary}
            >
              Request a new link
            </a>
            <a
              href={`/auth/sign-in?next=${encodeURIComponent(redirectTo)}`}
              className={styles.primary}
            >
              Back to sign in
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}
