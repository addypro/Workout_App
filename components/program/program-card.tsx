/**
 * Program Card Component
 * 
 * Reusable component for displaying workout programs.
 * Supports selection mode with checkbox on the right.
 */

import React, { memo, useCallback } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Shadows, Typography } from '@/constants/theme';
import { withOpacity, OPACITY } from '@/lib/utils/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  ProgramDisplayItem,
  getTypeColor,
  getDifficultyColor,
} from '@/lib/services/programs';

// ============================================
// TYPES
// ============================================

interface ProgramCardProps {
  program: ProgramDisplayItem;
  onPress?: (program: ProgramDisplayItem) => void;
  isSelected?: boolean;
  onToggleSelect?: (program: ProgramDisplayItem) => void;
  variant?: 'default' | 'compact';
}

// ============================================
// COMPONENT
// ============================================

function ProgramCardComponent({
  program,
  onPress,
  isSelected = false,
  onToggleSelect,
  variant = 'default',
}: ProgramCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const typeColor = getTypeColor(program.type);
  const diffColor = getDifficultyColor(program.difficulty);

  const handlePress = useCallback(() => {
    // Navigate to detail screen when tapped
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onPress) {
      onPress(program);
      return;
    }
    router.push(`/browse?programId=${program.id}`);
  }, [router, program.id, onPress, program]);

  const handleCheckboxPress = useCallback(() => {
    if (onToggleSelect) {
      Haptics.selectionAsync();
      onToggleSelect(program);
    }
  }, [onToggleSelect, program]);

  const isCompact = variant === 'compact';

  // Build accessibility label
  const accessibilityDescription = `${program.name}, ${program.type.replace(/_/g, ' ')} program, ${program.difficulty}, ${program.duration} weeks, ${program.daysPerWeek} days per week`;

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityDescription}
      accessibilityHint="View program details"
      accessibilityState={{ selected: isSelected }}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: isSelected ? colors.tint : colors.separator,
              borderWidth: isSelected ? 2 : StyleSheet.hairlineWidth,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
            Shadows.sm,
          ]}
        >
          <View style={styles.row}>
            {/* Content */}
            <View style={styles.content}>
              {/* Header */}
              <View style={styles.header}>
                <ThemedText
                  style={[styles.title, isCompact && styles.titleCompact, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {program.name}
                </ThemedText>
              </View>

              {/* Description */}
              <ThemedText
                style={[styles.description, { color: colors.textSecondary }]}
                numberOfLines={isCompact ? 1 : 2}
              >
                {program.description}
              </ThemedText>

              {/* Badges */}
              <View style={styles.badges}>
                <Badge color={typeColor} text={formatType(program.type)} showDot />
                <Badge color={diffColor} text={formatDifficulty(program.difficulty)} />
                <ThemedText style={[styles.statText, { color: colors.textTertiary }]}>
                  {program.duration}w · {program.daysPerWeek}x/wk
                </ThemedText>
              </View>
            </View>

            {/* Checkbox */}
            {onToggleSelect && (
              <Pressable
                style={styles.checkboxContainer}
                onPress={handleCheckboxPress}
                hitSlop={12}
                accessibilityRole="checkbox"
                accessibilityLabel={`Select ${program.name}`}
                accessibilityState={{ checked: isSelected }}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: isSelected ? colors.tint : 'transparent',
                      borderColor: isSelected ? colors.tint : colors.textTertiary,
                    },
                  ]}
                >
                  {isSelected && (
                    <IconSymbol name="checkmark" size={14} color="#fff" />
                  )}
                </View>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </Pressable>
  );
}

// Memoized export with custom comparison for performance in lists
export const ProgramCard = memo(ProgramCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.program.id === nextProps.program.id &&
    prevProps.program.name === nextProps.program.name &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.variant === nextProps.variant &&
    prevProps.onToggleSelect === nextProps.onToggleSelect
  );
});

// ============================================
// SUB-COMPONENTS
// ============================================

function Badge({ color, text, showDot = false }: { color: string; text: string; showDot?: boolean }) {
  return (
    <View style={[styles.badge, { backgroundColor: withOpacity(color, OPACITY.muted) }]}>
      {showDot && <View style={[styles.badgeDot, { backgroundColor: color }]} />}
      <ThemedText style={[styles.badgeText, { color }]}>{text}</ThemedText>
    </View>
  );
}

// ============================================
// FORMATTERS
// ============================================

function formatType(type: string): string {
  return type.replace(/_/g, ' ');
}

function formatDifficulty(difficulty: string): string {
  return difficulty.charAt(0) + difficulty.slice(1).toLowerCase();
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    padding: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...Typography.headline,
    flex: 1,
  },
  titleCompact: {
    ...Typography.subhead,
  },
  description: {
    ...Typography.footnote,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  badgeText: {
    ...Typography.caption2,
    fontWeight: '600',
  },
  statText: {
    ...Typography.caption2,
  },
  checkboxContainer: {
    paddingLeft: Spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
