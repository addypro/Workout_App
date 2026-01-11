/**
 * Modern iOS Design System (2025)
 * Inspired by Apple HIG with enhanced depth, glassmorphism, and semantic tokens.
 *
 * Color Philosophy (Steve Jobs Panel):
 * - "Sky Blue" accent for calm achievement
 * - Brutalist minimalism for content focus
 * - Adaptive themes for different user personas
 */

import { Platform } from 'react-native';

// ============================================================================
// THEME PALETTES
// ============================================================================

/**
 * ZEN THEME (Default)
 * Calming sky blue accents. The user should feel like they've accomplished
 * something peaceful, not passed an exam.
 */
const ZenPalette = {
  // Sky blue - "the color of a clear morning"
  primary: '#5DADE2',
  primaryDark: '#5CACEE',
  primaryMuted: '#7EC8E3',
  // Completion feels rewarding, not clinical
  completion: '#7EC8E3',
  active: '#5DADE2',
};

/**
 * FOCUS THEME
 * Pure black/white brutalist clarity. Zero color distractions.
 * For users who want the interface to disappear.
 */
const FocusPalette = {
  primary: '#000000',
  primaryDark: '#FFFFFF',
  primaryMuted: '#666666',
  completion: '#34C759', // Green only for completion
  active: '#000000',
};

/**
 * ARCADE THEME
 * High-dopamine retro vibes. Achievement unlocked energy.
 * For users who need that motivational hit.
 */
const ArcadePalette = {
  primary: '#FF6B6B',      // Coral red
  primaryDark: '#FF8E72',
  primaryMuted: '#FFB4A2',
  completion: '#4ECDC4',   // Teal success
  active: '#FFE66D',       // Golden active
  accent2: '#95E1D3',      // Mint
  accent3: '#F38181',      // Soft red
};

// Current active palette (can be switched via context)
export type ThemeName = 'zen' | 'focus' | 'arcade';

// Export palettes for theme switching
export const ThemePalettes = {
  zen: ZenPalette,
  focus: FocusPalette,
  arcade: ArcadePalette,
} as const;

// Default to Zen palette
const activePalette = ZenPalette;

// Semantic status colors (consistent across themes)
export const StatusColors = {
  success: '#34C759',   // iOS green
  warning: '#FF9500',   // iOS orange
  error: '#FF3B30',     // iOS red
  info: '#5AC8FA',      // iOS light blue
} as const;

// Workout-specific semantic colors
export const WorkoutColors = {
  setComplete: activePalette.completion,
  restTimer: '#FF9500',
  activeWorkout: activePalette.active,
  personalRecord: '#FFD60A',  // Gold for PRs
  streak: '#FF9500',          // Orange flame
} as const;

export const Colors = {
  light: {
    // Content hierarchy - Brutalist clarity
    text: '#000000',
    textSecondary: '#3C3C43',
    textTertiary: '#3C3C4399',
    textInverse: '#FFFFFF',

    // Surfaces - Pure, minimal
    background: '#FFFFFF',
    groupedBackground: '#F2F2F7',
    card: '#FFFFFF',
    elevated: '#FFFFFF',

    // Interactive - Sky Blue (calm achievement)
    tint: activePalette.primary,           // #5DADE2 - Sky blue
    tintMuted: activePalette.primary + '18',
    tintSoft: activePalette.primaryMuted,  // #7EC8E3 - Softer for completions

    // Semantic workout colors
    completion: activePalette.completion,
    activeState: activePalette.active,

    // Status colors (from StatusColors for convenience)
    success: StatusColors.success,
    warning: StatusColors.warning,
    error: StatusColors.error,
    info: StatusColors.info,

    // Borders & Dividers - Subtle, not demanding
    separator: '#3C3C4326',    // Slightly softer than before
    separatorOpaque: '#E5E5EA',

    // Tab bar
    icon: '#8E8E93',
    tabIconDefault: '#8E8E93',
    tabIconSelected: activePalette.primary,

    // Glassmorphism
    glassBackground: 'rgba(255,255,255,0.78)',
    glassBorder: 'rgba(255,255,255,0.24)',

    // Focus states
    focusRing: activePalette.primary + '40',
  },
  dark: {
    // Content hierarchy - High contrast brutalist
    text: '#FFFFFF',
    textSecondary: '#EBEBF5CC',  // Slightly more visible
    textTertiary: '#EBEBF54D',
    textInverse: '#000000',

    // Surfaces - Deep blacks, no muddy grays
    background: '#000000',
    groupedBackground: '#000000',
    card: '#1C1C1E',
    elevated: '#2C2C2E',

    // Interactive - Sky Blue (slightly brighter for dark mode)
    tint: activePalette.primaryDark,           // Adjusted for dark mode
    tintMuted: activePalette.primaryDark + '20',
    tintSoft: activePalette.primaryMuted,

    // Semantic workout colors
    completion: activePalette.completion,
    activeState: activePalette.active,

    // Status colors (from StatusColors for convenience)
    success: StatusColors.success,
    warning: StatusColors.warning,
    error: StatusColors.error,
    info: StatusColors.info,

    // Borders & Dividers
    separator: '#54545866',
    separatorOpaque: '#38383A',

    // Tab bar
    icon: '#8E8E93',
    tabIconDefault: '#8E8E93',
    tabIconSelected: activePalette.primaryDark,

    // Glassmorphism - Deeper, more dramatic
    glassBackground: 'rgba(28,28,30,0.78)',
    glassBorder: 'rgba(255,255,255,0.10)',

    // Focus states
    focusRing: activePalette.primaryDark + '40',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  full: 9999,
} as const;

// Shadow presets for depth hierarchy
// Using boxShadow for new React Native architecture compatibility
export const Shadows = Platform.select({
  // Web uses CSS box-shadow string
  web: {
    sm: { boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
    md: { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
    lg: { boxShadow: '0 4px 16px rgba(0,0,0,0.12)' },
  },
  // Native uses boxShadow string format (new architecture)
  default: {
    sm: { boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
    md: { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
    lg: { boxShadow: '0 4px 16px rgba(0,0,0,0.12)' },
  },
}) as {
  sm: { boxShadow: string };
  md: { boxShadow: string };
  lg: { boxShadow: string };
};

// Animation timing
export const Animation = {
  fast: 150,
  normal: 250,
  slow: 400,
  spring: { damping: 15, stiffness: 150 },
} as const;

// Typography scale
export const Typography = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' as const },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600' as const },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' as const },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' as const },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400' as const },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  caption1: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
  caption2: { fontSize: 11, lineHeight: 13, fontWeight: '400' as const },
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'System',
    serif: 'Georgia',
    rounded: 'System',
    mono: 'Menlo',
  },
  default: {
    sans: 'System',
    serif: 'serif',
    rounded: 'System',
    mono: 'monospace',
  },
  web: {
    sans: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "-apple-system, BlinkMacSystemFont, 'SF Pro Rounded', sans-serif",
    mono: "'SF Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
});
