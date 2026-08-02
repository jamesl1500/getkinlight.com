import { OnboardingFlow } from "@/components/auth/onboarding-flow";
import { safeRedirectPath } from "@/lib/safe-redirect";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <OnboardingFlow redirectTo={safeRedirectPath(next)} />;
}
