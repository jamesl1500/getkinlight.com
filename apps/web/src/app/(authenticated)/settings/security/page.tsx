import { SecuritySettingsForm } from "@/components/settings/security-settings-form";
import styles from "@/components/settings/settings.module.scss";
import { createKinlightServerComponentClient } from "@/lib/supabase/server";
import { LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";

export default async function SecuritySettingsPage() {
  const supabase = await createKinlightServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const provider =
    user.app_metadata.provider === "email"
      ? "Email and password"
      : String(user.app_metadata.provider ?? "Email");

  return (
    <section className={styles.sectionStack}>
      <div className={styles.sectionHeading}>
        <span className={styles.sectionIcon}>
          <LockKeyhole size={20} aria-hidden />
        </span>
        <div>
          <p className={styles.eyebrow}>Sign-in and recovery</p>
          <h2>Account security</h2>
          <p>Review your sign-in identity and keep your password current.</p>
        </div>
      </div>

      <dl className={styles.detailList}>
        <div>
          <dt>Email address</dt>
          <dd>{user.email ?? "Not available"}</dd>
        </div>
        <div>
          <dt>Sign-in method</dt>
          <dd>{provider}</dd>
        </div>
        <div>
          <dt>Account created</dt>
          <dd>
            {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
              new Date(user.created_at),
            )}
          </dd>
        </div>
        <div>
          <dt>Last sign-in</dt>
          <dd>
            {user.last_sign_in_at
              ? new Intl.DateTimeFormat("en", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(user.last_sign_in_at))
              : "Not available"}
          </dd>
        </div>
      </dl>

      <div className={styles.subsectionHeading}>
        <h3>Change password</h3>
        <p>
          Use at least eight characters and avoid passwords used on other
          services.
        </p>
      </div>
      <SecuritySettingsForm />
    </section>
  );
}
