"use client";

import {
  AuthRequestSchema,
  AuthResponseSchema,
  createKinlightClient,
} from "@getkinlight.com/shared";
import type { AuthMode } from "@getkinlight.com/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./auth-form.module.scss";

type AuthFormProps = {
  mode: AuthMode;
  tone?: "default" | "footer";
  redirectTo?: string;
};

const modeCopy: Record<
  AuthMode,
  { title: string; subtitle: string; action: string }
> = {
  "sign-in": {
    title: "Welcome back",
    subtitle: "Step back into your family space in seconds.",
    action: "Sign in",
  },
  "sign-up": {
    title: "Create your Kinlight account",
    subtitle: "Start one calm place for updates, care, and connection.",
    action: "Create account",
  },
  "forgot-password": {
    title: "Reset your password",
    subtitle: "We will send you a secure link to reset your password.",
    action: "Send reset link",
  },
  "update-password": {
    title: "Choose a new password",
    subtitle: "Use a strong password to keep family updates protected.",
    action: "Update password",
  },
};

export function AuthForm({
  mode,
  tone = "default",
  redirectTo = "/",
}: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const copy = modeCopy[mode];

  function isProfileComplete(
    profile:
      | {
          first_name: string | null;
          last_name: string | null;
          username: string | null;
        }
      | null
      | undefined,
  ) {
    return Boolean(
      profile?.first_name?.trim() &&
      profile?.last_name?.trim() &&
      profile?.username?.trim(),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      const supabase = createKinlightClient();
      const sessionResult =
        mode === "update-password" ? await supabase.auth.getSession() : null;
      const accessToken = sessionResult?.data.session?.access_token;

      const payload =
        mode === "sign-in"
          ? {
              mode,
              email,
              password,
            }
          : mode === "sign-up"
            ? {
                mode,
                email,
                password,
                redirectTo,
              }
            : mode === "forgot-password"
              ? {
                  mode,
                  email,
                }
              : {
                  mode,
                  password,
                  accessToken,
                };

      const requestResult = AuthRequestSchema.safeParse(payload);

      if (!requestResult.success) {
        throw new Error("Please check the form values and try again.");
      }

      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestResult.data),
      });

      const responseData = AuthResponseSchema.parse(await response.json());

      if (!response.ok || !responseData.ok) {
        throw new Error(responseData.message);
      }

      if (responseData.session) {
        await supabase.auth.setSession({
          access_token: responseData.session.access_token,
          refresh_token: responseData.session.refresh_token,
        });
      }

      if (mode === "sign-in") {
        router.push(
          isProfileComplete(responseData.profile)
            ? redirectTo
            : `/auth/onboarding?next=${encodeURIComponent(redirectTo)}`,
        );
        return;
      }

      if (mode === "sign-up") {
        if (responseData.session) {
          router.push(
            `/auth/onboarding?next=${encodeURIComponent(redirectTo)}`,
          );
          return;
        }

        router.push(
          `/auth/verify-email?email=${encodeURIComponent(email)}&next=${encodeURIComponent(redirectTo)}`,
        );
        return;
      }

      setMessage(responseData.message);
    } catch (submitError) {
      const err = submitError as { message?: string };
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  const shouldShowEmail = mode !== "update-password";
  const shouldShowPassword = mode !== "forgot-password";

  return (
    <div
      className={`${styles.card} ${tone === "footer" ? styles.cardFooter : ""}`}
    >
      <h1 className={styles.title}>{copy.title}</h1>
      <p className={styles.subtitle}>{copy.subtitle}</p>

      <form onSubmit={handleSubmit} className={styles.form}>
        {shouldShowEmail && (
          <label className={styles.field}>
            <span className={styles.label}>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={styles.input}
              placeholder="you@family.com"
            />
          </label>
        )}

        {shouldShowPassword && (
          <label className={styles.field}>
            <span className={styles.label}>Password</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={styles.input}
              placeholder="At least 8 characters"
            />
          </label>
        )}

        <button type="submit" disabled={isLoading} className={styles.button}>
          {isLoading ? "Please wait..." : copy.action}
        </button>
      </form>

      {message && (
        <p className={`${styles.message} ${styles.messageSuccess}`}>
          {message}
        </p>
      )}
      {error && (
        <p className={`${styles.message} ${styles.messageError}`}>{error}</p>
      )}

      <div className={styles.links}>
        {mode !== "sign-in" && (
          <Link
            href={`/auth/sign-in?next=${encodeURIComponent(redirectTo)}`}
            className={styles.link}
          >
            Back to sign in
          </Link>
        )}
        {mode === "sign-in" && (
          <>
            <Link href="/auth/forgot-password" className={styles.link}>
              Forgot password?
            </Link>
            <Link
              href={`/auth/sign-up?next=${encodeURIComponent(redirectTo)}`}
              className={styles.link}
            >
              Need an account?
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
