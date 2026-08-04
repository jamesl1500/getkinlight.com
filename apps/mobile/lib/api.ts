import { createKinlightApiClient } from "@getkinlight.com/shared";
import { getSupabaseClient } from "./supabase";

function getApiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_KINLIGHT_API_URL;
  if (!configured) {
    throw new Error(
      "Kinlight is missing its API URL. Add EXPO_PUBLIC_KINLIGHT_API_URL to the mobile environment.",
    );
  }

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("Kinlight's API URL is invalid.");
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Kinlight's API URL must be a clean origin.");
  }
  if (url.protocol !== "https:" && !__DEV__) {
    throw new Error("Kinlight requires HTTPS for production API traffic.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Kinlight's API URL must use HTTP or HTTPS.");
  }

  return url.origin;
}

export function createMobileApiClient() {
  return createKinlightApiClient({
    baseUrl: getApiBaseUrl(),
    getAccessToken: async () => {
      const { data } = await getSupabaseClient().auth.getSession();
      return data.session?.access_token ?? null;
    },
  });
}
