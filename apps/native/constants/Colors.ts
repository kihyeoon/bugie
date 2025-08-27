/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

// Toss-inspired color system
const tintColorLight = '#3182F6'; // Main blue
const tintColorDark = '#4E7EFF'; // Lighter blue for dark mode

export const Colors = {
  light: {
    text: '#191F28', // Primary text
    textSecondary: '#8B95A1', // Secondary text
    textDisabled: '#B0B8C1', // Disabled text
    background: '#FFFFFF', // Main background
    backgroundSecondary: '#F2F4F6', // Secondary background
    tint: tintColorLight,
    tintLight: '#E8F3FF', // Light blue background
    icon: '#8B95A1',
    tabIconDefault: '#8B95A1',
    tabIconSelected: tintColorLight,
    border: '#E5E8EB',
    income: '#4E7EFF', // Blue for income
    expense: '#FF5A5F', // Red for expense
    error: '#FF5A5F', // Error color (same as expense)
    success: '#10B981', // Success color (green)
  },
  dark: {
    text: '#FFFFFF',
    textSecondary: '#B0B8C1',
    textDisabled: '#8B95A1',
    background: '#191F28',
    backgroundSecondary: '#242D3C',
    tint: tintColorDark,
    tintLight: '#2A3F5F',
    icon: '#B0B8C1',
    tabIconDefault: '#8B95A1',
    tabIconSelected: tintColorDark,
    border: '#2A3F5F',
    income: '#4E7EFF',
    expense: '#FF5A5F',
    error: '#FF5A5F', // Error color (same as expense)
    success: '#10B981', // Success color (green)
  },
};
