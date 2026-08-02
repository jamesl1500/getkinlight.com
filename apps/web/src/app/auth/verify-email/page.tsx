import { VerifyEmailForm } from "./verify-email-form";
import { safeRedirectPath } from "@/lib/safe-redirect";

type VerifyEmailPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const email =
    typeof resolvedSearchParams?.email === "string"
      ? resolvedSearchParams.email
      : "";
  const next =
    typeof resolvedSearchParams?.next === "string"
      ? resolvedSearchParams.next
      : undefined;

  return (
    <VerifyEmailForm initialEmail={email} redirectTo={safeRedirectPath(next)} />
  );
}
