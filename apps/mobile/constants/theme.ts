import { DarkTheme, DefaultTheme, type Theme } from "@react-navigation/native";
import { Platform } from "react-native";

export const Palette = {
  navy950: "#10233D",
  navy800: "#29415F",
  slate600: "#526682",
  slate400: "#8797AC",
  cloud50: "#F7F9FD",
  cloud100: "#EEF3FA",
  white: "#FFFFFF",
  peach300: "#FFB694",
  peach500: "#E77F58",
  aqua300: "#9BE5DD",
  aqua600: "#278E84",
  sun300: "#F9E7A2",
  red500: "#C94B55",
  red100: "#FCE9EA",
  midnight: "#0B1524",
  midnightRaised: "#142238",
} as const;

export const Colors = {
  light: {
    text: Palette.navy950,
    textMuted: Palette.slate600,
    background: Palette.cloud50,
    surface: Palette.white,
    surfaceMuted: Palette.cloud100,
    border: "#DCE5F0",
    glass: "rgba(255, 255, 255, 0.72)",
    glassStrong: "rgba(255, 255, 255, 0.88)",
    glassBorder: "rgba(255, 255, 255, 0.92)",
    primary: Palette.navy950,
    primaryPressed: Palette.navy800,
    accent: Palette.peach500,
    success: Palette.aqua600,
    danger: Palette.red500,
    dangerSurface: Palette.red100,
    tint: Palette.peach500,
    icon: Palette.slate600,
    tabIconDefault: Palette.slate400,
    tabIconSelected: Palette.navy950,
  },
  dark: {
    text: "#F5F7FB",
    textMuted: "#A9B7CA",
    background: Palette.midnight,
    surface: Palette.midnightRaised,
    surfaceMuted: "#1A2B45",
    border: "#2A3D59",
    glass: "rgba(20, 34, 56, 0.76)",
    glassStrong: "rgba(20, 34, 56, 0.9)",
    glassBorder: "rgba(155, 229, 221, 0.18)",
    primary: Palette.aqua300,
    primaryPressed: "#76CFC5",
    accent: Palette.peach300,
    success: Palette.aqua300,
    danger: "#FF9CA4",
    dangerSurface: "#45232B",
    tint: Palette.peach300,
    icon: "#B9C5D5",
    tabIconDefault: "#8191A8",
    tabIconSelected: Palette.peach300,
  },
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: "Avenir Next",
    serif: "New York",
    rounded: "Avenir Next",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "'Avenir Next', 'Segoe UI', sans-serif",
    serif: "Iowan Old Style, 'Times New Roman', serif",
    rounded: "'Avenir Next', 'Segoe UI', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export type KinlightColorScheme = keyof typeof Colors;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

export const Radius = {
  sm: 6,
  md: 8,
  lg: 12,
  pill: 999,
} as const;

export const Type = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: "700" as const },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "700" as const },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: "700" as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" as const },
  label: { fontSize: 14, lineHeight: 20, fontWeight: "600" as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const },
} as const;

export const Shadow = Platform.select({
  ios: {
    shadowColor: Palette.navy950,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
  },
  android: { elevation: 3 },
  default: {},
});

export function navigationTheme(scheme: KinlightColorScheme): Theme {
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const colors = Colors[scheme];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.accent,
    },
  };
}
