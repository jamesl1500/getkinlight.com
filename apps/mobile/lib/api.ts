import { createKinlightApiClient } from "@getkinlight.com/shared";
import { getSupabaseClient } from "./supabase";

export function createMobileApiClient() {
  const baseUrl = process.env.EXPO_PUBLIC_KINLIGHT_API_URL;
  if (!baseUrl) {
    throw new Error(
      "Kinlight is missing its API URL. Add EXPO_PUBLIC_KINLIGHT_API_URL to the mobile environment.",
    );
  }

  return createKinlightApiClient({
    baseUrl,
    getAccessToken: async () => {
      const { data } = await getSupabaseClient().auth.getSession();
      return data.session?.access_token ?? null;
    },
  });
}
