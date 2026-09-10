import { TasksBoard } from "@/components/tasks/tasks-board";
import { getTasksBoardData } from "@/lib/tasks";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ household?: string }>;
}) {
  const { household } = await searchParams;
  const data = await getTasksBoardData(household);
  return <TasksBoard key={data.selectedHousehold?.id ?? "none"} data={data} />;
}
