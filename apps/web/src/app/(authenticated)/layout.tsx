import { createKinlightServerComponentClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createKinlightServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const [
    profileResult,
    householdsResult,
    recipientsResult,
    conversationsResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name, username")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("households").select("id, name").order("name"),
    supabase
      .from("care_recipients")
      .select("id, household_id, first_name, preferred_name")
      .eq("is_active", true)
      .order("first_name"),
    supabase
      .from("household_conversations")
      .select("id, household_id")
      .eq("is_default", true),
  ]);
  const profile = profileResult.data;

  if (householdsResult.error) throw householdsResult.error;
  if (recipientsResult.error) throw recipientsResult.error;
  if (conversationsResult.error) throw conversationsResult.error;

  if (!profile?.first_name || !profile.last_name || !profile.username) {
    redirect("/auth/onboarding");
  }

  const displayName = `${profile.first_name} ${profile.last_name}`;

  return (
    <AppShell
      userId={user.id}
      displayName={displayName}
      email={user.email ?? ""}
      conversations={(conversationsResult.data ?? []).map((conversation) => ({
        id: conversation.id,
        householdId: conversation.household_id,
      }))}
      households={(householdsResult.data ?? []).map((household) => ({
        id: household.id,
        name: household.name,
      }))}
      recipients={(recipientsResult.data ?? []).map((recipient) => ({
        id: recipient.id,
        householdId: recipient.household_id,
        name: recipient.preferred_name ?? recipient.first_name,
      }))}
    >
      {children}
    </AppShell>
  );
}
