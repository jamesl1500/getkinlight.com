import { SettingsNavigation } from "@/components/settings/settings-navigation";
import styles from "@/components/settings/settings.module.scss";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className={styles.settingsPage}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Account settings</p>
        <h1>Your Kinlight space</h1>
        <p>
          Manage your identity, sign-in security, household access, and everyday
          preferences.
        </p>
      </header>

      <div className={styles.settingsLayout}>
        <SettingsNavigation />
        <div className={styles.settingsContent}>{children}</div>
      </div>
    </main>
  );
}
