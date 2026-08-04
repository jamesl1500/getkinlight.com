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

Then open the project in a development build, Expo Go, an Android emulator, or
an iOS simulator. Use development builds for production-grade native testing.

## Authentication

The sign-in screen sends credentials to the shared `POST /api/v1/auth` contract. The returned Supabase session is installed in the native client and persisted with Expo SecureStore on Android and iOS. Web development uses browser local storage.

Expo Router protected routes expose the sign-in screen only while signed out and the Kinlight tab shell only while signed in. Session refresh starts while the native app is active and pauses in the background.

## Navigation

The authenticated shell contains Home, Care, Calendar, Family, and Kinlight AI.
Settings remains available from Home. All primary tabs use the versioned API;
the mobile client does not query application tables directly.

## Checks

```bash
pnpm --filter @getkinlight.com/mobile format:check
pnpm --filter @getkinlight.com/mobile lint
pnpm --filter @getkinlight.com/mobile typecheck
pnpm --filter @getkinlight.com/mobile build
```

The build command exports Android, iOS, and web bundles. Store-signed binaries
still require the appropriate Apple or Google credentials in the release
environment.

Run the complete mobile release gate with:

```bash
pnpm --filter @getkinlight.com/mobile quality
```

`pnpm --filter @getkinlight.com/mobile doctor` is also available as an advisory
check. With pnpm 10's required hoisted linker, Expo Doctor sees the web app's
React 19.2 peer beneath `use-sync-external-store` and reports a duplicate. The
mobile Metro config resolves every React import to Expo's supported React 19.1
copy; Android, iOS, and web exports verify that resolution.
