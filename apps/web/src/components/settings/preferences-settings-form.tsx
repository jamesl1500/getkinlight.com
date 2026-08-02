"use client";

import { Check, MonitorCog } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./settings.module.scss";

const PREFERENCES_KEY = "kinlight-device-preferences";
const PREFERENCES_CHANGED_EVENT = "kinlight-preferences-changed";

type DevicePreferences = {
  weekStartsOn: "sunday" | "monday";
  timeFormat: "12-hour" | "24-hour";
  density: "comfortable" | "compact";
  reduceMotion: boolean;
};

const defaults: DevicePreferences = {
  weekStartsOn: "sunday",
  timeFormat: "12-hour",
  density: "comfortable",
  reduceMotion: false,
};

export function PreferencesSettingsForm() {
  const [preferences, setPreferences] = useState(defaults);
  const [isReady, setIsReady] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = window.localStorage.getItem(PREFERENCES_KEY);
      if (stored) {
        try {
          setPreferences({
            ...defaults,
            ...(JSON.parse(stored) as Partial<DevicePreferences>),
          });
        } catch {
          window.localStorage.removeItem(PREFERENCES_KEY);
        }
      }
      setIsReady(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    window.dispatchEvent(new Event(PREFERENCES_CHANGED_EVENT));
    setSaved(true);
  }

  return (
    <form className={styles.settingsForm} onSubmit={save}>
      <div className={styles.fieldGrid}>
        <label>
          <span>Week starts on</span>
          <select
            value={preferences.weekStartsOn}
            onChange={(event) =>
              setPreferences({
                ...preferences,
                weekStartsOn: event.target
                  .value as DevicePreferences["weekStartsOn"],
              })
            }
            disabled={!isReady}
          >
            <option value="sunday">Sunday</option>
            <option value="monday">Monday</option>
          </select>
        </label>
        <label>
          <span>Time format</span>
          <select
            value={preferences.timeFormat}
            onChange={(event) =>
              setPreferences({
                ...preferences,
                timeFormat: event.target
                  .value as DevicePreferences["timeFormat"],
              })
            }
            disabled={!isReady}
          >
            <option value="12-hour">12-hour</option>
            <option value="24-hour">24-hour</option>
          </select>
        </label>
        <label>
          <span>Schedule density</span>
          <select
            value={preferences.density}
            onChange={(event) =>
              setPreferences({
                ...preferences,
                density: event.target.value as DevicePreferences["density"],
              })
            }
            disabled={!isReady}
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </label>
      </div>
      <label className={styles.checkboxField}>
        <input
          type="checkbox"
          checked={preferences.reduceMotion}
          onChange={(event) =>
            setPreferences({
              ...preferences,
              reduceMotion: event.target.checked,
            })
          }
          disabled={!isReady}
        />
        <span>
          <strong>Reduce interface motion</strong>
          <small>Prefer simpler transitions and fewer animated effects.</small>
        </span>
      </label>
      <aside className={styles.infoNote}>
        <MonitorCog size={18} aria-hidden />
        <p>
          <strong>Saved on this device</strong>
          <span>
            These defaults stay in this browser. Account-wide preference sync is
            not enabled yet.
          </span>
        </p>
      </aside>
      <div className={styles.formActions}>
        {saved && (
          <p className={styles.successMessage}>
            <Check size={15} aria-hidden />
            Preferences saved.
          </p>
        )}
        <button type="submit" disabled={!isReady}>
          Save preferences
        </button>
      </div>
    </form>
  );
}
