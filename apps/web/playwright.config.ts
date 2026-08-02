import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const hasStagingCredentials = Boolean(
  process.env.PLAYWRIGHT_BASE_URL &&
  process.env.E2E_USER_EMAIL &&
  process.env.E2E_USER_PASSWORD,
);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "pnpm dev --hostname 127.0.0.1 --port 3000",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    {
      name: "chromium-desktop",
      testMatch: "public-pages.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "firefox-tablet",
      testMatch: "public-pages.spec.ts",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1024, height: 768 },
      },
    },
    {
      name: "webkit-mobile",
      testMatch: "public-pages.spec.ts",
      use: devices["iPhone 13"],
    },
    ...(hasStagingCredentials
      ? [
          {
            name: "chromium-staging-auth",
            testMatch: "authenticated.spec.ts",
            use: devices["Desktop Chrome"],
          },
        ]
      : []),
  ],
});
