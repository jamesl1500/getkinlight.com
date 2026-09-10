import * as Sentry from "@sentry/react-native";
import * as SecureStore from "expo-secure-store";
import PostHog from "posthog-react-native";
import { Platform } from "react-native";

export const MOBILE_PREFERENCES_KEY = "kinlight-mobile-preferences";

export type MobileObservabilityConsent = {
  analytics: boolean;
  crashReporting: boolean;
};

export type MobileAnalyticsEvent =
  | "onboarding_completed"
  | "household_created"
  | "invitation_created"
  | "invitation_accepted"
  | "notification_opened";

const defaultConsent: MobileObservabilityConsent = {
  analytics: false,
  crashReporting: false,
};

let postHog: PostHog | null = null;
let sentryInitialized = false;
let crashReportingEnabled = false;

export function initializeMobileCrashReporting() {
  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!sentryDsn) return false;
  if (sentryInitialized) return true;

  Sentry.init({
    dsn: sentryDsn,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    enableAutoPerformanceTracing: false,
    enableAutoSessionTracking: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    beforeSend(event) {
      if (!crashReportingEnabled) return null;
      delete event.user;
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        delete event.request.headers;
        delete event.request.query_string;
      }
      return event;
    },
  });
  sentryInitialized = true;
  return true;
}

async function readStoredPreferences() {
  return Platform.OS === "web"
    ? globalThis.localStorage?.getItem(MOBILE_PREFERENCES_KEY)
    : SecureStore.getItemAsync(MOBILE_PREFERENCES_KEY);
}

export async function readMobileObservabilityConsent() {
  try {
    const stored = await readStoredPreferences();
    if (!stored) return defaultConsent;
    const value = JSON.parse(stored) as Partial<MobileObservabilityConsent>;
    return { ...defaultConsent, ...value };
  } catch {
    return defaultConsent;
  }
}

export async function applyMobileObservabilityConsent(
  consent: MobileObservabilityConsent,
) {
  const postHogKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  if (consent.analytics && postHogKey) {
    if (!postHog) {
      postHog = new PostHog(postHogKey, {
        host:
          process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
        defaultOptIn: false,
        captureAppLifecycleEvents: false,
        enableSessionReplay: false,
        disableSurveys: true,
        setDefaultPersonProperties: false,
        errorTracking: { autocapture: false },
      });
    }
    await postHog.optIn();
  } else if (postHog) {
    await postHog.optOut();
    postHog.reset();
  }

  crashReportingEnabled = consent.crashReporting;
  if (consent.crashReporting) initializeMobileCrashReporting();
}

export function captureMobileAnalyticsEvent(
  event: MobileAnalyticsEvent,
  properties?: Record<string, boolean | number | string>,
) {
  postHog?.capture(event, properties);
}
