# Staging readiness

Use separate Supabase and deployment projects for staging. Never expose a service-role key to Next.js client components or Expo.

## Required environment

### Web

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `ANTHROPIC_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `SUPABASE_SECRET_KEY` (server-only account deletion)
- `NEXT_PUBLIC_SENTRY_DSN` (optional, consent-gated)
- `NEXT_PUBLIC_POSTHOG_KEY` (optional, consent-gated)
- `NEXT_PUBLIC_POSTHOG_HOST` (optional)
- `KINLIGHT_ENV=staging` (keeps staging out of search results)

The web app serves the versioned API from `/api/v1`. Legacy `/api/*` routes remain temporarily available during migration.
When both Upstash variables are configured, v1 routes use distributed sliding-window rate limits. Local development and provider outages fall back to the bounded in-memory limiter.

### Expo

- `EXPO_PUBLIC_KINLIGHT_API_URL`: HTTPS origin of the staging web deployment, without a trailing slash.
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_SENTRY_DSN` (optional, consent-gated)
- `EXPO_PUBLIC_POSTHOG_KEY` (optional, consent-gated)
- `EXPO_PUBLIC_POSTHOG_HOST` (optional)

Store the Expo public variables in the EAS `preview` environment, then create
an internal staging binary with `eas build --profile staging`. Sentry source-map
uploads also require `SENTRY_AUTH_TOKEN` as a sensitive EAS variable; it must
not use the `EXPO_PUBLIC_` prefix.

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
2. Protect the `staging` branch and require both `web-quality` and `mobile-quality` CI jobs.
3. Confirm `GET /api/health` returns 200 and `/robots.txt` disallows all crawlers on staging.
4. Review Privacy, Terms, and Cookie copy with qualified counsel and verify the public support mailbox works.
5. Add staging and mobile callback URLs to Supabase Auth, then verify sign-up, email confirmation, password reset, invitation acceptance, and expired links on physical devices.
6. Verify onboarding, household membership, care mutations, schedule mutations, and AI against `/api/v1` using synthetic data only.
7. Configure `PUSH_WEBHOOK_SECRET`, the database webhook, Expo push credentials, APNs, and FCM. Test foreground, background, cold-start, denied-permission, and invalid-token behavior.
8. Confirm API, Sentry, and PostHog data exclude care content, request bodies, access tokens, email addresses, and user identifiers. Exercise consent on, consent off, and consent withdrawal.
9. Exercise account deletion for a sole member, regular member, and household owner. Confirm ownership-transfer messaging and verify data deletion in the staging database.
10. Confirm API logs include `requestId`, route, method, status, and duration without payloads or access tokens.
11. Configure Upstash and verify `X-RateLimit-*` headers before multi-instance production deployment.
12. Enable Supabase leaked-password protection, review Security Advisor findings, and verify RLS on every exposed table.
13. Test the internal EAS staging build on current iOS and Android devices, including offline launch, session refresh, notification deep links, and upgrade from the prior build.
14. Configure backup/restore monitoring, alert destinations, a rollback owner, and a written go/no-go decision.
15. Add a nonce-based Content Security Policy after validating Next.js and third-party script requirements in staging.
