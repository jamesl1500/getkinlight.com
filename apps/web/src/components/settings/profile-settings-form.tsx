"use client";

import { createKinlightClient } from "@getkinlight.com/shared";
import { Check, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./settings.module.scss";

type ProfileSettingsFormProps = {
  userId: string;
  firstName: string;
  lastName: string;
  username: string;
};

export function ProfileSettingsForm({
  userId,
  firstName,
  lastName,
  username,
}: ProfileSettingsFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");
    setIsError(false);

    const data = new FormData(event.currentTarget);
    const supabase = createKinlightClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: String(data.get("firstName")).trim(),
        last_name: String(data.get("lastName")).trim(),
        username: String(data.get("username")).trim(),
      })
      .eq("user_id", userId);

    if (error) {
      setIsError(true);
      setMessage(
        error.code === "23505"
          ? "That username is already in use."
          : "Your profile could not be saved.",
      );
    } else {
      setMessage("Profile saved.");
      router.refresh();
    }

    setIsSaving(false);
  }

  return (
    <form className={styles.settingsForm} onSubmit={submit}>
      <div className={styles.fieldGrid}>
        <label>
          <span>First name</span>
          <input
            name="firstName"
            defaultValue={firstName}
            autoComplete="given-name"
            required
            maxLength={80}
          />
        </label>
        <label>
          <span>Last name</span>
          <input
            name="lastName"
            defaultValue={lastName}
            autoComplete="family-name"
            required
            maxLength={80}
          />
        </label>
      </div>
      <label>
        <span>Username</span>
        <input
          name="username"
          defaultValue={username}
          autoComplete="username"
          required
          minLength={3}
          maxLength={40}
        />
        <small>
          Used as your compact identifier across shared household activity.
        </small>
      </label>

      <div className={styles.formActions}>
        {message && (
          <p className={isError ? styles.errorMessage : styles.successMessage}>
            {!isError && <Check size={15} aria-hidden />}
            {message}
          </p>
        )}
        <button type="submit" disabled={isSaving}>
          <Save size={16} aria-hidden />
          {isSaving ? "Saving..." : "Save profile"}
        </button>
      </div>
    </form>
  );
}
