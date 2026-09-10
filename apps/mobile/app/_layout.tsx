import * as Sentry from "@sentry/react-native";
import { ThemeProvider } from "@react-navigation/native";
import { type Href, Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import "react-native-reanimated";

import { Colors, navigationTheme } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  applyMobileObservabilityConsent,
  captureMobileAnalyticsEvent,
  initializeMobileCrashReporting,
  readMobileObservabilityConsent,
} from "@/lib/observability";
import {
  addNotificationResponseListener,
  consumeLastNotificationResponse,
  refreshPushRegistration,
} from "@/lib/push-notifications";
import { AuthProvider, useAuth } from "@/providers/auth-provider";

export const unstable_settings = {
  anchor: "(tabs)",
};

const crashReportingConfigured = initializeMobileCrashReporting();

function RootLayout() {
  useEffect(() => {
    void readMobileObservabilityConsent().then(applyMobileObservabilityConsent);
  }, []);

  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

export default crashReportingConfigured ? Sentry.wrap(RootLayout) : RootLayout;

function RootNavigator() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const scheme = colorScheme ?? "light";
  const { session, isLoading, isActivationLoading, onboardingRequired } =
    useAuth();

  useEffect(() => {
    if (!session) return;

    function openNotifications() {
      captureMobileAnalyticsEvent("notification_opened");
      router.push("/notifications" as Href);
    }

    void refreshPushRegistration().catch(() => {});
    if (consumeLastNotificationResponse()) openNotifications();
    const responseListener = addNotificationResponseListener(openNotifications);
    return () => responseListener.remove();
  }, [router, session]);

  if (isLoading || (session && isActivationLoading)) {
    return (
      <View
        style={[styles.loading, { backgroundColor: Colors[scheme].background }]}
      >
        <ActivityIndicator color={Colors[scheme].accent} size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider value={navigationTheme(scheme)}>
      <Stack>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={Boolean(session)}>
          <Stack.Protected guard={onboardingRequired}>
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={!onboardingRequired}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack.Protected>
        </Stack.Protected>
      </Stack>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
});
