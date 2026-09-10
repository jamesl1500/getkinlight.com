"use client";

import {
  AiAssistantModal,
  OPEN_KINLIGHT_AI_EVENT,
  type AiHousehold,
  type AiRecipient,
} from "@/components/ai/ai-assistant-modal";
import { ConversationPresenceProvider } from "@/components/conversations/conversation-presence-provider";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { createBrowserApiClient } from "@/lib/api/client";
import { createKinlightClient } from "@getkinlight.com/shared";
import {
  CalendarDays,
  HeartHandshake,
  Home,
  ListChecks,
  LogOut,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Package,
  Settings,
  Sparkles,
  SunMedium,
  Users,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./app-shell.module.scss";

const SIDEBAR_STORAGE_KEY = "kinlight-sidebar-collapsed";
const PREFERENCES_STORAGE_KEY = "kinlight-device-preferences";
const PREFERENCES_CHANGED_EVENT = "kinlight-preferences-changed";

const navigation = [
  { label: "Calendar", icon: CalendarDays, href: "/calendar" },
  { label: "Care", icon: HeartHandshake, href: "/care" },
  { label: "Tasks", icon: ListChecks, href: "/tasks" },
  { label: "Family", icon: Users, href: "/family" },
  { label: "Messages", icon: MessageCircle, href: "/conversations" },
  { label: "Supply list", icon: Package, href: "/supply" },
];

type AppShellProps = {
  children: React.ReactNode;
  userId: string;
  displayName: string;
  email: string;
  conversations: Array<{ id: string; householdId: string }>;
  households: AiHousehold[];
  recipients: AiRecipient[];
};

export function AppShell({
  children,
  userId,
  displayName,
  email,
  conversations,
  households,
  recipients,
}: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [hasReducedMotionPreference, setHasReducedMotionPreference] =
    useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [myTaskCount, setMyTaskCount] = useState(0);
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsSidebarCollapsed(
        window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true",
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    function openAssistant(event: Event) {
      const detail = (event as CustomEvent<{ prompt?: string }>).detail;
      setAssistantPrompt(detail?.prompt ?? "");
      setIsAssistantOpen(true);
    }
    window.addEventListener(OPEN_KINLIGHT_AI_EVENT, openAssistant);
    return () =>
      window.removeEventListener(OPEN_KINLIGHT_AI_EVENT, openAssistant);
  }, []);

  useEffect(() => {
    let isCurrent = true;

    async function loadMyTaskCount() {
      try {
        const result = await createBrowserApiClient().schedule.getAssignments();
        if (!isCurrent) return;
        setMyTaskCount(
          result.assignments.filter(
            (assignment) => assignment.assignedTo === userId,
          ).length,
        );
      } catch {
        if (isCurrent) setMyTaskCount(0);
      }
    }

    void loadMyTaskCount();
    const supabase = createKinlightClient();
    const channel = supabase
      .channel(`schedule-task-assignments:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedule_task_assignments",
        },
        () => void loadMyTaskCount(),
      )
      .subscribe();

    return () => {
      isCurrent = false;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    function readMotionPreference() {
      const stored = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);

      try {
        setHasReducedMotionPreference(
          Boolean(stored && JSON.parse(stored).reduceMotion),
        );
      } catch {
        setHasReducedMotionPreference(false);
      }
    }

    readMotionPreference();
    window.addEventListener("storage", readMotionPreference);
    window.addEventListener(PREFERENCES_CHANGED_EVENT, readMotionPreference);

    return () => {
      window.removeEventListener("storage", readMotionPreference);
      window.removeEventListener(
        PREFERENCES_CHANGED_EVENT,
        readMotionPreference,
      );
    };
  }, []);

  const shouldReduceMotion = Boolean(
    prefersReducedMotion || hasReducedMotionPreference,
  );

  function toggleSidebar() {
    setIsSidebarCollapsed((isCollapsed) => {
      const nextValue = !isCollapsed;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(nextValue));
      return nextValue;
    });
  }

  async function signOut() {
    setIsSigningOut(true);
    const supabase = createKinlightClient();
    await supabase.auth.signOut();
    router.replace("/auth/sign-in");
    router.refresh();
  }

  return (
    <ConversationPresenceProvider
      userId={userId}
      displayName={displayName}
      conversations={conversations}
    >
      <div className={`authenticatedViewport ${styles.viewport}`}>
        <aside
          className={`${styles.sidebar} ${isSidebarCollapsed ? styles.sidebarCollapsed : ""}`}
        >
          <div className={styles.sidebarHeader}>
            <Link
              href="/dashboard"
              className={styles.brand}
              aria-label="Kinlight dashboard"
            >
              <span className={styles.brandMark}>
                <SunMedium size={22} strokeWidth={1.8} aria-hidden />
              </span>
              <span className={styles.brandName}>Kinlight</span>
            </Link>
            <button
              type="button"
              className={styles.collapseButton}
              onClick={toggleSidebar}
              aria-label={
                isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
              }
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen size={18} aria-hidden />
              ) : (
                <PanelLeftClose size={18} aria-hidden />
              )}
            </button>
          </div>

          <nav className={styles.navigation} aria-label="App navigation">
            <p className={styles.navLabel}>Your space</p>
            <Link
              href="/dashboard"
              className={`${styles.navItem} ${pathname === "/dashboard" ? styles.navItemActive : ""}`}
              title="Dashboard"
            >
              <Home size={19} aria-hidden />
              <span className={styles.navText}>Dashboard</span>
            </Link>
            {navigation.map(({ label, icon: Icon, href }) => (
              <Link
                key={label}
                href={href}
                className={`${styles.navItem} ${pathname.startsWith(href) ? styles.navItemActive : ""}`}
                title={label}
              >
                <Icon size={19} aria-hidden />
                <span className={styles.navText}>{label}</span>
                {href === "/tasks" && myTaskCount > 0 && (
                  <span className={styles.navBadge}>{myTaskCount}</span>
                )}
              </Link>
            ))}
            <button
              type="button"
              className={`${styles.navItem} ${isAssistantOpen ? styles.navItemActive : ""}`}
              onClick={() => {
                setAssistantPrompt("");
                setIsAssistantOpen(true);
              }}
              title="Kinlight AI"
            >
              <Sparkles size={19} aria-hidden />
              <span className={styles.navText}>Kinlight AI</span>
            </button>
          </nav>

          <div className={styles.sidebarFooter}>
            <Link
              href="/settings/profile"
              className={`${styles.navItem} ${pathname.startsWith("/settings") ? styles.navItemActive : ""}`}
              title="Settings"
            >
              <Settings size={19} aria-hidden />
              <span className={styles.navText}>Settings</span>
            </Link>
            <div className={styles.account}>
              <span className={styles.avatar}>{initials}</span>
              <span className={styles.accountCopy}>
                <strong>{displayName}</strong>
                <small>{email}</small>
              </span>
              <button
                type="button"
                className={styles.iconButton}
                onClick={signOut}
                disabled={isSigningOut}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={18} aria-hidden />
              </button>
            </div>
          </div>
        </aside>

        <header className={styles.mobileHeader}>
          <Link
            href="/dashboard"
            className={styles.mobileBrand}
            aria-label="Kinlight dashboard"
          >
            <SunMedium size={21} aria-hidden />
            Kinlight
          </Link>
          <Link
            href="/settings"
            className={styles.avatar}
            aria-label="Settings"
            title="Settings"
          >
            {initials}
          </Link>
        </header>

        <div
          className={`${styles.content} ${isSidebarCollapsed ? styles.contentCollapsed : ""}`}
        >
          <AnimatePresence mode="wait" initial>
            <motion.div
              key={pathname}
              className={styles.pageTransition}
              initial={{
                opacity: 0,
                y: shouldReduceMotion ? 0 : 12,
                filter: shouldReduceMotion ? "none" : "blur(3px)",
              }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{
                opacity: 0,
                y: shouldReduceMotion ? 0 : -6,
                filter: shouldReduceMotion ? "none" : "blur(2px)",
              }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.24,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
          <footer className={styles.pageFooter}>
            <span className={styles.footerRule} aria-hidden />
            <span className={styles.footerMark}>
              <SunMedium size={15} strokeWidth={1.8} aria-hidden />
            </span>
            <span className={styles.footerEnd}>End of page</span>
            <span className={styles.footerCopy}>
              &copy; {new Date().getFullYear()} Kinlight
            </span>
            <span className={styles.footerRule} aria-hidden />
          </footer>
        </div>

        <nav className={styles.mobileNavigation} aria-label="Mobile navigation">
          <Link
            href="/dashboard"
            className={`${styles.mobileNavItem} ${pathname === "/dashboard" ? styles.mobileNavItemActive : ""}`}
          >
            <Home size={19} aria-hidden />
            <span>Home</span>
          </Link>
          {navigation.map(({ label, icon: Icon, href }) => (
            <Link
              key={label}
              href={href}
              className={`${styles.mobileNavItem} ${pathname.startsWith(href) ? styles.mobileNavItemActive : ""}`}
            >
              <Icon size={19} aria-hidden />
              <span>{label}</span>
              {href === "/tasks" && myTaskCount > 0 && (
                <span className={styles.mobileNavBadge}>{myTaskCount}</span>
              )}
            </Link>
          ))}
          <button
            type="button"
            className={`${styles.mobileNavItem} ${isAssistantOpen ? styles.mobileNavItemActive : ""}`}
            onClick={() => {
              setAssistantPrompt("");
              setIsAssistantOpen(true);
            }}
          >
            <Sparkles size={19} aria-hidden />
            <span>AI</span>
          </button>
        </nav>
        <NotificationCenter userId={userId} />
        {isAssistantOpen && (
          <AiAssistantModal
            households={households}
            recipients={recipients}
            initialPrompt={assistantPrompt}
            onClose={() => setIsAssistantOpen(false)}
          />
        )}
      </div>
    </ConversationPresenceProvider>
  );
}
