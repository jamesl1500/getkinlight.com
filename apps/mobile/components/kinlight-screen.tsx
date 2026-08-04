import type { PropsWithChildren, ReactNode } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  Colors,
  Fonts,
  Radius,
  Shadow,
  Spacing,
  Type,
} from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type KinlightScreenProps = PropsWithChildren<{
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}>;

export function KinlightScreen({
  title,
  eyebrow,
  action,
  refreshing,
  onRefresh,
  children,
}: KinlightScreenProps) {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <KinlightBackdrop />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing ?? false}
              onRefresh={onRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          ) : undefined
        }
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            {eyebrow ? (
              <Text style={[styles.eyebrow, { color: colors.accent }]}>
                {eyebrow}
              </Text>
            ) : null}
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          </View>
          {action}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function KinlightBackdrop() {
  const scheme = useColorScheme() ?? "light";

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.backdrop}
    >
      <View
        style={[
          styles.backdropPlane,
          styles.backdropPlaneAqua,
          {
            backgroundColor:
              scheme === "dark"
                ? "rgba(39, 142, 132, 0.14)"
                : "rgba(155, 229, 221, 0.3)",
          },
        ]}
      />
      <View
        style={[
          styles.backdropPlane,
          styles.backdropPlanePeach,
          {
            backgroundColor:
              scheme === "dark"
                ? "rgba(231, 127, 88, 0.1)"
                : "rgba(255, 182, 148, 0.2)",
          },
        ]}
      />
    </View>
  );
}

export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];

  return (
    <View
      style={[
        styles.empty,
        Shadow,
        {
          backgroundColor: colors.glass,
          borderColor: colors.glassBorder,
        },
      ]}
    >
      <View style={[styles.emptyAccent, { backgroundColor: colors.accent }]} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyDescription, { color: colors.textMuted }]}>
        {description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, overflow: "hidden" },
  content: {
    padding: Spacing.xl,
    paddingBottom: 112,
    gap: Spacing.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "none",
  },
  backdropPlane: {
    position: "absolute",
    width: 300,
    height: 160,
    borderRadius: Radius.lg,
  },
  backdropPlaneAqua: {
    top: 80,
    right: -10,
    transform: [{ rotate: "-18deg" }],
  },
  backdropPlanePeach: {
    bottom: 120,
    left: -170,
    transform: [{ rotate: "24deg" }],
  },
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.lg,
  },
  headerCopy: { flex: 1, gap: Spacing.xs },
  eyebrow: { ...Type.caption, textTransform: "uppercase" },
  title: { ...Type.title, fontFamily: Fonts?.sans },
  empty: {
    minHeight: 240,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    justifyContent: "center",
    gap: Spacing.md,
    overflow: "hidden",
  },
  emptyAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 5 },
  emptyTitle: { ...Type.heading },
  emptyDescription: { ...Type.body, maxWidth: 360 },
});
