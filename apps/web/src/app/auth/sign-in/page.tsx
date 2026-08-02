import { AuthForm } from "@/components/auth/auth-form";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createKinlightClient } from "@getkinlight.com/shared";
import { redirect } from "next/navigation";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const redirectTo = safeRedirectPath(next);
  /**
   * Check auth first
   */
  const supabase = await createKinlightClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(redirectTo);
  }

  return <AuthForm mode="sign-in" redirectTo={redirectTo} />;
}
