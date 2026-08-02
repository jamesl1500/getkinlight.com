import {
  createKinlightApiClient,
  createKinlightClient,
} from "@getkinlight.com/shared";

export function createBrowserApiClient() {
  const supabase = createKinlightClient();
  return createKinlightApiClient({
    getAccessToken: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    },
  });
}
