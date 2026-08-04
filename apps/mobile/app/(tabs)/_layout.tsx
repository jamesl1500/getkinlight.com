import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Palette, Radius, Type } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tabIconSelected,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          left: 16,
          right: 16,
          bottom: Math.max(insets.bottom, 0) - 16,
          backgroundColor: "transparent",
          borderColor: colors.glassBorder,
          borderTopColor: colors.glassBorder,
          borderWidth: 1,
          borderRadius: Radius.pill,
          height: 68,
          paddingHorizontal: 6,
          paddingTop: 6,
          paddingBottom: 6,
          marginHorizontal: 16,
          ...(Platform.OS === "web"
            ? {
                boxShadow: `0 10px 22px ${colorScheme === "dark" ? "rgba(0, 0, 0, 0.34)" : "rgba(16, 35, 61, 0.16)"}`,
              }
            : {
                shadowColor: Palette.navy950,
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: colorScheme === "dark" ? 0.34 : 0.16,
                shadowRadius: 22,
                elevation: 10,
              }),
        },
        tabBarItemStyle: styles.tabBarItem,
        tabBarActiveBackgroundColor:
          colorScheme === "dark"
            ? "rgba(155, 229, 221, 0.12)"
            : "rgba(255, 255, 255, 0.58)",
        tabBarBackground: () => (
          <BlurView
            intensity={82}
            tint={
              colorScheme === "dark"
                ? "systemMaterialDark"
                : "systemMaterialLight"
            }
            style={[styles.tabBarGlass, { backgroundColor: colors.glass }]}
          />
        ),
        tabBarLabelStyle: Type.caption,
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="care"
        options={{
          title: "Care",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="heart.text.square.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="calendar" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: "Family",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="person.2.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: "AI",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="sparkles" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          href: null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="gearshape.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarGlass: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.pill,
    overflow: "hidden",
  },
  tabBarItem: {
    borderRadius: Radius.pill,
    overflow: "hidden",
  },
});
