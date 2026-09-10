import { MaterialIcons } from "@expo/vector-icons";
import type { OnboardingRole } from "@getkinlight.com/shared";
import { type Href, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { KinlightScreen } from "@/components/kinlight-screen";
import {
  Colors,
  Palette,
  Radius,
  Shadow,
  Spacing,
  Type,
} from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { createMobileApiClient } from "@/lib/api";
import { captureMobileAnalyticsEvent } from "@/lib/observability";
import { useAuth } from "@/providers/auth-provider";

const roles: { value: OnboardingRole; label: string }[] = [
  { value: "family-organizer", label: "Organizer" },
  { value: "parent", label: "Parent" },
  { value: "caregiver", label: "Caregiver" },
  { value: "relative", label: "Relative" },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const { session, refreshActivationStatus } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<OnboardingRole>("family-organizer");
  const [householdName, setHouseholdName] = useState("");
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      createMobileApiClient().onboarding.get(),
      createMobileApiClient().familyWorkspace.get(),
    ])
      .then(([onboarding, family]) => {
        if (!active) return;
        const profile = onboarding.profile;
        setFirstName(profile?.first_name ?? "");
        setLastName(profile?.last_name ?? "");
        setUsername(
          profile?.username ?? session?.user.email?.split("@")[0] ?? "",
        );
        if (
          profile?.role &&
          roles.some(({ value }) => value === profile.role)
        ) {
          setRole(profile.role as OnboardingRole);
        }
        setHouseholdId(family.selectedHousehold?.id ?? null);
        setHouseholdName(family.selectedHousehold?.name ?? "");
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Unable to load setup.",
          );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session?.user.email]);

  async function saveProfile() {
    if (!firstName.trim() || !lastName.trim() || !username.trim()) {
      setError("Complete your name and username to continue.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await createMobileApiClient().onboarding.save({
        firstName,
        lastName,
        username,
        role,
      });
      if (!householdName) setHouseholdName(`${firstName.trim()}'s Household`);
      setStep(2);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save profile.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function finishSetup() {
    if (!householdName.trim()) {
      setError("Give your household a name to continue.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      let activeHouseholdId = householdId;
      if (!activeHouseholdId) {
        const created = await createMobileApiClient().family({
          action: "create-household",
          name: householdName,
        });
        activeHouseholdId = created.householdId ?? null;
        if (!activeHouseholdId) throw new Error(created.message);
        captureMobileAnalyticsEvent("household_created");
      }
      if (inviteEmail.trim()) {
        await createMobileApiClient().family({
          action: "invite-member",
          householdId: activeHouseholdId,
          email: inviteEmail,
          role: "member",
        });
        captureMobileAnalyticsEvent("invitation_created");
      }
      captureMobileAnalyticsEvent("onboarding_completed", {
        invitationCreated: Boolean(inviteEmail.trim()),
      });
      await refreshActivationStatus();
      router.replace("/(tabs)" as Href);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to finish setup.",
      );
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <KinlightScreen title="Preparing your family space" eyebrow="Welcome">
        <ActivityIndicator color={colors.accent} size="large" />
      </KinlightScreen>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}
    >
      <KinlightScreen
        title={step === 1 ? "Start with you" : "Bring your family in"}
        eyebrow={`Setup · ${step} of 2`}
      >
        <View
          style={[styles.progressTrack, { backgroundColor: colors.border }]}
        >
          <View
            style={[
              styles.progressValue,
              {
                backgroundColor: colors.accent,
                width: step === 1 ? "50%" : "100%",
              },
            ]}
          />
        </View>

        <View
          style={[
            styles.panel,
            Shadow,
            { backgroundColor: colors.glass, borderColor: colors.glassBorder },
          ]}
        >
          <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
            <MaterialIcons
              name={step === 1 ? "person-outline" : "home-work"}
              size={24}
              color={colors.primary}
            />
          </View>
          <Text style={[styles.heading, { color: colors.text }]}>
            {step === 1
              ? "How should your family know you?"
              : "Name your shared household"}
          </Text>
          <Text style={[styles.copy, { color: colors.textMuted }]}>
            {step === 1
              ? "These details make care updates and invitations easy to recognize."
              : "Invite one trusted person now, or leave the email blank and do it later."}
          </Text>

          {step === 1 ? (
            <>
              <View style={styles.nameRow}>
                <Field
                  label="First name"
                  value={firstName}
                  onChangeText={setFirstName}
                  colors={colors}
                />
                <Field
                  label="Last name"
                  value={lastName}
                  onChangeText={setLastName}
                  colors={colors}
                />
              </View>
              <Field
                label="Username"
                value={username}
                onChangeText={(value) => setUsername(value.toLowerCase())}
                autoCapitalize="none"
                colors={colors}
              />
              <Text style={[styles.label, { color: colors.text }]}>
                Your role
              </Text>
              <View style={styles.roles}>
                {roles.map((option) => {
                  const selected = option.value === role;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setRole(option.value)}
                      style={[
                        styles.role,
                        {
                          backgroundColor: selected
                            ? colors.surfaceMuted
                            : colors.glassStrong,
                          borderColor: selected
                            ? colors.success
                            : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.roleText, { color: colors.text }]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <>
              <Field
                label="Household name"
                value={householdName}
                onChangeText={setHouseholdName}
                colors={colors}
              />
              <Field
                label="Family member email (optional)"
                value={inviteEmail}
                onChangeText={setInviteEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                colors={colors}
              />
            </>
          )}

          {error ? (
            <Text
              accessibilityRole="alert"
              style={[styles.error, { color: colors.danger }]}
            >
              {error}
            </Text>
          ) : null}

          <View style={styles.actions}>
            {step === 2 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setStep(1)}
                style={[styles.secondary, { borderColor: colors.border }]}
              >
                <Text style={[styles.buttonText, { color: colors.text }]}>
                  Back
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => void (step === 1 ? saveProfile() : finishSetup())}
              style={({ pressed }) => [
                styles.primary,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed || isSaving ? 0.65 : 1,
                },
              ]}
            >
              {isSaving ? (
                <ActivityIndicator
                  color={scheme === "dark" ? Palette.navy950 : Palette.white}
                />
              ) : (
                <Text
                  style={[
                    styles.buttonText,
                    {
                      color:
                        scheme === "dark" ? Palette.navy950 : Palette.white,
                    },
                  ]}
                >
                  {step === 1
                    ? "Continue"
                    : inviteEmail.trim()
                      ? "Finish and invite"
                      : "Finish setup"}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KinlightScreen>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  colors,
  ...inputProps
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  colors: (typeof Colors)[keyof typeof Colors];
  autoCapitalize?: "none";
  keyboardType?: "email-address";
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        autoCorrect={false}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.glassStrong,
            borderColor: colors.border,
          },
        ]}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  progressTrack: { height: 6, borderRadius: Radius.pill, overflow: "hidden" },
  progressValue: { height: "100%", borderRadius: Radius.pill },
  panel: {
    gap: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
  },
  icon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
  },
  heading: { ...Type.heading },
  copy: { ...Type.body },
  nameRow: { flexDirection: "row", gap: Spacing.md },
  field: { flex: 1, gap: Spacing.sm },
  label: { ...Type.label },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    ...Type.body,
  },
  roles: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  role: {
    minHeight: 42,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
  },
  roleText: { ...Type.label },
  error: { ...Type.label },
  actions: { flexDirection: "row", gap: Spacing.md },
  primary: {
    minHeight: 52,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  secondary: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
  },
  buttonText: { ...Type.label, fontSize: 16 },
});
