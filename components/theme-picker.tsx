/**
 * Theme Picker Component
 *
 * Allows users to switch between Zen, Focus, and Arcade themes.
 * Displayed as a row of tappable theme cards.
 */

import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Card } from '@/components/ui/card';
import { Colors, Radius, Spacing, Typography, ThemeName } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAppTheme, ThemeInfo } from '@/lib/context/theme-context';

export function ThemePicker() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { themeName, setTheme } = useAppTheme();

  const themes: ThemeName[] = ['zen', 'focus', 'arcade'];

  const handleSelect = (theme: ThemeName) => {
    if (theme !== themeName) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTheme(theme);
    }
  };

  return (
    <View style={styles.container}>
      <ThemedText style={[styles.label, { color: colors.textSecondary }]}>
        Theme
      </ThemedText>
      <View style={styles.themesRow}>
        {themes.map((theme) => {
          const info = ThemeInfo[theme];
          const isSelected = theme === themeName;

          return (
            <Pressable
              key={theme}
              style={({ pressed }) => [
                styles.themeCard,
                {
                  backgroundColor: isSelected ? info.preview + '15' : colors.card,
                  borderColor: isSelected ? info.preview : colors.separator,
                  borderWidth: isSelected ? 2 : StyleSheet.hairlineWidth,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              onPress={() => handleSelect(theme)}
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: info.preview + '20' },
                ]}
              >
                <IconSymbol
                  name={info.icon}
                  size={20}
                  color={info.preview}
                />
              </View>
              <ThemedText
                style={[
                  styles.themeName,
                  { color: isSelected ? info.preview : colors.text },
                ]}
              >
                {info.name}
              </ThemedText>
              {isSelected && (
                <View style={[styles.checkmark, { backgroundColor: info.preview }]}>
                  <IconSymbol name="checkmark" size={10} color="#fff" />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  label: {
    ...Typography.footnote,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: Spacing.xs,
  },
  themesRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  themeCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    gap: Spacing.xs,
    position: 'relative',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeName: {
    ...Typography.caption1,
    fontWeight: '600',
  },
  checkmark: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
