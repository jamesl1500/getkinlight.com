import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  use,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState, Platform } from "react-native";

import { createMobileApiClient } from "@/lib/api";
import { getSupabaseClient } from "@/lib/supabase";

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let supabase;
    try {
      supabase = getSupabaseClient();
    } catch {
      setIsLoading(false);
      return;
    }

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session);
      })
      .catch(() => {
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!active) return;
        setSession(nextSession);
        setIsLoading(false);
      },
    );

    const appStateListener =
      Platform.OS === "web"
        ? null
        : AppState.addEventListener("change", (state) => {
            if (state === "active") supabase.auth.startAutoRefresh();
            else supabase.auth.stopAutoRefresh();
          });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
      appStateListener?.remove();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const result = await createMobileApiClient().auth({
      mode: "sign-in",
      email: email.trim(),
      password,
    });
    if (!result.ok || !result.session) {
      throw new Error(result.message);
    }

    const { error } = await getSupabaseClient().auth.setSession({
      access_token: result.session.access_token,
      refresh_token: result.session.refresh_token,
    });
    if (error) throw error;
  }

  async function signOut() {
    const { error } = await getSupabaseClient().auth.signOut();
    if (error) throw error;
  }

  return (
    <AuthContext value={{ session, isLoading, signIn, signOut }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const value = use(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
