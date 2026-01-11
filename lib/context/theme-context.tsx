/**
 * Theme Context
 *
 * Allows users to switch between three curated themes:
 * - ZEN: Calming sky blue accents (default)
 * - FOCUS: Brutalist black/white clarity
 * - ARCADE: High-dopamine retro vibes
 *
 * "Let the user become who they want to be." - Jony Ive
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeName, ThemePalettes, Colors as BaseColors } from '@/constants/theme';

const THEME_STORAGE_KEY = '@app_theme';

interface ThemeContextType {
  themeName: ThemeName;
  setTheme: (theme: ThemeName) => void;
  colors: typeof BaseColors.light;
  palette: typeof ThemePalettes.zen;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Generate colors for a specific theme palette
 */
function getColorsForPalette(palette: typeof ThemePalettes.zen, isDark: boolean) {
  const base = isDark ? BaseColors.dark : BaseColors.light;

  return {
    ...base,
    tint: isDark ? palette.primaryDark : palette.primary,
    tintMuted: (isDark ? palette.primaryDark : palette.primary) + '18',
    tintSoft: palette.primaryMuted,
    completion: palette.completion,
    activeState: palette.active,
    tabIconSelected: isDark ? palette.primaryDark : palette.primary,
    focusRing: (isDark ? palette.primaryDark : palette.primary) + '40',
  };
}

interface ThemeProviderProps {
  children: React.ReactNode;
  colorScheme: 'light' | 'dark' | null | undefined;
}

export function AppThemeProvider({ children, colorScheme }: ThemeProviderProps) {
  const [themeName, setThemeName] = useState<ThemeName>('zen');
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    // Load saved theme preference
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved && (saved === 'zen' || saved === 'focus' || saved === 'arcade')) {
        setThemeName(saved as ThemeName);
      }
    });
  }, []);

  const setTheme = useCallback((theme: ThemeName) => {
    setThemeName(theme);
    AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
  }, []);

  const palette = ThemePalettes[themeName];
  const colors = getColorsForPalette(palette, isDark);

  const value: ThemeContextType = {
    themeName,
    setTheme,
    colors,
    palette,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useAppTheme must be used within an AppThemeProvider');
  }
  return context;
}

/**
 * Theme metadata for UI display
 */
export const ThemeInfo = {
  zen: {
    name: 'Zen',
    description: 'Calming sky blue accents for peaceful achievement',
    icon: 'leaf.fill' as const,
    preview: '#5DADE2',
  },
  focus: {
    name: 'Focus',
    description: 'Brutalist black & white for zero distractions',
    icon: 'eye.fill' as const,
    preview: '#000000',
  },
  arcade: {
    name: 'Arcade',
    description: 'High-dopamine retro vibes for motivation',
    icon: 'gamecontroller.fill' as const,
    preview: '#FF6B6B',
  },
} as const;
