"use client";

import { createBrowserApiClient } from "@/lib/api/client";
import { createKinlightClient } from "@getkinlight.com/shared";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./settings.module.scss";

export function AccountDeletionForm() {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  async function deleteAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsDeleting(true);

    try {
      await createBrowserApiClient().account.delete({
        confirmation: "DELETE",
      });
      await createKinlightClient().auth.signOut({ scope: "local" });
      router.replace("/auth/sign-in?deleted=1");
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to delete your account.",
      );
      setIsDeleting(false);
    }
  }

  return (
    <form className={styles.dangerZone} onSubmit={deleteAccount}>
      <div>
        <h3>Delete account</h3>
        <p>
          This permanently deletes your profile and one-person households. If
          others share a household you solely own, transfer ownership first.
        </p>
      </div>
      <label>
        <span>Type DELETE to confirm</span>
        <input
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          required
        />
      </label>
      {error ? <p className={styles.errorMessage}>{error}</p> : null}
      <button type="submit" disabled={confirmation !== "DELETE" || isDeleting}>
        <Trash2 size={16} aria-hidden />
        {isDeleting ? "Deleting..." : "Delete account permanently"}
      </button>
    </form>
  );
}
