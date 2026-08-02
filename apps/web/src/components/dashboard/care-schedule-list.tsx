"use client";

import type { CareScheduleItem } from "@/lib/care-schedule";
import { CalendarDays, CircleDot, Clock3, MapPin } from "lucide-react";
import styles from "./care-schedule-list.module.scss";

const kindLabels = {
  appointment: "Appointment",
  event: "Family event",
  medication: "Medication",
  meal: "Eating reminder",
};

export function CareScheduleList({
  items,
  onSelect,
}: {
  items: CareScheduleItem[];
  onSelect?: (item: CareScheduleItem) => void;
}) {
  if (items.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>
          <CalendarDays size={22} aria-hidden />
        </span>
        <h3>Your day is clear</h3>
        <p>No care reminders or family events are scheduled for today.</p>
      </div>
    );
  }

  return (
    <ol className={styles.scheduleList}>
      {items.map((item) => (
        <li key={item.id} className={styles.scheduleItem} data-kind={item.kind}>
          <div className={styles.time}>
            <Clock3 size={14} aria-hidden />
            {item.isAllDay
              ? "All day"
              : new Intl.DateTimeFormat("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(item.startsAt))}
          </div>
          <span className={styles.marker} aria-hidden>
            <CircleDot size={16} />
          </span>
          <button
            type="button"
            className={styles.itemCopy}
            onClick={() => onSelect?.(item)}
            disabled={!onSelect}
            aria-label={onSelect ? `View ${item.title} details` : undefined}
          >
            <div className={styles.itemHeading}>
              <h3>{item.title}</h3>
              <span>{kindLabels[item.kind]}</span>
            </div>
            {(item.recipientName || item.detail) && (
              <p>
                {item.recipientName}
                {item.recipientName && item.detail ? " · " : ""}
                {item.detail && (
                  <>
                    <MapPin size={12} aria-hidden />
                    {item.detail}
                  </>
                )}
              </p>
            )}
          </button>
        </li>
      ))}
    </ol>
  );
}
