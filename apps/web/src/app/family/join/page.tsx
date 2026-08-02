import { JoinHousehold } from "@/components/family/join-household";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Join household" };

export default async function JoinHouseholdPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <JoinHousehold invitationToken={token ?? ""} />;
}
