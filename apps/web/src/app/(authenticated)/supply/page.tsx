import { SupplyWorkspace } from "@/components/supply/supply-workspace";
import { getSupplyWorkspaceData } from "@/lib/supply";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Supply list" };

export default async function SupplyPage({
  searchParams,
}: {
  searchParams: Promise<{ household?: string }>;
}) {
  const { household } = await searchParams;
  const data = await getSupplyWorkspaceData(household);
  return <SupplyWorkspace key={data.selectedHousehold?.id ?? "none"} data={data} />;
}
