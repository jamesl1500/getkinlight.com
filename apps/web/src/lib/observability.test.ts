import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const posthogMocks = vi.hoisted(() => ({
  init: vi.fn(),
  optInCapturing: vi.fn(),
  optOutCapturing: vi.fn(),
  reset: vi.fn(),
  capture: vi.fn(),
}));
const sentryMocks = vi.hoisted(() => ({ init: vi.fn() }));

vi.mock("posthog-js", () => ({
  default: {
    init: posthogMocks.init,
    opt_in_capturing: posthogMocks.optInCapturing,
    opt_out_capturing: posthogMocks.optOutCapturing,
    reset: posthogMocks.reset,
    capture: posthogMocks.capture,
  },
}));
vi.mock("@sentry/nextjs", () => ({ init: sentryMocks.init }));

const originalEnv = { ...process.env };

describe("observability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("reads default consent when nothing is stored", async () => {
    vi.resetModules();
    const { readObservabilityConsent } = await import("./observability");
    expect(readObservabilityConsent()).toEqual({
      analytics: false,
      crashReporting: false,
    });
  });

  it("reads previously stored consent", async () => {
    vi.resetModules();
    const {
      readObservabilityConsent,
      writeObservabilityConsent,
      OBSERVABILITY_CONSENT_EVENT,
    } = await import("./observability");
    const listener = vi.fn();
    window.addEventListener(OBSERVABILITY_CONSENT_EVENT, listener);

    writeObservabilityConsent({ analytics: true, crashReporting: true });

    expect(readObservabilityConsent()).toEqual({
      analytics: true,
      crashReporting: true,
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("falls back to defaults when stored consent is invalid JSON", async () => {
    vi.resetModules();
    window.localStorage.setItem("kinlight-observability-consent", "not-json");
    const { readObservabilityConsent } = await import("./observability");
    expect(readObservabilityConsent()).toEqual({
      analytics: false,
      crashReporting: false,
    });
  });

  it("does nothing when no keys are configured", async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    vi.resetModules();
    const { applyObservabilityConsent } = await import("./observability");

    applyObservabilityConsent({ analytics: true, crashReporting: true });

    expect(posthogMocks.init).not.toHaveBeenCalled();
    expect(sentryMocks.init).not.toHaveBeenCalled();
  });

  it("initializes posthog and sentry once when consent and keys are present", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://example.sentry.io/1";
    vi.resetModules();
    const { applyObservabilityConsent } = await import("./observability");

    applyObservabilityConsent({ analytics: true, crashReporting: true });
    applyObservabilityConsent({ analytics: true, crashReporting: true });

    expect(posthogMocks.init).toHaveBeenCalledTimes(1);
    expect(posthogMocks.optInCapturing).toHaveBeenCalledTimes(2);
    expect(sentryMocks.init).toHaveBeenCalledTimes(1);
  });

  it("opts out and resets posthog when analytics consent is revoked after being enabled", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
    vi.resetModules();
    const { applyObservabilityConsent } = await import("./observability");

    applyObservabilityConsent({ analytics: true, crashReporting: false });
    applyObservabilityConsent({ analytics: false, crashReporting: false });

    expect(posthogMocks.optOutCapturing).toHaveBeenCalledTimes(1);
    expect(posthogMocks.reset).toHaveBeenCalledTimes(1);
  });

  it("scrubs sensitive fields from Sentry events via beforeSend", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://example.sentry.io/1";
    vi.resetModules();
    const { applyObservabilityConsent } = await import("./observability");

    applyObservabilityConsent({ analytics: false, crashReporting: true });

    const options = sentryMocks.init.mock.calls[0]?.[0] as {
      beforeSend: (event: Record<string, unknown>) => Record<string, unknown>;
    };
    const scrubbed = options.beforeSend({
      user: { id: "1" },
      request: {
        cookies: "a=b",
        data: "secret",
        headers: {},
        query_string: "x=1",
      },
    });

    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.request).toEqual({});
  });

  it("captures analytics events only after posthog is initialized and consent is granted", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
    vi.resetModules();
    const {
      applyObservabilityConsent,
      captureAnalyticsEvent,
      writeObservabilityConsent,
    } = await import("./observability");

    captureAnalyticsEvent("household_created");
    expect(posthogMocks.capture).not.toHaveBeenCalled();

    applyObservabilityConsent({ analytics: true, crashReporting: false });
    writeObservabilityConsent({ analytics: true, crashReporting: false });
    captureAnalyticsEvent("household_created", { source: "test" });

    expect(posthogMocks.capture).toHaveBeenCalledWith("household_created", {
      source: "test",
    });
  });
});
