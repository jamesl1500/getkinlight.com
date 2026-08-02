import { CareWorkspace } from "@/components/care/care-workspace";
import { getCareWorkspaceData } from "@/lib/care";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Care",
};

export default async function CarePage({
  searchParams,
}: {
  searchParams: Promise<{ recipient?: string; tab?: string }>;
}) {
  const { recipient, tab } = await searchParams;
  const data = await getCareWorkspaceData(recipient);

  return <CareWorkspace data={data} initialTab={tab} />;
}
