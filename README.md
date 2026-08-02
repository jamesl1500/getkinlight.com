# Kinlight

Kinlight is a private family coordination platform for care updates, schedules, conversations, household membership, and AI-assisted planning. This monorepo contains the Next.js web application and API, an Expo mobile application, shared TypeScript contracts, and the Supabase database definition.

## Monorepo

| Path                      | Purpose                                                                   |
| ------------------------- | ------------------------------------------------------------------------- |
| `apps/web`                | Next.js web application, authenticated experience, and versioned HTTP API |
| `apps/mobile`             | Expo and React Native mobile application                                  |
| `packages/shared`         | Platform-neutral Zod schemas, Supabase factories, and typed API client    |
| `supabase/migrations`     | Ordered Postgres schema and RLS migrations                                |
| `supabase/tests/database` | pgTAP database and policy tests                                           |
| `docs`                    | Deployment and staging runbooks                                           |

The workspace is managed by pnpm. Applications consume `@getkinlight.com/shared` directly through the workspace protocol.

## Stack

- Next.js 16, React 19, TypeScript, and Sass
- Expo 54 and React Native 0.81
- Supabase Auth, Postgres, Realtime, and Row Level Security
- Anthropic for server-side AI features
- Upstash Redis for optional distributed API rate limiting
- Vitest, Testing Library, Playwright, axe, and pgTAP
- GitHub Actions, CodeQL, and Dependabot

## Prerequisites

- Node.js 22 or later
- pnpm 10.18.2, enabled through Corepack or installed directly
- Docker and the Supabase CLI for local database development
- An Android emulator, iOS simulator, or Expo Go for mobile development

## Getting Started

Install all workspace dependencies from the repository root:

```bash
pnpm install --frozen-lockfile
```

Create `apps/web/.env.local` with a Supabase project URL and publishable key:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
ANTHROPIC_API_KEY=your-server-only-key

# Optional
ANTHROPIC_MODEL=claude-sonnet-4-6
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

Never expose an Anthropic key, Supabase secret key, or service-role key through a `NEXT_PUBLIC_` or `EXPO_PUBLIC_` variable.

Start the web application:

```bash
pnpm web
```

Open [http://localhost:3000](http://localhost:3000).

Start the Expo development server in a second terminal:

```bash
pnpm mobile
```

## Local Database

The project uses imperative SQL migrations and targets Postgres 17. Start the local Supabase stack and inspect its generated URL and keys:

```bash
supabase start
supabase status
```

Use those local values in `apps/web/.env.local`, then run the database tests:

```bash
supabase test db
```

Add schema changes as new files under `supabase/migrations`; do not edit migrations that have already been applied to shared environments. Every exposed table must retain RLS and ownership-aware policies.

The current Supabase configuration references `supabase/seed.sql`, but the repository does not yet include a seed file. Local setup therefore relies on migrations and test fixtures.

## Environment Variables

### Web

| Variable                               | Required   | Purpose                                             |
| -------------------------------------- | ---------- | --------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Yes        | Supabase project URL                                |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes        | Browser-safe Supabase publishable key               |
| `ANTHROPIC_API_KEY`                    | For AI     | Server-only Anthropic credential                    |
| `ANTHROPIC_MODEL`                      | No         | Overrides the default Anthropic model               |
| `UPSTASH_REDIS_REST_URL`               | Production | Upstash REST endpoint for distributed rate limiting |
| `UPSTASH_REDIS_REST_TOKEN`             | Production | Upstash REST token                                  |

When both Upstash variables are absent, API v1 uses a bounded in-memory limiter. It also falls back locally if the distributed provider is unavailable.

### Mobile

The shared API client is designed for Expo, but mobile adoption is still in progress. A deployed mobile client should receive:

| Variable                               | Purpose                                                      |
| -------------------------------------- | ------------------------------------------------------------ |
| `EXPO_PUBLIC_KINLIGHT_API_URL`         | HTTPS origin of the web deployment, without a trailing slash |
| `EXPO_PUBLIC_SUPABASE_URL`             | Supabase project URL                                         |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe Supabase publishable key                        |

### Authenticated E2E

Providing all three values enables the staging-only `chromium-staging-auth` Playwright project:

- `PLAYWRIGHT_BASE_URL`
- `E2E_USER_EMAIL`
- `E2E_USER_PASSWORD`

Use a dedicated staging account with a completed profile and household. Do not use production credentials.

## Common Commands

Run commands from the repository root unless noted otherwise.

| Command                                         | Purpose                                               |
| ----------------------------------------------- | ----------------------------------------------------- |
| `pnpm web`                                      | Start the Next.js development server                  |
| `pnpm mobile`                                   | Start Expo                                            |
| `pnpm lint`                                     | Lint all packages that define a lint script           |
| `pnpm typecheck`                                | Type-check all workspace packages                     |
| `pnpm test`                                     | Run web unit, component, and API tests                |
| `pnpm test:coverage`                            | Run tests with enforced coverage thresholds           |
| `pnpm test:e2e`                                 | Run the Playwright browser matrix                     |
| `pnpm build`                                    | Create the production web build                       |
| `pnpm quality`                                  | Run formatting, lint, types, coverage, build, and E2E |
| `pnpm --filter @getkinlight.com/mobile android` | Open Expo on Android                                  |
| `pnpm --filter @getkinlight.com/mobile ios`     | Open Expo on iOS                                      |

## Architecture

### API

The web deployment owns the server API. New clients should use `/api/v1`; legacy `/api/*` routes remain available during migration. The v1 wrapper provides stable error codes, request IDs, no-store responses, payload limits, rate-limit headers, and structured request timing logs.

`@getkinlight.com/shared` exports `createKinlightApiClient`, request and response schemas, and platform-neutral domain contracts. Browser and mobile callers inject their Supabase access token instead of duplicating transport logic.

### Authentication and data

Supabase manages sessions and Postgres access. The Next.js proxy refreshes browser auth, while server components and API handlers validate the current user. Household data is protected by RLS; authorization must be based on database ownership and membership, never user-editable metadata.

### AI

Anthropic calls run only on the server. Shared schemas keep AI requests and responses provider-neutral for web and mobile consumers. Schedule and document extraction results are proposals: users must explicitly confirm them before data is written.

## Testing and Quality

Vitest covers application libraries, UI components, AI behavior, API routes, and v1 wrapper contracts. Global coverage thresholds are enforced at 80% for statements, branches, functions, and lines.

Playwright checks public pages in desktop Chromium, tablet Firefox, and mobile WebKit, including accessibility, navigation, responsive overflow, and security headers. Authenticated staging checks are activated only when staging credentials are present.

Run the complete release gate before opening a pull request:

```bash
pnpm quality
supabase test db
```

## CI and Security

- `.github/workflows/ci.yml` runs formatting, linting, type checks, coverage, production build, and browser tests.
- `.github/workflows/codeql.yml` performs JavaScript and TypeScript security analysis on pushes, pull requests, weekly schedules, and manual runs.
- `.github/dependabot.yml` groups weekly pnpm and GitHub Actions updates.

GitHub repository settings must keep Dependabot alerts and security updates enabled for vulnerability notifications.

## Deployment

The web deployment is the API origin for both web and mobile clients. Use separate Supabase projects and credentials for staging and production. Before release, apply migrations, run database tests, configure Upstash for multi-instance rate limiting, and execute authenticated Playwright checks against staging.

See [docs/staging.md](docs/staging.md) for the staging environment contract and release checklist.
