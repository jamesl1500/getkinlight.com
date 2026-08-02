"use client";

import { createKinlightClient } from "@getkinlight.com/shared";
import { Check, KeyRound } from "lucide-react";
import { useState } from "react";
import styles from "./settings.module.scss";

export function SecuritySettingsForm() {
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsError(false);
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password"));

    if (password !== String(data.get("confirmation"))) {
      setIsError(true);
      setMessage("The passwords do not match.");
      return;
    }

    setIsSaving(true);
    const supabase = createKinlightClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setIsError(true);
      setMessage(error.message);
    } else {
      form.reset();
      setMessage("Password updated.");
    }
    setIsSaving(false);
  }

  return (
    <form className={styles.settingsForm} onSubmit={submit}>
      <div className={styles.fieldGrid}>
        <label>
          <span>New password</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label>
          <span>Confirm new password</span>
          <input
            name="confirmation"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
      </div>
      <div className={styles.formActions}>
        {message && (
          <p className={isError ? styles.errorMessage : styles.successMessage}>
            {!isError && <Check size={15} aria-hidden />}
            {message}
          </p>
        )}
        <button type="submit" disabled={isSaving}>
          <KeyRound size={16} aria-hidden />
          {isSaving ? "Updating..." : "Update password"}
        </button>
      </div>
    </form>
  );
}
