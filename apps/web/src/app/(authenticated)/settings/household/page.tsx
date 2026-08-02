import styles from "@/components/settings/settings.module.scss";
import { createKinlightServerComponentClient } from "@/lib/supabase/server";
import { House, ShieldCheck, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";

export default async function HouseholdSettingsPage() {
  const supabase = await createKinlightServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const [householdsResult, membersResult] = await Promise.all([
    supabase
      .from("households")
      .select("id, name, created_at")
      .order("created_at"),
    supabase.from("household_members").select("household_id, user_id, role"),
  ]);
  const households = householdsResult.data ?? [];
  const members = membersResult.data ?? [];

  return (
    <section className={styles.sectionStack}>
      <div className={styles.sectionHeading}>
        <span className={styles.sectionIcon}>
          <House size={20} aria-hidden />
        </span>
        <div>
          <p className={styles.eyebrow}>Shared access</p>
          <h2>Your households</h2>
          <p>
            See the family spaces you belong to and the access assigned to you.
          </p>
        </div>
      </div>

      <div className={styles.householdList}>
        {households.map((household) => {
          const householdMembers = members.filter(
            (member) => member.household_id === household.id,
          );
          const membership = householdMembers.find(
            (member) => member.user_id === user.id,
          );
          return (
            <article key={household.id} className={styles.householdItem}>
              <div className={styles.householdTitle}>
                <span>
                  <House size={19} aria-hidden />
                </span>
                <div>
                  <h3>{household.name}</h3>
                  <p>
                    Created{" "}
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                    }).format(new Date(household.created_at))}
                  </p>
                </div>
              </div>
              <div className={styles.householdFacts}>
                <span>
                  <UsersRound size={16} aria-hidden />
                  {householdMembers.length}{" "}
                  {householdMembers.length === 1 ? "member" : "members"}
                </span>
                <span>
                  <ShieldCheck size={16} aria-hidden />
                  {membership?.role ?? "Member"}
                </span>
              </div>
            </article>
          );
        })}
        {households.length === 0 && (
          <p className={styles.emptyState}>
            No household membership was found for this account.
          </p>
        )}
      </div>

      <aside className={styles.infoNote}>
        <ShieldCheck size={18} aria-hidden />
        <p>
          <strong>Household privacy</strong>
          <span>
            Only people in a household can see its membership and care
            information. Owners manage invitations and roles.
          </span>
        </p>
      </aside>
    </section>
  );
}
