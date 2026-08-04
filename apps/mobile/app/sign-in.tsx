import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { KinlightBackdrop } from "@/components/kinlight-screen";
import {
  Colors,
  Fonts,
  Palette,
  Radius,
  Shadow,
  Spacing,
  Type,
} from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/providers/auth-provider";

export default function SignInScreen() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(email, password);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to sign in. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmit =
    email.trim().length > 0 && password.length >= 8 && !isSubmitting;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <KinlightBackdrop />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <View style={styles.brandMark} accessibilityElementsHidden>
              <View style={[styles.brandShape, styles.brandAqua]} />
              <View style={[styles.brandShape, styles.brandPeach]} />
              <View style={[styles.brandShape, styles.brandSun]} />
            </View>
            <Text style={[styles.wordmark, { color: colors.text }]}>
              Kinlight
            </Text>
            <Text style={[styles.kicker, { color: colors.textMuted }]}>
              Your family, held together.
            </Text>
          </View>

          <View
            style={[
              styles.panel,
              Shadow,
              {
                backgroundColor: colors.glass,
                borderColor: colors.glassBorder,
              },
            ]}
          >
            <Text style={[styles.title, { color: colors.text }]}>
              Welcome back
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Sign in to your private family space.
            </Text>

            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.text }]}>
                  Email
                </Text>
                <TextInput
                  accessibilityLabel="Email"
                  autoCapitalize="none"
                  autoComplete="email"
                  inputMode="email"
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  placeholder="you@family.com"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="next"
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.glassStrong,
                      borderColor: colors.glassBorder,
                      color: colors.text,
                    },
                  ]}
                  value={email}
                />
              </View>

              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.text }]}>
                  Password
                </Text>
                <TextInput
                  accessibilityLabel="Password"
                  autoCapitalize="none"
                  autoComplete="current-password"
                  onChangeText={setPassword}
                  onSubmitEditing={() => canSubmit && void submit()}
                  placeholder="At least 8 characters"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="go"
                  secureTextEntry
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.glassStrong,
                      borderColor: colors.glassBorder,
                      color: colors.text,
                    },
                  ]}
                  value={password}
                />
              </View>

              {error ? (
                <Text
                  accessibilityRole="alert"
                  style={[styles.error, { color: colors.danger }]}
                >
                  {error}
                </Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={!canSubmit}
                onPress={() => void submit()}
                style={({ pressed }) => [
                  styles.button,
                  {
                    backgroundColor: colors.primary,
                    opacity: !canSubmit ? 0.45 : pressed ? 0.82 : 1,
                  },
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text
                    style={[styles.buttonText, { color: colors.background }]}
                  >
                    Sign in
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, overflow: "hidden" },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: Spacing.xl,
    gap: Spacing["2xl"],
  },
  brand: { alignItems: "center", gap: Spacing.sm },
  brandMark: {
    width: 72,
    height: 52,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  brandShape: {
    width: 30,
    height: 42,
    borderRadius: Radius.pill,
    position: "absolute",
  },
  brandAqua: {
    backgroundColor: Palette.aqua300,
    left: 2,
    transform: [{ rotate: "-24deg" }],
  },
  brandPeach: { backgroundColor: Palette.peach300, left: 22, height: 50 },
  brandSun: {
    backgroundColor: Palette.sun300,
    right: 1,
    transform: [{ rotate: "24deg" }],
  },
  wordmark: {
    fontFamily: Fonts?.serif,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "700",
  },
  kicker: { ...Type.label },
  panel: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  title: { ...Type.title, fontFamily: Fonts?.sans },
  subtitle: { ...Type.body, marginBottom: Spacing.lg },
  form: { gap: Spacing.lg },
  field: { gap: Spacing.sm },
  label: { ...Type.label },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    ...Type.body,
  },
  error: { ...Type.label },
  button: {
    minHeight: 52,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { ...Type.label, fontSize: 16 },
});
