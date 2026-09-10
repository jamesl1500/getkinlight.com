import {
  DeleteAccountRequestSchema,
  DeleteAccountResponseSchema,
  createKinlightServerClient,
} from "@getkinlight.com/shared";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : null;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function PATCH(request: Request) {
  const input = DeleteAccountRequestSchema.safeParse(await request.json());
  if (!input.success) {
    return errorResponse("Type DELETE to confirm account deletion.", 400);
  }

  const accessToken = bearerToken(request);
  if (!accessToken) return errorResponse("Your session has expired.", 401);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !secretKey) {
    return errorResponse("Account deletion is temporarily unavailable.", 503);
  }

  const client = createKinlightServerClient(accessToken);
  const { data: userData, error: userError } =
    await client.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return errorResponse("Your session has expired.", 401);
  }

  const cleanup = await client.rpc("prepare_current_account_deletion");
  if (cleanup.error) {
    const ownershipBlocked =
      cleanup.error.message.includes("Transfer ownership");
    return errorResponse(
      ownershipBlocked
        ? cleanup.error.message
        : "Unable to prepare this account for deletion.",
      ownershipBlocked ? 409 : 400,
    );
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: deleteError } = await admin.auth.admin.deleteUser(
    userData.user.id,
  );
  if (deleteError) {
    return errorResponse(
      "Your data was removed, but account closure needs support to finish.",
      500,
    );
  }

  return NextResponse.json(
    DeleteAccountResponseSchema.parse({
      ok: true,
      message: "Your Kinlight account and personal data were deleted.",
    }),
  );
}
