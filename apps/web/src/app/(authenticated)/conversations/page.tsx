import { ConversationWorkspace } from "@/components/conversations/conversation-workspace";
import { getConversationWorkspaceData } from "@/lib/conversations";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Conversations" };

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ household?: string }>;
}) {
  const { household } = await searchParams;
  const data = await getConversationWorkspaceData(household);
  return <ConversationWorkspace data={data} />;
}
