import { FamilyWorkspace } from "@/components/family/family-workspace";
import { getFamilyWorkspaceData } from "@/lib/family";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Family" };

export default async function FamilyPage({
  searchParams,
}: {
  searchParams: Promise<{ household?: string }>;
}) {
  const { household } = await searchParams;
  const data = await getFamilyWorkspaceData(household);
  return <FamilyWorkspace data={data} />;
}
