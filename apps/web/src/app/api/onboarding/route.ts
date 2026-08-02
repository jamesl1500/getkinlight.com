import { NextResponse } from "next/server";
import {
  OnboardingRequestSchema,
  OnboardingResponseSchema,
  ProfileSchema,
  createKinlightServerClient,
} from "@getkinlight.com/shared";

function readAccessTokenFromHeader(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim() || null;
}

async function getAuthenticatedUser(accessToken: string) {
  const client = createKinlightServerClient(accessToken);
  const { data, error } = await client.auth.getUser(accessToken);

  if (error) {
    return { user: null, error };
  }

  return { user: data.user, error: null };
}

async function readProfile(accessToken: string, userId: string) {
  const client = createKinlightServerClient(accessToken);
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { profile: null, error };
  }

  const parsed = data ? ProfileSchema.safeParse(data) : null;

  return {
    profile: parsed?.success ? parsed.data : null,
    error: null,
  };
}

export async function GET(request: Request) {
  const accessToken = readAccessTokenFromHeader(request);

  if (!accessToken) {
    return NextResponse.json(
      { ok: false, message: "Missing session token.", profile: null },
      { status: 401 },
    );
  }

  try {
    const { user, error } = await getAuthenticatedUser(accessToken);

    if (error || !user) {
      return NextResponse.json(
        {
          ok: false,
          message: "Your session has expired. Please sign in again.",
          profile: null,
        },
        { status: 401 },
      );
    }

    const { profile, error: profileError } = await readProfile(
      accessToken,
      user.id,
    );

    if (profileError) {
      return NextResponse.json(
        { ok: false, message: profileError.message, profile: null },
        { status: 400 },
      );
    }

    return NextResponse.json(
      OnboardingResponseSchema.parse({
        ok: true,
        message: "Onboarding profile loaded.",
        profile,
      }),
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Something went wrong. Please try again.",
        profile: null,
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const bodyResult = OnboardingRequestSchema.safeParse(await request.json());

  if (!bodyResult.success) {
    return NextResponse.json(
      { ok: false, message: "Invalid onboarding request.", profile: null },
      { status: 400 },
    );
  }

  const body = bodyResult.data;

  try {
    const { user, error } = await getAuthenticatedUser(body.accessToken);

    if (error || !user) {
      return NextResponse.json(
        {
          ok: false,
          message: "Your session has expired. Please sign in again.",
          profile: null,
        },
        { status: 401 },
      );
    }

    const client = createKinlightServerClient(body.accessToken);
    const { profile: existingProfile } = await readProfile(
      body.accessToken,
      user.id,
    );

    const profilePayload = {
      user_id: user.id,
      first_name: body.firstName,
      last_name: body.lastName,
      username: body.username,
      avatar: existingProfile?.avatar ?? null,
      role: body.role,
      is_admin: existingProfile?.is_admin ?? false,
    };

    const result = existingProfile
      ? await client
          .from("profiles")
          .update(profilePayload)
          .eq("user_id", user.id)
          .select("*")
          .single()
      : await client
          .from("profiles")
          .insert({
            id: crypto.randomUUID(),
            ...profilePayload,
          })
          .select("*")
          .single();

    if (result.error) {
      return NextResponse.json(
        { ok: false, message: result.error.message, profile: null },
        { status: 400 },
      );
    }

    const parsedProfile = ProfileSchema.safeParse(result.data);

    if (!parsedProfile.success) {
      return NextResponse.json(
        {
          ok: false,
          message: "Profile saved, but response format was unexpected.",
          profile: null,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      OnboardingResponseSchema.parse({
        ok: true,
        message: "Welcome to Kinlight. Your profile is ready.",
        profile: parsedProfile.data,
      }),
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Something went wrong. Please try again.",
        profile: null,
      },
      { status: 500 },
    );
  }
}
