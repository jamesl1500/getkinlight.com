import { ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import "react-native-reanimated";

import { Colors, navigationTheme } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider, useAuth } from "@/providers/auth-provider";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

function RootNavigator() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme ?? "light";
  const { session, isLoading } = useAuth();

  if (isLoading) {
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
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
});
