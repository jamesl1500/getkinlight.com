"use client";

import { createKinlightClient } from "@getkinlight.com/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import styles from "../status.module.scss";

type VerifyEmailFormProps = {
  initialEmail: string;
  redirectTo: string;
};

export function VerifyEmailForm({
  initialEmail,
  redirectTo,
}: VerifyEmailFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (resendSeconds === 0) {
      return;
    }

    const timer = window.setTimeout(
      () => setResendSeconds(resendSeconds - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || code.length !== 6) {
      setIsError(true);
      setMessage(
        "Enter your email address and the six-digit code from your message.",
      );
      return;
    }

    setIsVerifying(true);
    setIsError(false);
    setMessage("");

    try {
      const supabase = createKinlightClient();
      const { error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: code,
        type: "email",
      });

      if (error) {
        throw error;
      }

      setMessage("Email verified. Taking you to onboarding...");
      router.replace(`/auth/onboarding?next=${encodeURIComponent(redirectTo)}`);
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "Unable to verify this code.",
      );
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResend() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setIsError(true);
      setMessage("Enter your email address before requesting another code.");
      return;
    }

    setIsResending(true);
    setIsError(false);
    setMessage("");

    try {
      const supabase = createKinlightClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(redirectTo)}`,
        },
      });

      if (error) {
        throw error;
      }

      setCode("");
      setMessage("A new verification code is on its way.");
      setResendSeconds(60);
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "Unable to send another code.",
      );
    } finally {
      setIsResending(false);
    }
  }

  return (
    <section className={styles.statusCard}>
      <div className={styles.statusBody}>
        <p className={styles.eyebrow}>Verify your email</p>
        <h1 className={styles.title}>Enter the code from your inbox.</h1>
        <p className={styles.copy}>
          We sent a six-digit verification code to your email. Enter it below to
          confirm your account and continue to onboarding.
        </p>

        <form onSubmit={handleSubmit} className={styles.verificationForm}>
          <label className={styles.field}>
            <span className={styles.label}>Email address</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={styles.textInput}
              placeholder="you@family.com"
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Verification code</span>
            <input
              type="text"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className={styles.codeInput}
              placeholder="000000"
              aria-describedby="verification-code-help"
            />
            <span id="verification-code-help" className={styles.fieldHelp}>
              For your security, codes expire shortly after they are sent.
            </span>
          </label>

          <button
            type="submit"
            disabled={isVerifying}
            className={styles.submitButton}
          >
            {isVerifying ? "Verifying..." : "Verify email"}
          </button>
        </form>

        {message ? (
          <p
            className={`${styles.formMessage} ${isError ? styles.error : styles.success}`}
            role={isError ? "alert" : "status"}
          >
            {message}
          </p>
        ) : null}

        <div className={styles.actions}>
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending || resendSeconds > 0}
            className={styles.secondary}
          >
            {isResending
              ? "Sending..."
              : resendSeconds > 0
                ? `Send again in ${resendSeconds}s`
                : "Send a new code"}
          </button>
          <Link
            href={`/auth/sign-up?next=${encodeURIComponent(redirectTo)}`}
            className={styles.secondary}
          >
            Use a different email
          </Link>
        </div>
      </div>
    </section>
  );
}
