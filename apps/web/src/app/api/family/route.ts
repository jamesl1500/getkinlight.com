import {
  FamilyMutationRequestSchema,
  FamilyMutationResponseSchema,
  createKinlightServerClient,
} from "@getkinlight.com/shared";
import { NextResponse } from "next/server";

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : null;
}

function response(
  message: string,
  status: number,
  invitationToken: string | null = null,
) {
  return NextResponse.json(
    FamilyMutationResponseSchema.parse({
      ok: status < 400,
      message,
      invitationToken,
    }),
    { status },
  );
}

export async function POST(request: Request) {
  const accessToken = bearerToken(request);
  if (!accessToken) return response("Your session has expired.", 401);

  const body = FamilyMutationRequestSchema.safeParse(await request.json());
  if (!body.success)
    return response(
      body.error.issues[0]?.message ?? "Review the household details.",
      400,
    );

  const supabase = createKinlightServerClient(accessToken);
  const { data: userData, error: userError } =
    await supabase.auth.getUser(accessToken);
  if (userError || !userData.user)
    return response("Your session has expired.", 401);

  const input = body.data;

  if (input.action === "accept-invitation") {
    const { error } = await supabase.rpc("accept_household_invitation", {
      invitation_token: input.invitationToken,
    });
    if (error)
      return response(error.message, error.code === "42501" ? 403 : 400);
    return response("Invitation accepted.", 200);
  }

  if (input.action === "rename-household") {
    const { data, error } = await supabase
      .from("households")
      .update({ name: input.name })
      .eq("id", input.householdId)
      .select("id")
      .single();
    if (error || !data) return mutationError(error);
    return response("Household name updated.", 200);
  }

  if (input.action === "invite-member") {
    const { data } = await supabase.rpc("get_household_member_directory", {
      target_household_id: input.householdId,
    });
    const directory = (data ?? []) as Array<{ email: string | null }>;
    if (directory.some((member) => member.email?.toLowerCase() === input.email))
      return response("That person is already a household member.", 409);

    const invitationToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + 7);
    const { error } = await supabase.from("household_invitations").insert({
      household_id: input.householdId,
      invited_email: input.email,
      role: input.role,
      invite_token: invitationToken,
      invited_by: userData.user.id,
      expires_at: expiresAt.toISOString(),
    });
    if (error)
      return error.code === "23505"
        ? response("A pending invitation already exists for that email.", 409)
        : mutationError(error);
    return response(
      "Invitation created. Share the secure link with your family member.",
      200,
      invitationToken,
    );
  }

  if (input.action === "cancel-invitation") {
    const { data, error } = await supabase
      .from("household_invitations")
      .delete()
      .eq("id", input.invitationId)
      .eq("household_id", input.householdId)
      .select("id")
      .single();
    if (error || !data) return mutationError(error);
    return response("Invitation canceled.", 200);
  }

  if (input.action === "update-member-role") {
    const { data, error } = await supabase
      .from("household_members")
      .update({ role: input.role })
      .eq("id", input.memberId)
      .eq("household_id", input.householdId)
      .select("id")
      .single();
    if (error || !data) return mutationError(error);
    return response("Member role updated.", 200);
  }

  const { data, error } = await supabase
    .from("household_members")
    .delete()
    .eq("id", input.memberId)
    .eq("household_id", input.householdId)
    .select("id")
    .single();
  if (error || !data) return mutationError(error);
  return response("Member removed from the household.", 200);
}

function mutationError(error: { code?: string; message: string } | null) {
  if (error?.code === "23514")
    return response(
      "Assign another owner before changing or removing the final owner.",
      409,
    );
  const forbidden = error?.code === "42501" || error?.code === "PGRST116";
  return response(
    forbidden
      ? "Only a household owner can make that change."
      : (error?.message ?? "Unable to update this household."),
    forbidden ? 403 : 400,
  );
}
