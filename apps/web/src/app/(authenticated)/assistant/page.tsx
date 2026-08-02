import { AiWorkspace } from "@/components/ai/ai-workspace";
import { createKinlightServerComponentClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kinlight AI",
};

export default async function AssistantPage() {
  const supabase = await createKinlightServerComponentClient();
  const [householdsResult, recipientsResult] = await Promise.all([
    supabase.from("households").select("id, name").order("name"),
    supabase
      .from("care_recipients")
      .select("id, household_id, first_name, preferred_name")
      .eq("is_active", true)
      .order("first_name"),
  ]);

  if (householdsResult.error) throw householdsResult.error;
  if (recipientsResult.error) throw recipientsResult.error;

  return (
    <AiWorkspace
      households={(householdsResult.data ?? []).map((household) => ({
        id: household.id,
        name: household.name,
      }))}
      recipients={(recipientsResult.data ?? []).map((recipient) => ({
        id: recipient.id,
        householdId: recipient.household_id,
        name: recipient.preferred_name ?? recipient.first_name,
      }))}
    />
  );
}
