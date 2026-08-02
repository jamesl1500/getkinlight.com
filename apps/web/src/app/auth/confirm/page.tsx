import { ConfirmClient } from "./confirm-client";
import { safeRedirectPath } from "@/lib/safe-redirect";

type ConfirmEmailPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ConfirmEmailPage({
  searchParams,
}: ConfirmEmailPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const code =
    typeof resolvedSearchParams?.code === "string"
      ? resolvedSearchParams.code
      : undefined;
  const tokenHash =
    typeof resolvedSearchParams?.token_hash === "string"
      ? resolvedSearchParams.token_hash
      : undefined;
  const type =
    typeof resolvedSearchParams?.type === "string"
      ? resolvedSearchParams.type
      : undefined;
  const next =
    typeof resolvedSearchParams?.next === "string"
      ? resolvedSearchParams.next
      : undefined;

  return (
    <ConfirmClient
      code={code}
      tokenHash={tokenHash}
      type={type}
      redirectTo={safeRedirectPath(next)}
    />
  );
}
