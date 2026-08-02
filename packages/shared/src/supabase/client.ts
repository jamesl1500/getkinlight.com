/**
 * Supabase Client
 * 
 * 
 */
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string;

/**
 * Supabase Client Instance
 * 
 * A single instance of the Supabase client for browser usage.
 * 
 * @returns {import("@supabase/ssr").SupabaseClient} Supabase client instance
 */
export function createKinlightClient() {
    return createBrowserClient(supabaseUrl, supabasePublishableKey);
}