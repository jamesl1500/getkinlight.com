import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { DashboardResponse } from "@getkinlight.com/shared";
import * as SecureStore from "expo-secure-store";
import {
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
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
import {
  applyMobileObservabilityConsent,
  MOBILE_PREFERENCES_KEY,
} from "@/lib/observability";
import {
  disablePushNotifications,
  enablePushNotifications,
} from "@/lib/push-notifications";
import { useAuth } from "@/providers/auth-provider";

type ColorsValue = (typeof Colors)[keyof typeof Colors];
type IconName = ComponentProps<typeof MaterialIcons>["name"];
type Preferences = {
  weekStartsOn: "sunday" | "monday";
  timeFormat: "12-hour" | "24-hour";
  compactSchedule: boolean;
  reduceMotion: boolean;
  analytics: boolean;
  crashReporting: boolean;
  pushNotifications: boolean;
  careUpdatesEnabled: boolean;
  scheduleRemindersEnabled: boolean;
  invitationsEnabled: boolean;
};

const defaults: Preferences = {
  weekStartsOn: "sunday",
  timeFormat: "12-hour",
  compactSchedule: false,
  reduceMotion: false,
  analytics: false,
  crashReporting: false,
  pushNotifications: false,
  careUpdatesEnabled: true,
  scheduleRemindersEnabled: true,
  invitationsEnabled: true,
};

async function readPreferences() {
  const value =
    Platform.OS === "web"
      ? globalThis.localStorage?.getItem(MOBILE_PREFERENCES_KEY)
      : await SecureStore.getItemAsync(MOBILE_PREFERENCES_KEY);
  if (!value) return defaults;
  try {
    return { ...defaults, ...(JSON.parse(value) as Partial<Preferences>) };
  } catch {
    return defaults;
  }
}

async function writePreferences(preferences: Preferences) {
  const value = JSON.stringify(preferences);
  if (Platform.OS === "web")
    globalThis.localStorage?.setItem(MOBILE_PREFERENCES_KEY, value);
  else await SecureStore.setItemAsync(MOBILE_PREFERENCES_KEY, value);
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Kinlight could not load your account settings.";
}

export function SettingsWorkspace() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const { session, signOut } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [preferences, setPreferences] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deletionConfirmation, setDeletionConfirmation] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([createMobileApiClient().dashboard.get(), readPreferences()])
      .then(([response, stored]) => {
        if (active) {
          setDashboard(response);
          setPreferences(stored);
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(errorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      setDashboard(await createMobileApiClient().dashboard.get());
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function savePreferences() {
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      if (preferences.pushNotifications) {
        await enablePushNotifications(preferences);
      } else {
        await disablePushNotifications();
      }
      await writePreferences(preferences);
      await applyMobileObservabilityConsent(preferences);
      setNotice("Preferences saved on this device.");
    } catch {
      setError("Your device preferences could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    setError(null);
    try {
      await disablePushNotifications();
      await signOut();
    } catch (signOutError) {
      setError(errorMessage(signOutError));
      setSigningOut(false);
    }
  }

  async function handleDeleteAccount() {
    if (deletionConfirmation !== "DELETE") return;
    setDeletingAccount(true);
    setError(null);
    try {
      await disablePushNotifications();
      await createMobileApiClient().account.delete({ confirmation: "DELETE" });
      if (Platform.OS === "web") {
        globalThis.localStorage?.removeItem(MOBILE_PREFERENCES_KEY);
      } else {
        await SecureStore.deleteItemAsync(MOBILE_PREFERENCES_KEY);
      }
      await signOut().catch(() => {});
    } catch (deleteError) {
      setError(errorMessage(deleteError));
      setDeletingAccount(false);
    }
  }

  const profile = dashboard?.profile;
  const name =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
    profile?.username ||
    "Kinlight member";
  const initial = name.slice(0, 1).toUpperCase() || "K";

  return (
    <KinlightScreen
      eyebrow="Your account"
      title="Settings"
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={[styles.body, { color: colors.textMuted }]}>
            Loading your settings...
          </Text>
        </View>
      ) : null}
      {!loading ? (
        <>
          <View
            style={[
              styles.profile,
              Shadow,
              {
                backgroundColor: colors.glass,
                borderColor: colors.glassBorder,
              },
            ]}
          >
            <View style={[styles.avatar, { backgroundColor: Palette.aqua300 }]}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={styles.profileCopy}>
              <Text style={[styles.profileName, { color: colors.text }]}>
                {name}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.meta, { color: colors.textMuted }]}
              >
                {session?.user.email}
              </Text>
            </View>
            <View
              style={[
                styles.verified,
                { backgroundColor: colors.surfaceMuted },
              ]}
            >
              <MaterialIcons
                name={
                  session?.user.email_confirmed_at ? "verified" : "info-outline"
                }
                size={17}
                color={
                  session?.user.email_confirmed_at
                    ? colors.success
                    : colors.accent
                }
              />
            </View>
          </View>

          {error ? (
            <Notice
              text={error}
              danger
              onDismiss={() => setError(null)}
              colors={colors}
            />
          ) : null}
          {notice ? (
            <Notice
              text={notice}
              onDismiss={() => setNotice(null)}
              colors={colors}
            />
          ) : null}

          <SettingsSection
            title="Personal defaults"
            subtitle="Saved on this device"
            icon="tune"
            colors={colors}
          >
            <ChoiceSetting
              label="Week starts on"
              values={["sunday", "monday"]}
              value={preferences.weekStartsOn}
              onChange={(value) =>
                setPreferences({
                  ...preferences,
                  weekStartsOn: value as Preferences["weekStartsOn"],
                })
              }
              colors={colors}
            />
            <ChoiceSetting
              label="Time format"
              values={["12-hour", "24-hour"]}
              value={preferences.timeFormat}
              onChange={(value) =>
                setPreferences({
                  ...preferences,
                  timeFormat: value as Preferences["timeFormat"],
                })
              }
              colors={colors}
            />
            <ToggleSetting
              label="Compact schedule"
              description="Fit more calendar details on screen."
              value={preferences.compactSchedule}
              onChange={(value) =>
                setPreferences({ ...preferences, compactSchedule: value })
              }
              colors={colors}
            />
            <ToggleSetting
              label="Reduce motion"
              description="Prefer simpler transitions."
              value={preferences.reduceMotion}
              onChange={(value) =>
                setPreferences({ ...preferences, reduceMotion: value })
              }
              colors={colors}
            />
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => void savePreferences()}
              style={({ pressed }) => [
                styles.saveButton,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed || saving ? 0.7 : 1,
                },
              ]}
            >
              {saving ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <>
                  <MaterialIcons
                    name="save"
                    size={18}
                    color={colors.background}
                  />
                  <Text style={[styles.saveText, { color: colors.background }]}>
                    Save preferences
                  </Text>
                </>
              )}
            </Pressable>
          </SettingsSection>

          <SettingsSection
            title="Notifications"
            subtitle="This device"
            icon="notifications-none"
            colors={colors}
          >
            <ToggleSetting
              label="Push notifications"
              description="Receive household updates when Kinlight is closed."
              value={preferences.pushNotifications}
              onChange={(value) =>
                setPreferences({ ...preferences, pushNotifications: value })
              }
              colors={colors}
            />
            <ToggleSetting
              label="Care updates"
              description="Notes, check-ins, and changes to care details."
              value={preferences.careUpdatesEnabled}
              onChange={(value) =>
                setPreferences({ ...preferences, careUpdatesEnabled: value })
              }
              colors={colors}
            />
            <ToggleSetting
              label="Schedule reminders"
              description="Appointments, events, meals, and medication reminders."
              value={preferences.scheduleRemindersEnabled}
              onChange={(value) =>
                setPreferences({
                  ...preferences,
                  scheduleRemindersEnabled: value,
                })
              }
              colors={colors}
            />
            <ToggleSetting
              label="Invitations and members"
              description="Household invitations and membership changes."
              value={preferences.invitationsEnabled}
              onChange={(value) =>
                setPreferences({ ...preferences, invitationsEnabled: value })
              }
              colors={colors}
            />
          </SettingsSection>

          <SettingsSection
            title="Privacy"
            subtitle="Optional diagnostics"
            icon="privacy-tip"
            colors={colors}
          >
            <ToggleSetting
              label="Anonymous product analytics"
              description="Share allowlisted feature events without identity, care details, or screen recording."
              value={preferences.analytics}
              onChange={(value) =>
                setPreferences({ ...preferences, analytics: value })
              }
              colors={colors}
            />
            <ToggleSetting
              label="Technical crash reports"
              description="Share scrubbed errors without request contents, tokens, or household information."
              value={preferences.crashReporting}
              onChange={(value) =>
                setPreferences({ ...preferences, crashReporting: value })
              }
              colors={colors}
            />
          </SettingsSection>

          <SettingsSection
            title="Security"
            subtitle="Private account access"
            icon="lock-outline"
            colors={colors}
          >
            <Fact
              icon="alternate-email"
              label="Email"
              value={session?.user.email ?? "Unavailable"}
              colors={colors}
            />
            <Fact
              icon="verified-user"
              label="Email status"
              value={
                session?.user.email_confirmed_at
                  ? "Verified"
                  : "Verification pending"
              }
              colors={colors}
            />
            <Fact
              icon="login"
              label="Last sign in"
              value={
                session?.user.last_sign_in_at
                  ? new Intl.DateTimeFormat("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(session.user.last_sign_in_at))
                  : "Current session"
              }
              colors={colors}
            />
          </SettingsSection>

          <SettingsSection
            title="Household access"
            subtitle="Your current family space"
            icon="home-work"
            colors={colors}
          >
            <Fact
              icon="home"
              label="Household"
              value={dashboard?.household?.name ?? "No household"}
              colors={colors}
            />
            <Fact
              icon="shield"
              label="Role"
              value={dashboard?.household?.role ?? "Not assigned"}
              colors={colors}
            />
          </SettingsSection>

          <SettingsSection
            title="About Kinlight"
            subtitle="Policies and support"
            icon="info-outline"
            colors={colors}
          >
            <SettingsLink
              icon="privacy-tip"
              label="Privacy Notice"
              url="https://getkinlight.com/privacy"
              colors={colors}
            />
            <SettingsLink
              icon="gavel"
              label="Terms of Use"
              url="https://getkinlight.com/terms"
              colors={colors}
            />
            <SettingsLink
              icon="support-agent"
              label="Contact support"
              url="mailto:support@getkinlight.com"
              colors={colors}
            />
          </SettingsSection>

          <View
            style={[
              styles.dangerZone,
              {
                backgroundColor: colors.dangerSurface,
                borderColor: colors.danger,
              },
            ]}
          >
            <View style={styles.dangerCopy}>
              <Text style={[styles.sectionTitle, { color: colors.danger }]}>
                Delete account
              </Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                Permanently delete your profile and one-person households.
                Transfer ownership first if others share a household you own.
              </Text>
            </View>
            <TextInput
              accessibilityLabel="Type DELETE to confirm account deletion"
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="Type DELETE to confirm"
              placeholderTextColor={colors.icon}
              value={deletionConfirmation}
              onChangeText={setDeletionConfirmation}
              style={[
                styles.dangerInput,
                {
                  color: colors.text,
                  backgroundColor: colors.glassStrong,
                  borderColor: colors.danger,
                },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              disabled={deletionConfirmation !== "DELETE" || deletingAccount}
              onPress={() => void handleDeleteAccount()}
              style={({ pressed }) => [
                styles.deleteButton,
                {
                  backgroundColor: colors.danger,
                  opacity:
                    pressed ||
                    deletingAccount ||
                    deletionConfirmation !== "DELETE"
                      ? 0.55
                      : 1,
                },
              ]}
            >
              {deletingAccount ? (
                <ActivityIndicator color={Palette.white} />
              ) : (
                <>
                  <MaterialIcons
                    name="delete-forever"
                    size={20}
                    color={Palette.white}
                  />
                  <Text style={[styles.signOutText, { color: Palette.white }]}>
                    Delete account permanently
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={signingOut}
            onPress={() => void handleSignOut()}
            style={({ pressed }) => [
              styles.signOut,
              {
                backgroundColor: colors.glassStrong,
                borderColor: colors.glassBorder,
                opacity: pressed || signingOut ? 0.65 : 1,
              },
            ]}
          >
            {signingOut ? (
              <ActivityIndicator color={colors.danger} />
            ) : (
              <>
                <MaterialIcons name="logout" size={20} color={colors.danger} />
                <Text style={[styles.signOutText, { color: colors.danger }]}>
                  Sign out
                </Text>
              </>
            )}
          </Pressable>
        </>
      ) : null}
    </KinlightScreen>
  );
}

function SettingsSection({
  title,
  subtitle,
  icon,
  children,
  colors,
}: {
  title: string;
  subtitle: string;
  icon: IconName;
  children: ReactNode;
  colors: ColorsValue;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View
          style={[styles.sectionIcon, { backgroundColor: colors.surfaceMuted }]}
        >
          <MaterialIcons name={icon} size={20} color={colors.primary} />
        </View>
        <View style={styles.profileCopy}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {title}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        </View>
      </View>
      <View
        style={[
          styles.panel,
          Shadow,
          { backgroundColor: colors.glass, borderColor: colors.glassBorder },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function ChoiceSetting({
  label,
  values,
  value,
  onChange,
  colors,
}: {
  label: string;
  values: string[];
  value: string;
  onChange: (value: string) => void;
  colors: ColorsValue;
}) {
  return (
    <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
      <View
        style={[styles.segmented, { backgroundColor: colors.surfaceMuted }]}
      >
        {values.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: value === option }}
            onPress={() => onChange(option)}
            style={[
              styles.segment,
              value === option && { backgroundColor: colors.glassStrong },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: value === option ? colors.text : colors.textMuted },
              ]}
            >
              {option === "sunday"
                ? "Sun"
                : option === "monday"
                  ? "Mon"
                  : option.replace("-hour", "h")}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ToggleSetting({
  label,
  description,
  value,
  onChange,
  colors,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  colors: ColorsValue;
}) {
  return (
    <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
      <View style={styles.profileCopy}>
        <Text style={[styles.settingLabel, { color: colors.text }]}>
          {label}
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {description}
        </Text>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.success }}
        thumbColor={Palette.white}
      />
    </View>
  );
}

function Fact({
  icon,
  label,
  value,
  colors,
}: {
  icon: IconName;
  label: string;
  value: string;
  colors: ColorsValue;
}) {
  return (
    <View style={[styles.fact, { borderBottomColor: colors.border }]}>
      <MaterialIcons name={icon} size={20} color={colors.icon} />
      <View style={styles.profileCopy}>
        <Text style={[styles.meta, { color: colors.textMuted }]}>{label}</Text>
        <Text
          numberOfLines={2}
          style={[styles.settingLabel, { color: colors.text }]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function SettingsLink({
  icon,
  label,
  url,
  colors,
}: {
  icon: IconName;
  label: string;
  url: string;
  colors: ColorsValue;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => void Linking.openURL(url)}
      style={({ pressed }) => [
        styles.linkRow,
        { borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <MaterialIcons name={icon} size={20} color={colors.primary} />
      <Text style={[styles.linkLabel, { color: colors.text }]}>{label}</Text>
      <MaterialIcons name="open-in-new" size={18} color={colors.icon} />
    </Pressable>
  );
}

function Notice({
  text,
  danger,
  onDismiss,
  colors,
}: {
  text: string;
  danger?: boolean;
  onDismiss: () => void;
  colors: ColorsValue;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Dismiss message"
      onPress={onDismiss}
      style={[
        styles.notice,
        {
          backgroundColor: danger ? colors.dangerSurface : colors.surfaceMuted,
        },
      ]}
    >
      <MaterialIcons
        name={danger ? "error-outline" : "check-circle"}
        size={18}
        color={danger ? colors.danger : colors.success}
      />
      <Text style={[styles.noticeText, { color: colors.text }]}>{text}</Text>
      <MaterialIcons name="close" size={17} color={colors.icon} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: {
    minHeight: 280,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  body: { ...Type.body },
  profile: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { ...Type.heading, color: Palette.navy950 },
  profileCopy: { flex: 1, gap: 2 },
  profileName: { ...Type.heading },
  meta: { ...Type.caption },
  verified: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  notice: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  noticeText: { ...Type.label, flex: 1 },
  section: { gap: Spacing.md },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { ...Type.heading },
  panel: { borderWidth: 1, borderRadius: Radius.lg, overflow: "hidden" },
  settingRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
  },
  settingLabel: { ...Type.label },
  segmented: { flexDirection: "row", borderRadius: Radius.pill, padding: 3 },
  segment: {
    minWidth: 48,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
  },
  segmentText: { ...Type.caption },
  saveButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    margin: Spacing.md,
    borderRadius: Radius.md,
  },
  saveText: { ...Type.label },
  fact: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
  },
  linkRow: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.lg,
  },
  linkLabel: { ...Type.label, flex: 1 },
  dangerZone: {
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  dangerCopy: { gap: Spacing.xs },
  dangerInput: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    ...Type.body,
  },
  deleteButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  signOut: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  signOutText: { ...Type.label },
});
