"use client";

import { useEffect } from "react";

import {
  applyObservabilityConsent,
  OBSERVABILITY_CONSENT_EVENT,
  readObservabilityConsent,
} from "@/lib/observability";

export function ObservabilityProvider() {
  useEffect(() => {
    function applyConsent() {
      applyObservabilityConsent(readObservabilityConsent());
    }

    applyConsent();
    window.addEventListener(OBSERVABILITY_CONSENT_EVENT, applyConsent);
    window.addEventListener("storage", applyConsent);

    return () => {
      window.removeEventListener(OBSERVABILITY_CONSENT_EVENT, applyConsent);
      window.removeEventListener("storage", applyConsent);
    };
  }, []);

  return null;
}
