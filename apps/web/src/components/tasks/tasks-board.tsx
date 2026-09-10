"use client";

import { createBrowserApiClient } from "@/lib/api/client";
import type { TaskBoardData, TaskBoardItem } from "@/lib/tasks";
import type { ScheduleTaskAssignment } from "@getkinlight.com/shared";
import {
  CalendarClock,
  CircleDashed,
  ListChecks,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./tasks-board.module.scss";

const kindLabels: Record<TaskBoardItem["kind"], string> = {
  appointment: "Appointment",
  event: "Family event",
  medication: "Medication",
  meal: "Eating reminder",
};

const UNCLAIMED = "unclaimed";

function cardTime(item: TaskBoardItem) {
  return item.isAllDay
    ? "All day"
    : new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(item.startsAt));
}

export function TasksBoard({ data }: { data: TaskBoardData }) {
  const router = useRouter();
  const [items, setItems] = useState(data.items);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const household = data.selectedHousehold;

  function applyAssignment(
    item: TaskBoardItem,
    assignment: ScheduleTaskAssignment | null,
  ) {
    setItems((current) =>
      current.map((existing) =>
        existing.id === item.id
          ? {
              ...existing,
              assignedTo: assignment?.assignedTo ?? null,
              assignedToName: assignment?.assignedToName ?? null,
            }
          : existing,
      ),
    );
  }

  async function moveTo(item: TaskBoardItem, destination: string) {
    if (!household || busyId) return;
    setBusyId(item.id);
    setError("");
    try {
      const result = await createBrowserApiClient().schedule.claimTask(
        destination === UNCLAIMED
          ? {
              action: "unclaim",
              householdId: household.id,
              resourceType: item.kind,
              resourceId: item.sourceId,
            }
          : destination === data.currentUserId
            ? {
                action: "claim",
                householdId: household.id,
                resourceType: item.kind,
                resourceId: item.sourceId,
              }
            : {
                action: "assign",
                householdId: household.id,
                resourceType: item.kind,
                resourceId: item.sourceId,
                assigneeId: destination,
              },
      );
      if (!result.ok) throw new Error(result.message);
      applyAssignment(item, result.assignment);
      router.refresh();
    } catch (moveError) {
      setError(
        moveError instanceof Error
          ? moveError.message
          : "Unable to move this task.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!household) {
    return (
      <main className={styles.emptyPage}>
        <span>
          <ListChecks size={28} aria-hidden />
        </span>
        <h1>No household yet</h1>
        <p>Create or join a household to start assigning family tasks.</p>
      </main>
    );
  }

  const columns: Array<{
    id: string;
    label: string;
    items: TaskBoardItem[];
  }> = [
    {
      id: UNCLAIMED,
      label: "Unclaimed",
      items: items.filter((item) => !item.assignedTo),
    },
    ...data.members.map((member) => ({
      id: member.userId,
      label:
        member.userId === data.currentUserId
          ? `${member.displayName} (you)`
          : member.displayName,
      items: items.filter((item) => item.assignedTo === member.userId),
    })),
  ];

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p>Family tasks</p>
          <h1>Tasks</h1>
          <span>
            Everything claimable across the next few weeks for {household.name}
            .
          </span>
        </div>
        <ListChecks size={22} aria-hidden />
      </header>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.board}>
        {columns.map((column) => (
          <section key={column.id} className={styles.column}>
            <header>
              <h2>{column.label}</h2>
              <span>{column.items.length}</span>
            </header>
            <div className={styles.cardList}>
              {column.items.length === 0 && (
                <p className={styles.emptyColumn}>No tasks here.</p>
              )}
              {column.items
                .sort((left, right) =>
                  left.startsAt.localeCompare(right.startsAt),
                )
                .map((item) => {
                  const canMove =
                    !item.assignedTo ||
                    item.assignedTo === data.currentUserId ||
                    data.canAssign;
                  return (
                    <article key={item.id} className={styles.card}>
                      <div className={styles.cardHeading}>
                        <span data-kind={item.kind}>{kindLabels[item.kind]}</span>
                        <h3>{item.title}</h3>
                      </div>
                      <div className={styles.cardMeta}>
                        <span>
                          <CalendarClock size={13} aria-hidden />
                          {cardTime(item)}
                        </span>
                        {item.recipientName && (
                          <span>
                            <UserRound size={13} aria-hidden />
                            {item.recipientName}
                          </span>
                        )}
                      </div>
                      {canMove ? (
                        <select
                          value={item.assignedTo ?? UNCLAIMED}
                          disabled={busyId === item.id}
                          onChange={(event) =>
                            void moveTo(item, event.target.value)
                          }
                          aria-label={`Move ${item.title}`}
                        >
                          <option value={UNCLAIMED}>Unclaimed</option>
                          {data.members
                            .filter(
                              (member) =>
                                member.userId === data.currentUserId ||
                                data.canAssign,
                            )
                            .map((member) => (
                              <option key={member.userId} value={member.userId}>
                                {member.userId === data.currentUserId
                                  ? "Me"
                                  : member.displayName}
                              </option>
                            ))}
                        </select>
                      ) : (
                        <p className={styles.readOnly}>
                          <CircleDashed size={13} aria-hidden />
                          Assigned by a household owner or caregiver
                        </p>
                      )}
                    </article>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
