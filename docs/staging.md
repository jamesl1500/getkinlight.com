# Staging readiness

Use separate Supabase and deployment projects for staging. Never expose a service-role key to Next.js client components or Expo.

## Required environment

### Web

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `ANTHROPIC_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

The web app serves the versioned API from `/api/v1`. Legacy `/api/*` routes remain temporarily available during migration.
When both Upstash variables are configured, v1 routes use distributed sliding-window rate limits. Local development and provider outages fall back to the bounded in-memory limiter.

### Expo

- `EXPO_PUBLIC_KINLIGHT_API_URL`: HTTPS origin of the staging web deployment, without a trailing slash.
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Construct the shared client with the Expo API origin, an injected Supabase token provider, and the platform `fetch` implementation:

```ts
createKinlightApiClient({
  baseUrl: process.env.EXPO_PUBLIC_KINLIGHT_API_URL,
  getAccessToken: getMobileAccessToken,
});
```

## Authenticated acceptance

Use a dedicated staging member with a completed profile and household. Never use a production account.

- `PLAYWRIGHT_BASE_URL`: staging web origin
- `E2E_USER_EMAIL`: dedicated staging member email
- `E2E_USER_PASSWORD`: dedicated staging member password

When all three variables exist, `pnpm test:e2e` adds the `chromium-staging-auth` project. It signs in through the real UI, verifies the dashboard, scans for serious accessibility violations, and opens the calendar. Without them, only credential-free public browser projects run.

## Release gate

1. Apply migrations to staging and run database tests.
2. Configure CI secrets and run `pnpm quality` on Node 22.
3. Verify sign-in, onboarding, household membership, care mutations, schedule mutations, and AI against `/api/v1`.
4. Confirm API logs include `requestId`, route, method, status, and duration without payloads or access tokens.
5. Configure Upstash and verify `X-RateLimit-*` headers before multi-instance production deployment.
6. Add a nonce-based Content Security Policy after validating Next.js and third-party script requirements in staging.
