"use client";

import {
  OnboardingRequestSchema,
  OnboardingResponseSchema,
  createKinlightClient,
} from "@getkinlight.com/shared";
import type { OnboardingRole } from "@getkinlight.com/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./onboarding-flow.module.scss";

const roleOptions: Array<{
  value: OnboardingRole;
  title: string;
  copy: string;
}> = [
  {
    value: "family-organizer",
    title: "Family organizer",
    copy: "You will set up the household space and keep everyone connected.",
  },
  {
    value: "parent",
    title: "Parent",
    copy: "You are coordinating support, routines, and care updates for your family.",
  },
  {
    value: "caregiver",
    title: "Caregiver",
    copy: "You help manage day-to-day support and need a calmer way to stay aligned.",
  },
  {
    value: "relative",
    title: "Relative",
    copy: "You want a clear view of what is happening and how to help when needed.",
  },
];

export function OnboardingFlow({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [accessToken, setAccessToken] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<OnboardingRole>("family-organizer");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadSessionAndProfile() {
      try {
        const supabase = createKinlightClient();
        const [{ data: sessionData }, { data: userData, error: userError }] =
          await Promise.all([
            supabase.auth.getSession(),
            supabase.auth.getUser(),
          ]);

        if (userError) {
          throw userError;
        }

        const session = sessionData.session;

        if (!session) {
          router.replace(
            `/auth/sign-in?next=${encodeURIComponent(redirectTo)}`,
          );
          return;
        }

        const bearer = session.access_token;

        if (!isActive) {
          return;
        }

        setAccessToken(bearer);
        setEmail(userData.user?.email ?? "");

        const response = await fetch("/api/onboarding", {
          headers: {
            Authorization: `Bearer ${bearer}`,
          },
        });

        const responseData = OnboardingResponseSchema.parse(
          await response.json(),
        );

        if (response.ok && responseData.profile) {
          setFirstName(responseData.profile.first_name ?? "");
          setLastName(responseData.profile.last_name ?? "");
          setUsername(responseData.profile.username ?? "");
          setRole(
            (responseData.profile.role as OnboardingRole) || "family-organizer",
          );
        }
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Unable to load onboarding.";
        if (isActive) {
          setError(message);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadSessionAndProfile();

    return () => {
      isActive = false;
    };
  }, [redirectTo, router]);

  function handleContinueFromProfile() {
    if (!firstName.trim() || !lastName.trim() || !username.trim()) {
      setError("Please complete your name and username before continuing.");
      return;
    }

    setError(null);
    setCurrentStep(3);
  }

  async function handleSubmit() {
    setError(null);
    setIsSaving(true);

    try {
      const payloadResult = OnboardingRequestSchema.safeParse({
        accessToken,
        firstName,
        lastName,
        username,
        role,
      });

      if (!payloadResult.success) {
        throw new Error(
          payloadResult.error.issues[0]?.message ??
            "Please review the onboarding form.",
        );
      }

      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payloadResult.data),
      });

      const responseData = OnboardingResponseSchema.parse(
        await response.json(),
      );

      if (!response.ok || !responseData.ok) {
        throw new Error(responseData.message);
      }

      if (redirectTo !== "/dashboard") {
        router.replace(redirectTo);
        return;
      }

      setCurrentStep(4);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to finish onboarding.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const progressWidth = `${(currentStep / 4) * 100}%`;

  if (isLoading) {
    return (
      <section className={styles.shell}>
        <div className={styles.progressBar}>
          <div className={styles.progressValue} style={{ width: "25%" }} />
        </div>
        <div className={styles.panel}>
          <div className={styles.panelBody}>
            <p className={styles.eyebrow}>Onboarding</p>
            <h1 className={styles.title}>Preparing your setup flow...</h1>
            <p className={styles.copy}>
              We are checking your account and loading your profile details.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.shell}>
      <div className={styles.progressBar}>
        <div
          className={styles.progressValue}
          style={{ width: progressWidth }}
        />
      </div>

      {currentStep === 1 ? (
        <div className={styles.panel}>
          <div className={styles.panelBody}>
            <p className={styles.eyebrow}>Step 1 of 4</p>
            <h1 className={styles.title}>Welcome to your family space.</h1>
            <p className={styles.copy}>
              Your email is confirmed{email ? ` for ${email}` : ""}. Next,
              let&apos;s shape the profile everyone in your household will see.
            </p>
            <p className={styles.stepMeta}>This takes less than two minutes.</p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primary}
                onClick={() => setCurrentStep(2)}
              >
                Start onboarding
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {currentStep === 2 ? (
        <div className={styles.panel}>
          <div className={styles.panelBody}>
            <p className={styles.eyebrow}>Step 2 of 4</p>
            <h1 className={styles.title}>Tell your family who you are.</h1>
            <p className={styles.copy}>
              These details become your starting profile and help make future
              invitations clearer.
            </p>

            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.label}>First name</span>
                <input
                  className={styles.input}
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Last name</span>
                <input
                  className={styles.input}
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                />
              </label>

              <label className={`${styles.field} ${styles.fieldFull}`}>
                <span className={styles.label}>Username</span>
                <input
                  className={styles.input}
                  value={username}
                  onChange={(event) =>
                    setUsername(event.target.value.toLowerCase())
                  }
                  placeholder="family-organizer"
                />
              </label>
            </div>

            {error ? <p className={styles.message}>{error}</p> : null}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setCurrentStep(1)}
              >
                Back
              </button>
              <button
                type="button"
                className={styles.primary}
                onClick={handleContinueFromProfile}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {currentStep === 3 ? (
        <div className={styles.panel}>
          <div className={styles.panelBody}>
            <p className={styles.eyebrow}>Step 3 of 4</p>
            <h1 className={styles.title}>
              Choose how you show up in Kinlight.
            </h1>
            <p className={styles.copy}>
              Pick the role that best matches how you will use this space. You
              can change it later.
            </p>

            <div className={styles.roleGrid}>
              {roleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.roleCard} ${role === option.value ? styles.roleCardActive : ""}`}
                  onClick={() => setRole(option.value)}
                >
                  <p className={styles.roleTitle}>{option.title}</p>
                  <p className={styles.roleCopy}>{option.copy}</p>
                </button>
              ))}
            </div>

            <div className={styles.summary}>
              <div className={styles.summaryRow}>
                <span>Name</span>
                <strong>
                  {firstName} {lastName}
                </strong>
              </div>
              <div className={styles.summaryRow}>
                <span>Username</span>
                <strong>@{username}</strong>
              </div>
              <div className={styles.summaryRow}>
                <span>Role</span>
                <strong>
                  {roleOptions.find((option) => option.value === role)?.title}
                </strong>
              </div>
            </div>

            {error ? <p className={styles.message}>{error}</p> : null}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setCurrentStep(2)}
              >
                Back
              </button>
              <button
                type="button"
                className={styles.primary}
                onClick={() => void handleSubmit()}
                disabled={isSaving}
              >
                {isSaving ? "Finishing setup..." : "Complete onboarding"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {currentStep === 4 ? (
        <div className={`${styles.panel} ${styles.successPanel}`}>
          <div className={styles.panelBody}>
            <p className={styles.eyebrow}>Step 4 of 4</p>
            <h1 className={styles.title}>Your Kinlight space is ready.</h1>
            <p className={styles.copy}>
              Your profile is saved and your account is fully set up. You can
              head back to the site now and keep building the experience from
              there.
            </p>
            <p className={styles.stepMeta}>
              You can update these details later from your account settings.
            </p>
            <div className={styles.actions}>
              <Link href="/" className={styles.primary}>
                Go to home
              </Link>
              <Link href="/features" className={styles.secondary}>
                Explore features
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
