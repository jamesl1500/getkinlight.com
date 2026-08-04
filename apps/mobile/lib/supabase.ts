import "react-native-url-polyfill/auto";

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const storage = {
  getItem: async (key: string) => {
    if (Platform.OS === "web")
      return globalThis.localStorage?.getItem(key) ?? null;
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === "web") {
      globalThis.localStorage?.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  },
  removeItem: async (key: string) => {
    if (Platform.OS === "web") {
      globalThis.localStorage?.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

let client: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (client) return client;

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "Kinlight is missing its Supabase configuration. Add the EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variables.",
    );
  }

  client = createClient(url, publishableKey, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}
