import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";
import styles from "@/components/settings/settings.module.scss";
import { createKinlightServerComponentClient } from "@/lib/supabase/server";
import { UserRound } from "lucide-react";
import { redirect } from "next/navigation";

export default async function ProfileSettingsPage() {
  const supabase = await createKinlightServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, username")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    redirect("/auth/onboarding");
  }

  const displayName =
    `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <section className={styles.sectionStack}>
      <div className={styles.sectionHeading}>
        <span className={styles.sectionIcon}>
          <UserRound size={20} aria-hidden />
        </span>
        <div>
          <p className={styles.eyebrow}>Public identity</p>
          <h2>Profile details</h2>
          <p>This is how your name appears to people in your household.</p>
        </div>
      </div>

      <div className={styles.profileSummary}>
        <span className={styles.largeAvatar}>{initials || "KL"}</span>
        <div>
          <strong>{displayName || "Kinlight member"}</strong>
          <span>{user.email}</span>
        </div>
      </div>

      <ProfileSettingsForm
        userId={user.id}
        firstName={profile.first_name ?? ""}
        lastName={profile.last_name ?? ""}
        username={profile.username ?? ""}
      />
    </section>
  );
}
