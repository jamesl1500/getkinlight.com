"use client";

import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

export const OBSERVABILITY_CONSENT_KEY = "kinlight-observability-consent";
export const OBSERVABILITY_CONSENT_EVENT = "kinlight-observability-change";

export type ObservabilityConsent = {
  analytics: boolean;
  crashReporting: boolean;
};

export type AnalyticsEvent =
  | "onboarding_completed"
  | "household_created"
  | "invitation_created"
  | "invitation_accepted"
  | "notification_opened";

const defaultConsent: ObservabilityConsent = {
  analytics: false,
  crashReporting: false,
};

let postHogInitialized = false;
let sentryInitialized = false;

export function readObservabilityConsent(): ObservabilityConsent {
  try {
    const stored = window.localStorage.getItem(OBSERVABILITY_CONSENT_KEY);
    return stored
      ? { ...defaultConsent, ...(JSON.parse(stored) as ObservabilityConsent) }
      : defaultConsent;
  } catch {
    return defaultConsent;
  }
}

export function writeObservabilityConsent(consent: ObservabilityConsent) {
  window.localStorage.setItem(
    OBSERVABILITY_CONSENT_KEY,
    JSON.stringify(consent),
  );
  window.dispatchEvent(new Event(OBSERVABILITY_CONSENT_EVENT));
}

export function applyObservabilityConsent(consent: ObservabilityConsent) {
  const postHogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (consent.analytics && postHogKey) {
    if (!postHogInitialized) {
      posthog.init(postHogKey, {
        api_host:
          process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        person_profiles: "never",
        mask_all_text: true,
        mask_all_element_attributes: true,
        advanced_disable_feature_flags: true,
        opt_out_capturing_by_default: true,
      });
      postHogInitialized = true;
    }
    posthog.opt_in_capturing();
  } else if (postHogInitialized) {
    posthog.opt_out_capturing();
    posthog.reset();
  }

  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (consent.crashReporting && sentryDsn && !sentryInitialized) {
    Sentry.init({
      dsn: sentryDsn,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      beforeSend(event) {
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
  }
}

export function captureAnalyticsEvent(
  event: AnalyticsEvent,
  properties?: Record<string, boolean | number | string>,
) {
  if (postHogInitialized && readObservabilityConsent().analytics) {
    posthog.capture(event, properties);
  }
}
