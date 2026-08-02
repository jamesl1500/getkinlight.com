import { PreferencesSettingsForm } from "@/components/settings/preferences-settings-form";
import styles from "@/components/settings/settings.module.scss";
import { SlidersHorizontal } from "lucide-react";

export default function PreferencesSettingsPage() {
  return (
    <section className={styles.sectionStack}>
      <div className={styles.sectionHeading}>
        <span className={styles.sectionIcon}>
          <SlidersHorizontal size={20} aria-hidden />
        </span>
        <div>
          <p className={styles.eyebrow}>Personal defaults</p>
          <h2>Preferences</h2>
          <p>
            Choose how dates, times, and schedule information are presented on
            this device.
          </p>
        </div>
      </div>
      <PreferencesSettingsForm />
    </section>
  );
}
