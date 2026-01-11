/**
 * Weight Unit Picker Component
 *
 * Allows users to switch between kilograms (kg) and pounds (lbs).
 * Displayed as a row of tappable option cards.
 */

import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePreferences, type WeightUnit } from '@/lib/context/preferences-context';
import { useAppTheme } from '@/lib/context/theme-context';

const WEIGHT_OPTIONS: { value: WeightUnit; label: string; description: string }[] = [
  { value: 'kg', label: 'Kilograms', description: 'Metric system' },
  { value: 'lbs', label: 'Pounds', description: 'Imperial system' },
];

export function WeightUnitPicker() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { palette } = useAppTheme();
  const { weightUnit, setWeightUnit } = usePreferences();

  const handleSelect = (unit: WeightUnit) => {
    if (unit !== weightUnit) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setWeightUnit(unit);
    }
  };

  return (
    <View style={styles.container}>
      <ThemedText style={[styles.label, { color: colors.textSecondary }]}>
        Weight Unit
      </ThemedText>
      <View style={styles.optionsRow}>
        {WEIGHT_OPTIONS.map((option) => {
          const isSelected = option.value === weightUnit;
          const accentColor = palette.primary;

          return (
            <Pressable
              key={option.value}
              style={({ pressed }) => [
                styles.optionCard,
                {
                  backgroundColor: isSelected ? accentColor + '15' : colors.card,
                  borderColor: isSelected ? accentColor : colors.separator,
                  borderWidth: isSelected ? 2 : StyleSheet.hairlineWidth,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              onPress={() => handleSelect(option.value)}
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: accentColor + '20' },
                ]}
              >
                <IconSymbol
                  name="scalemass.fill"
                  size={20}
                  color={isSelected ? accentColor : colors.textSecondary}
                />
              </View>
              <ThemedText
                style={[
                  styles.optionValue,
                  { color: isSelected ? accentColor : colors.text },
                ]}
              >
                {option.value.toUpperCase()}
              </ThemedText>
              <ThemedText
                style={[styles.optionLabel, { color: colors.textSecondary }]}
              >
                {option.label}
              </ThemedText>
              {isSelected && (
                <View style={[styles.checkmark, { backgroundColor: accentColor }]}>
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
  optionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  optionCard: {
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
  optionValue: {
    ...Typography.title3,
    fontWeight: '700',
  },
  optionLabel: {
    ...Typography.caption2,
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
