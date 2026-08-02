"use client";

import { CareScheduleList } from "@/components/dashboard/care-schedule-list";
import { createBrowserApiClient } from "@/lib/api/client";
import type { CareScheduleItem } from "@/lib/care-schedule";
import {
  type CreateCareScheduleRequest,
  type UpdateFamilyEventRequest,
} from "@getkinlight.com/shared";
import { CalendarDays, Clock3, Pencil, Plus, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import styles from "./calendar-board.module.scss";

export type CalendarHousehold = { id: string; name: string };
export type CalendarRecipient = {
  id: string;
  householdId: string;
  name: string;
};

type CalendarBoardProps = {
  days: string[];
  month: number;
  today: string;
  initialSelectedDate: string;
  initialItems: CareScheduleItem[];
  households: CalendarHousehold[];
  recipients: CalendarRecipient[];
};

const typeOptions = [
  { value: "event", label: "Event" },
  { value: "appointment", label: "Appointment" },
  { value: "medication", label: "Medication" },
  { value: "meal", label: "Eating" },
] as const;

function readableDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function CalendarBoard({
  days,
  month,
  today,
  initialSelectedDate,
  initialItems,
  households,
  recipients,
}: CalendarBoardProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  const [items, setItems] = useState(initialItems);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CareScheduleItem | null>(
    null,
  );

  const itemsByDay = Map.groupBy(items, (item) => item.startsAt.slice(0, 10));
  const selectedItems = itemsByDay.get(selectedDate) ?? [];

  function selectDay(date: string) {
    setSelectedDate(date);
    setIsModalOpen(true);
  }

  return (
    <>
      <div className={styles.calendarLayout}>
        <section
          className={styles.monthPanel}
          aria-label="Monthly care calendar"
        >
          <div className={styles.weekdays} aria-hidden>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className={styles.monthGrid}>
            {days.map((date) => {
              const dayItems = itemsByDay.get(date) ?? [];
              const dayNumber = Number(date.slice(8, 10));
              const isCurrentMonth = Number(date.slice(5, 7)) - 1 === month;
              return (
                <article
                  key={date}
                  className={`${styles.day} ${!isCurrentMonth ? styles.outsideMonth : ""} ${date === today ? styles.today : ""} ${date === selectedDate ? styles.selectedDay : ""}`}
                >
                  <button
                    type="button"
                    className={styles.dayOpen}
                    onClick={() => selectDay(date)}
                    aria-label={`${readableDate(date)}, ${dayItems.length} scheduled items. Add an item.`}
                  >
                    <time dateTime={date}>{dayNumber}</time>
                  </button>
                  <div className={styles.dayItems}>
                    {dayItems.slice(0, 3).map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        data-kind={item.kind}
                        title={item.title}
                        onClick={() => {
                          setSelectedDate(date);
                          setSelectedItem(item);
                        }}
                      >
                        {item.title}
                      </button>
                    ))}
                    {dayItems.length > 3 && (
                      <small>+{dayItems.length - 3} more</small>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className={styles.agendaPanel}>
          <div className={styles.agendaHeader}>
            <div>
              <p>{selectedDate === today ? "Today" : "Selected day"}</p>
              <h2>{readableDate(selectedDate)}</h2>
            </div>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              aria-label="Add schedule item"
              title="Add schedule item"
            >
              <Plus size={18} aria-hidden />
            </button>
          </div>
          <CareScheduleList items={selectedItems} onSelect={setSelectedItem} />
        </aside>
      </div>

      {isModalOpen && (
        <ScheduleModal
          date={selectedDate}
          households={households}
          recipients={recipients}
          onClose={() => setIsModalOpen(false)}
          onCreated={(item) => {
            setItems((current) =>
              [...current, item].sort((left, right) =>
                left.startsAt.localeCompare(right.startsAt),
              ),
            );
            setIsModalOpen(false);
            router.refresh();
          }}
        />
      )}
      {selectedItem && (
        <ScheduleDetailModal
          item={selectedItem}
          recipients={recipients}
          onClose={() => setSelectedItem(null)}
          onUpdated={(updatedItem) => {
            setItems((current) =>
              current
                .map((currentItem) =>
                  currentItem.kind === "event" &&
                  currentItem.sourceId === updatedItem.sourceId
                    ? updatedItem
                    : currentItem,
                )
                .sort((left, right) =>
                  left.startsAt.localeCompare(right.startsAt),
                ),
            );
            setSelectedDate(updatedItem.startsAt.slice(0, 10));
            setSelectedItem(updatedItem);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

const kindLabels = {
  appointment: "Appointment",
  event: "Family event",
  medication: "Medication reminder",
  meal: "Eating reminder",
};

function ScheduleDetailModal({
  item,
  recipients,
  onClose,
  onUpdated,
}: {
  item: CareScheduleItem;
  recipients: CalendarRecipient[];
  onClose: () => void;
  onUpdated: (item: CareScheduleItem) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const startsAt = new Date(item.startsAt);
  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(startsAt);
  const time = item.isAllDay
    ? "All day"
    : new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }).format(startsAt);
  const details = Array.isArray(item.details) ? item.details : [];

  if (isEditing && item.kind === "event") {
    return (
      <EditFamilyEventModal
        item={item}
        recipients={recipients}
        onCancel={() => setIsEditing(false)}
        onClose={onClose}
        onUpdated={(updatedItem) => {
          onUpdated(updatedItem);
          setIsEditing(false);
        }}
      />
    );
  }

  return createPortal(
    <div
      className={styles.modalBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`${styles.modal} ${styles.detailModal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-detail-title"
      >
        <header>
          <div>
            <p>{kindLabels[item.kind]}</p>
            <h2 id="schedule-detail-title">{item.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={19} aria-hidden />
          </button>
        </header>
        <div className={styles.detailSummary}>
          <div>
            <CalendarDays size={17} aria-hidden />
            <span>
              <strong>Date</strong>
              {date}
            </span>
          </div>
          <div>
            <Clock3 size={17} aria-hidden />
            <span>
              <strong>Time</strong>
              {time}
            </span>
          </div>
          <div>
            <UserRound size={17} aria-hidden />
            <span>
              <strong>Care recipient</strong>
              {item.recipientName ?? "Household-wide"}
            </span>
          </div>
        </div>
        <dl className={styles.detailList}>
          {details
            .filter((detail) => detail.label !== "Care recipient")
            .map((detail) => (
              <div key={`${detail.label}-${detail.value}`}>
                <dt>{detail.label}</dt>
                <dd>{formatDetailValue(detail.label, detail.value)}</dd>
              </div>
            ))}
        </dl>
        <footer className={styles.detailFooter}>
          {item.kind === "event" && item.sourceId && item.householdId && (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setIsEditing(true)}
            >
              <Pencil size={15} aria-hidden />
              Edit event
            </button>
          )}
          <button type="button" onClick={onClose}>
            Close
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function detailValue(item: CareScheduleItem, label: string) {
  return item.details?.find((detail) => detail.label === label)?.value ?? "";
}

function EditFamilyEventModal({
  item,
  recipients,
  onCancel,
  onClose,
  onUpdated,
}: {
  item: CareScheduleItem;
  recipients: CalendarRecipient[];
  onCancel: () => void;
  onClose: () => void;
  onUpdated: (item: CareScheduleItem) => void;
}) {
  const [recipientId, setRecipientId] = useState(item.recipientId ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const householdRecipients = recipients.filter(
    (recipient) => recipient.householdId === item.householdId,
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    const data = new FormData(event.currentTarget);
    const payload: UpdateFamilyEventRequest = {
      eventId: item.sourceId,
      householdId: item.householdId,
      recipientId: recipientId || undefined,
      title: String(data.get("title")),
      date: String(data.get("date")),
      time: String(data.get("time")),
      location: String(data.get("location") || ""),
      notes: String(data.get("notes") || ""),
      isAllDay: data.get("isAllDay") === "on",
    };

    try {
      const result =
        await createBrowserApiClient().schedule.updateEvent(payload);
      if (!result.ok || !result.item) throw new Error(result.message);
      onUpdated(result.item);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to update this event.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return createPortal(
    <div
      className={styles.modalBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-event-title"
      >
        <header>
          <div>
            <p>Family event</p>
            <h2 id="edit-event-title">Edit event</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={19} aria-hidden />
          </button>
        </header>
        <form onSubmit={submit} className={styles.form}>
          <div className={styles.fieldGrid}>
            <label>
              <span>Title</span>
              <input
                name="title"
                required
                maxLength={120}
                defaultValue={item.title}
                autoFocus
              />
            </label>
            <label>
              <span>Care recipient (optional)</span>
              <select
                value={recipientId}
                onChange={(event) => setRecipientId(event.target.value)}
              >
                <option value="">Household-wide</option>
                {householdRecipients.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>
                    {recipient.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Date</span>
              <input
                name="date"
                type="date"
                required
                defaultValue={item.startsAt.slice(0, 10)}
              />
            </label>
            <label>
              <span>Time</span>
              <input
                name="time"
                type="time"
                required
                defaultValue={item.startsAt.slice(11, 16)}
              />
            </label>
            <label>
              <span>Location</span>
              <input
                name="location"
                maxLength={500}
                defaultValue={detailValue(item, "Location")}
              />
            </label>
            <label className={styles.checkbox}>
              <input
                name="isAllDay"
                type="checkbox"
                defaultChecked={item.isAllDay}
              />
              <span>All-day event</span>
            </label>
            <label className={styles.fullField}>
              <span>Notes (optional)</span>
              <textarea
                name="notes"
                rows={3}
                maxLength={500}
                defaultValue={detailValue(item, "Description")}
              />
            </label>
          </div>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <footer>
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save changes"}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  );
}

function formatDetailValue(label: string, value: string) {
  if (label === "Ends" && value.includes("T"))
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  if (label === "Schedule starts" || label === "Schedule ends")
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(`${value}T00:00:00Z`));
  return value;
}

function ScheduleModal({
  date,
  households,
  recipients,
  onClose,
  onCreated,
}: {
  date: string;
  households: CalendarHousehold[];
  recipients: CalendarRecipient[];
  onClose: () => void;
  onCreated: (item: CareScheduleItem) => void;
}) {
  const [type, setType] = useState<CreateCareScheduleRequest["type"]>("event");
  const [householdId, setHouseholdId] = useState(households[0]?.id ?? "");
  const [recipientId, setRecipientId] = useState(
    recipients.find((recipient) => recipient.householdId === households[0]?.id)
      ?.id ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const householdRecipients = recipients.filter(
    (recipient) => recipient.householdId === householdId,
  );

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    const data = new FormData(event.currentTarget);
    const base = {
      type,
      householdId,
      recipientId: recipientId || undefined,
      date,
      time: String(data.get("time")),
    };
    const payload: CreateCareScheduleRequest =
      type === "event"
        ? {
            ...base,
            type,
            title: String(data.get("title")),
            location: String(data.get("location") || ""),
            notes: String(data.get("notes") || ""),
            isAllDay: data.get("isAllDay") === "on",
          }
        : type === "appointment"
          ? {
              ...base,
              type,
              title: String(data.get("title")),
              providerName: String(data.get("providerName") || ""),
              location: String(data.get("location") || ""),
              notes: String(data.get("notes") || ""),
            }
          : type === "medication"
            ? {
                ...base,
                type,
                title: String(data.get("title")),
                dosage: String(data.get("dosage") || ""),
                notes: String(data.get("notes") || ""),
              }
            : {
                ...base,
                type,
                title: String(data.get("title")),
                mealType: String(data.get("mealType")) as "meal",
                notes: String(data.get("notes") || ""),
              };

    try {
      const result = await createBrowserApiClient().schedule.create(payload);
      if (!result.ok || !result.item) throw new Error(result.message);
      onCreated(result.item);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to add this item.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return createPortal(
    <div
      className={styles.modalBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-modal-title"
      >
        <header>
          <div>
            <p>Add to {readableDate(date)}</p>
            <h2 id="schedule-modal-title">New care schedule item</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={19} aria-hidden />
          </button>
        </header>
        {households.length === 0 ? (
          <div className={styles.noHousehold}>
            <CalendarDays size={24} aria-hidden />
            <h3>Create a household first</h3>
            <p>A household is needed before schedule items can be added.</p>
          </div>
        ) : (
          <form onSubmit={submit} className={styles.form}>
            <fieldset className={styles.typePicker}>
              <legend>Type</legend>
              {typeOptions.map((option) => (
                <label key={option.value}>
                  <input
                    type="radio"
                    name="type"
                    value={option.value}
                    checked={type === option.value}
                    onChange={() => setType(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
            <div className={styles.fieldGrid}>
              {households.length > 1 && (
                <label>
                  <span>Household</span>
                  <select
                    value={householdId}
                    onChange={(event) => {
                      const nextHouseholdId = event.target.value;
                      setHouseholdId(nextHouseholdId);
                      setRecipientId(
                        recipients.find(
                          (recipient) =>
                            recipient.householdId === nextHouseholdId,
                        )?.id ?? "",
                      );
                    }}
                  >
                    {households.map((household) => (
                      <option key={household.id} value={household.id}>
                        {household.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                <span>
                  {type === "medication" ? "Medication name" : "Title"}
                </span>
                <input name="title" required maxLength={120} autoFocus />
              </label>
              <label>
                <span>Time</span>
                <input name="time" type="time" required defaultValue="09:00" />
              </label>
              <label>
                <span>Care recipient (optional)</span>
                <select
                  value={recipientId}
                  onChange={(event) => setRecipientId(event.target.value)}
                >
                  <option value="">Household-wide</option>
                  {householdRecipients.map((recipient) => (
                    <option key={recipient.id} value={recipient.id}>
                      {recipient.name}
                    </option>
                  ))}
                </select>
              </label>
              {type === "appointment" && (
                <>
                  <label>
                    <span>Provider</span>
                    <input name="providerName" maxLength={120} />
                  </label>
                  <label>
                    <span>Location</span>
                    <input name="location" maxLength={200} />
                  </label>
                </>
              )}
              {type === "event" && (
                <>
                  <label>
                    <span>Location</span>
                    <input name="location" maxLength={200} />
                  </label>
                  <label className={styles.checkbox}>
                    <input name="isAllDay" type="checkbox" />
                    <span>All-day event</span>
                  </label>
                </>
              )}
              {type === "medication" && (
                <label>
                  <span>Dosage</span>
                  <input
                    name="dosage"
                    maxLength={120}
                    placeholder="e.g. 1 tablet"
                  />
                </label>
              )}
              {type === "meal" && (
                <label>
                  <span>Reminder kind</span>
                  <select name="mealType" defaultValue="meal">
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                    <option value="snack">Snack</option>
                    <option value="hydration">Hydration</option>
                    <option value="meal">Meal</option>
                    <option value="other">Other</option>
                  </select>
                </label>
              )}
              <label className={styles.fullField}>
                <span>Notes (optional)</span>
                <textarea name="notes" rows={3} maxLength={500} />
              </label>
            </div>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <footer>
              <button type="button" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" disabled={isSaving}>
                {isSaving ? "Adding..." : "Add to calendar"}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>,
    document.body,
  );
}
