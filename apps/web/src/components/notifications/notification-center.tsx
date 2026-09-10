"use client";

import { createBrowserApiClient } from "@/lib/api/client";
import {
  ActivityTypeSchema,
  HouseholdActivitySchema,
  createKinlightClient,
  type HouseholdActivity,
} from "@getkinlight.com/shared";
import { Bell, BellRing, CheckCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./notification-center.module.scss";

const BROWSER_NOTIFICATIONS_KEY = "kinlight-browser-notifications";

type ActivityRow = {
  id: string;
  household_id: string;
  actor_user_id: string | null;
  activity_type: string;
  title: string;
  body: string;
  resource_type: string | null;
  resource_id: string | null;
  href: string | null;
  created_at: string;
};

function toActivity(row: ActivityRow, readAt: string | null = null) {
  return HouseholdActivitySchema.parse({
    id: row.id,
    householdId: row.household_id,
    actorUserId: row.actor_user_id,
    activityType: ActivityTypeSchema.parse(row.activity_type),
    title: row.title,
    body: row.body,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    href: row.href,
    createdAt: row.created_at,
    readAt,
  });
}

function relativeTime(value: string) {
  const elapsedMinutes = Math.round(
    (new Date(value).getTime() - Date.now()) / 60_000,
  );
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(elapsedMinutes) < 60)
    return formatter.format(elapsedMinutes, "minute");
  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (Math.abs(elapsedHours) < 24)
    return formatter.format(elapsedHours, "hour");
  return formatter.format(Math.round(elapsedHours / 24), "day");
}

export function NotificationCenter({ userId }: { userId: string }) {
  const router = useRouter();
  const [activities, setActivities] = useState<HouseholdActivity[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [supportsBrowserNotifications] = useState(
    () => typeof window !== "undefined" && "Notification" in window,
  );
  const [browserPermission, setBrowserPermission] =
    useState<NotificationPermission>(() =>
      typeof window !== "undefined" && "Notification" in window
        ? Notification.permission
        : "default",
    );
  const unreadCount = activities.filter((activity) => !activity.readAt).length;

  useEffect(() => {
    const supabase = createKinlightClient();

    async function loadActivities() {
      try {
        const response = await createBrowserApiClient().notifications.get();
        setActivities(response.activities);
      } catch {
        setActivities([]);
      } finally {
        setIsLoading(false);
      }
    }

    void loadActivities();
    const channel = supabase
      .channel(`household-activity-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "household_activity" },
        (payload) => {
          try {
            const incomingActivity = toActivity(payload.new as ActivityRow);
            const activity =
              incomingActivity.actorUserId === userId
                ? { ...incomingActivity, readAt: incomingActivity.createdAt }
                : incomingActivity;
            setActivities((current) =>
              [
                activity,
                ...current.filter((item) => item.id !== activity.id),
              ].slice(0, 40),
            );

            const optedIn =
              window.localStorage.getItem(BROWSER_NOTIFICATIONS_KEY) ===
              "enabled";
            if (
              optedIn &&
              Notification.permission === "granted" &&
              document.hidden &&
              activity.actorUserId !== userId
            ) {
              const notification = new Notification(activity.title, {
                body: activity.body,
                tag: activity.id,
              });
              notification.onclick = () => {
                window.focus();
                window.location.assign(activity.href ?? "/dashboard");
                notification.close();
              };
            }
          } catch {
            void loadActivities();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!isOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  async function markRead(activityId?: string) {
    const readAt = new Date().toISOString();
    try {
      await createBrowserApiClient().notifications.markRead(
        activityId
          ? { action: "mark-read", activityId }
          : { action: "mark-all-read" },
      );
      setActivities((current) =>
        current.map((activity) =>
          !activityId || activity.id === activityId
            ? { ...activity, readAt }
            : activity,
        ),
      );
    } catch {}
  }

  async function openActivity(activity: HouseholdActivity) {
    await markRead(activity.id);
    setIsOpen(false);
    if (activity.href) router.push(activity.href);
  }

  async function enableBrowserNotifications() {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setBrowserPermission(permission);
    if (permission === "granted")
      window.localStorage.setItem(BROWSER_NOTIFICATIONS_KEY, "enabled");
  }

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen(true)}
        aria-label={
          unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"
        }
        title="Notifications"
      >
        {unreadCount ? (
          <BellRing size={19} aria-hidden />
        ) : (
          <Bell size={19} aria-hidden />
        )}
        {unreadCount > 0 && (
          <span className={styles.badge}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen &&
        createPortal(
          <div className={styles.backdrop} onMouseDown={() => setIsOpen(false)}>
            <section
              className={styles.panel}
              role="dialog"
              aria-modal="true"
              aria-labelledby="notification-heading"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header className={styles.header}>
                <div>
                  <p className={styles.eyebrow}>Household</p>
                  <h2 id="notification-heading">Activity</h2>
                </div>
                <div className={styles.headerActions}>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      className={styles.actionButton}
                      onClick={() => void markRead()}
                      title="Mark all as read"
                    >
                      <CheckCheck size={17} aria-hidden />
                      <span>Mark all read</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.closeButton}
                    onClick={() => setIsOpen(false)}
                    aria-label="Close notifications"
                    title="Close"
                  >
                    <X size={18} aria-hidden />
                  </button>
                </div>
              </header>

              {supportsBrowserNotifications &&
                browserPermission === "default" && (
                  <div className={styles.permissionBanner}>
                    <Bell size={17} aria-hidden />
                    <span>
                      Get household activity while Kinlight is in the
                      background.
                    </span>
                    <button type="button" onClick={enableBrowserNotifications}>
                      Enable
                    </button>
                  </div>
                )}

              <div className={styles.activityList}>
                {isLoading ? (
                  <p className={styles.empty}>Loading activity...</p>
                ) : activities.length === 0 ? (
                  <p className={styles.empty}>
                    Household updates will appear here.
                  </p>
                ) : (
                  activities.map((activity) => (
                    <button
                      key={activity.id}
                      type="button"
                      className={`${styles.activity} ${activity.readAt ? "" : styles.unread}`}
                      onClick={() => void openActivity(activity)}
                    >
                      <span className={styles.activityDot} aria-hidden />
                      <span className={styles.activityCopy}>
                        <strong>{activity.title}</strong>
                        <span>{activity.body}</span>
                        <time dateTime={activity.createdAt}>
                          {relativeTime(activity.createdAt)}
                        </time>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
