import { NextResponse } from "next/server";
import {
  AuthRequestSchema,
  AuthResponseSchema,
  ProfileSchema,
  createKinlightServerClient,
} from "@getkinlight.com/shared";
import { safeRedirectPath } from "@/lib/safe-redirect";

async function readUserProfile(accessToken: string, userId?: string) {
  if (!userId) {
    return null;
  }

  const client = createKinlightServerClient(accessToken);
  const { data } = await client
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const parsed = data ? ProfileSchema.safeParse(data) : null;

  return parsed?.success ? parsed.data : null;
}

export async function POST(request: Request) {
  const bodyResult = AuthRequestSchema.safeParse(await request.json());

  if (!bodyResult.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid authentication request.",
        session: null,
        profile: null,
      },
      { status: 400 },
    );
  }

  const body = bodyResult.data;

  try {
    if (body.mode === "sign-in") {
      const client = createKinlightServerClient();
      const { data, error } = await client.auth.signInWithPassword({
        email: body.email,
        password: body.password,
      });

      if (error) {
        return NextResponse.json(
          { ok: false, message: error.message, session: null, profile: null },
          { status: 400 },
        );
      }

      const profile = data.session?.access_token
        ? await readUserProfile(data.session.access_token, data.user?.id)
        : null;

      return NextResponse.json({
        ok: true,
        message: "Signed in. You can now continue to your family dashboard.",
        session: data.session,
        profile,
      });
    }

    if (body.mode === "sign-up") {
      const client = createKinlightServerClient();
      const emailRedirectUrl = new URL("/auth/confirm", request.url);
      emailRedirectUrl.searchParams.set(
        "next",
        safeRedirectPath(body.redirectTo),
      );
      const { data, error } = await client.auth.signUp({
        email: body.email,
        password: body.password,
        options: {
          emailRedirectTo: emailRedirectUrl.toString(),
        },
      });

      if (error) {
        return NextResponse.json(
          { ok: false, message: error.message, session: null, profile: null },
          { status: 400 },
        );
      }

      const profile = data.session?.access_token
        ? await readUserProfile(data.session.access_token, data.user?.id)
        : null;

      return NextResponse.json({
        ok: true,
        message: "Account created. Check your email to confirm your address.",
        session: data.session,
        profile,
      });
    }

    if (body.mode === "forgot-password") {
      const client = createKinlightServerClient();
      const redirectTo = new URL(
        "/auth/update-password",
        request.url,
      ).toString();
      const { error } = await client.auth.resetPasswordForEmail(body.email, {
        redirectTo,
      });

      if (error) {
        return NextResponse.json(
          { ok: false, message: error.message, session: null, profile: null },
          { status: 400 },
        );
      }

      return NextResponse.json({
        ok: true,
        message: "Password reset email sent. Please check your inbox.",
        session: null,
        profile: null,
      });
    }

    const client = createKinlightServerClient(body.accessToken);
    const { data, error } = await client.auth.updateUser({
      password: body.password,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message, session: null, profile: null },
        { status: 400 },
      );
    }

    const profile = await readUserProfile(body.accessToken, data.user?.id);

    return NextResponse.json({
      ok: true,
      message: "Password updated. You can now sign in with your new password.",
      session: null,
      profile,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Something went wrong. Please try again.",
        session: null,
        profile: null,
      },
      { status: 500 },
    );
  }
}

export type AuthApiResponse = ReturnType<typeof AuthResponseSchema.parse>;
