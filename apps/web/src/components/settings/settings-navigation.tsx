"use client";

import { BellRing, House, LockKeyhole, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./settings.module.scss";

const settingsRoutes = [
  {
    href: "/settings/profile",
    label: "Profile",
    description: "Name and identity",
    icon: UserRound,
  },
  {
    href: "/settings/security",
    label: "Security",
    description: "Email and password",
    icon: LockKeyhole,
  },
  {
    href: "/settings/household",
    label: "Household",
    description: "Membership and access",
    icon: House,
  },
  {
    href: "/settings/preferences",
    label: "Preferences",
    description: "Display and reminders",
    icon: BellRing,
  },
];

export function SettingsNavigation() {
  const pathname = usePathname();

  return (
    <nav className={styles.settingsNav} aria-label="Settings sections">
      {settingsRoutes.map(({ href, label, description, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`${styles.settingsNavItem} ${pathname === href ? styles.settingsNavItemActive : ""}`}
        >
          <Icon size={18} aria-hidden />
          <span>
            <strong>{label}</strong>
            <small>{description}</small>
          </span>
        </Link>
      ))}
    </nav>
  );
}
