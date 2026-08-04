# Kinlight mobile

The Expo and React Native client for Kinlight. It uses Expo Router, the shared versioned API client, and Supabase Auth with encrypted native session persistence.

## Setup

Install workspace dependencies from the repository root:

```bash
pnpm install --frozen-lockfile
```

Copy `apps/mobile/.env.example` to `apps/mobile/.env.local` and provide the staging values:

```bash
EXPO_PUBLIC_KINLIGHT_API_URL=https://your-staging-web-origin.example
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The API URL is the web deployment origin without `/api/v1` and without a trailing slash. Expo embeds `EXPO_PUBLIC_` values in the client bundle, so never place secret or service-role keys in them.

Start Expo from the repository root:

```bash
pnpm mobile
```

Then open the project in Expo Go, an Android emulator, or an iOS simulator.

## Authentication

The sign-in screen sends credentials to the shared `POST /api/v1/auth` contract. The returned Supabase session is installed in the native client and persisted with Expo SecureStore on Android and iOS. Web development uses browser local storage.

Expo Router protected routes expose the sign-in screen only while signed out and the Kinlight tab shell only while signed in. Session refresh starts while the native app is active and pauses in the background.

## Navigation

The authenticated shell contains Home, Care, Calendar, Family, and Settings. Home and sign-out are functional in this first slice; care, calendar, and family are prepared for their API-backed workflows.

## Checks

```bash
pnpm --filter @getkinlight.com/mobile lint
pnpm --filter @getkinlight.com/mobile exec tsc --noEmit
pnpm --filter @getkinlight.com/mobile exec expo export --platform web
```
