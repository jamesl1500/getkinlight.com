# Kinlight web

The authenticated web application and API layer for Kinlight.

## AI configuration

Kinlight AI uses Anthropic from the server. Add these values to the web app's local environment or deployment environment:

```bash
ANTHROPIC_API_KEY=your-server-only-key
ANTHROPIC_MODEL=claude-sonnet-4-6
```

`ANTHROPIC_MODEL` is optional. Never expose the Anthropic key through a `NEXT_PUBLIC_` variable or call Anthropic directly from a browser or mobile client.

Both web and mobile clients use the provider-neutral `AiRequestSchema` and `AiResponseSchema` exported by `@getkinlight.com/shared`. Send requests to `POST /api/ai` with the user's Supabase access token in the `Authorization: Bearer <token>` header.

## Getting Started

First, run the development server:

```bash
pnpm --filter @getkinlight.com/web dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Schedule and document extractions are drafts. A user must explicitly confirm a proposal before Kinlight writes it to the care schedule.
