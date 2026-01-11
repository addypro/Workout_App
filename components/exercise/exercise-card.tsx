/**
 * Reusable Exercise Card Component
 * Displays exercise information in a consistent format
 *
 * Performance: Wrapped with React.memo to prevent unnecessary re-renders in lists
 */

import React, { memo, useCallback } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Shadows, Typography } from '@/constants/theme';
import { withOpacity, OPACITY } from '@/lib/utils/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  ExerciseDatabaseEntry,
  getDifficultyLevel,
} from '@/lib/services/exercise/database';

interface ExerciseCardProps {
  exercise: ExerciseDatabaseEntry;
  onPress?: (exercise: ExerciseDatabaseEntry) => void;
  onSelect?: (exercise: ExerciseDatabaseEntry) => void;
  expanded?: boolean;
  showSelectButton?: boolean;
  compact?: boolean;
}

function ExerciseCardComponent({
  exercise,
  onPress,
  onSelect,
  expanded = false,
  showSelectButton = false,
  compact = false,
}: ExerciseCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const diffLevel = getDifficultyLevel(exercise.difficulty);
  const diffColor = diffLevel?.color || colors.textSecondary;

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(exercise);
  }, [exercise, onPress]);

  const handleSelect = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect?.(exercise);
  }, [exercise, onSelect]);

  // Build accessibility label
  const accessibilityDescription = [
    exercise.name,
    diffLevel?.name || 'Intermediate',
    exercise.muscles?.targetGroup,
    exercise.equipment[0],
  ].filter(Boolean).join(', ');

  return (
    <Pressable
      onPress={handlePress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityDescription}
      accessibilityHint={onPress ? (expanded ? 'Collapse exercise details' : 'Expand exercise details') : undefined}
      accessibilityState={{ expanded }}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.card,
            compact && styles.cardCompact,
            {
              backgroundColor: colors.card,
              borderColor: expanded ? withOpacity(colors.tint, OPACITY.medium) : colors.separator,
              transform: [{ scale: pressed && onPress ? 0.99 : 1 }],
            },
            Shadows.sm,
          ]}
        >
          {/* Main Row */}
          <View style={[styles.mainRow, compact && styles.mainRowCompact]}>
            <View style={[styles.diffIndicator, { backgroundColor: diffColor }]} />
            <View style={styles.content}>
              <ThemedText 
                style={[styles.name, compact && styles.nameCompact, { color: colors.text }]} 
                numberOfLines={expanded ? undefined : 1}
              >
                {exercise.name}
              </ThemedText>
              <View style={styles.meta}>
                {exercise.muscles?.targetGroup && (
                  <View style={[styles.metaPill, { backgroundColor: colors.tintMuted }]}>
                    <ThemedText style={[styles.metaPillText, { color: colors.tint }]}>
                      {exercise.muscles.targetGroup}
                    </ThemedText>
                  </View>
                )}
                {exercise.equipment[0] && !compact && (
                  <ThemedText style={[styles.equipmentText, { color: colors.textTertiary }]}>
                    {exercise.equipment[0]}
                  </ThemedText>
                )}
              </View>
            </View>
            
            <View style={styles.right}>
              {!showSelectButton && (
                <View style={[styles.diffBadge, { backgroundColor: withOpacity(diffColor, OPACITY.muted) }]}>
                  <ThemedText style={[styles.diffBadgeText, { color: diffColor }]}>
                    {diffLevel?.name || 'Int.'}
                  </ThemedText>
                </View>
              )}
              {showSelectButton ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.selectButton,
                    { backgroundColor: colors.tint, opacity: pressed ? 0.8 : 1 },
                  ]}
                  onPress={handleSelect}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${exercise.name} to workout`}
                >
                  <IconSymbol name="plus" size={16} color="#fff" />
                  <ThemedText style={styles.selectButtonText}>Add</ThemedText>
                </Pressable>
              ) : onPress && (
                <IconSymbol 
                  name={expanded ? 'chevron.up' : 'chevron.down'} 
                  size={14} 
                  color={colors.textTertiary} 
                />
              )}
            </View>
          </View>

          {/* Expanded Content */}
          {expanded && (
            <View style={[styles.expandedContent, { borderTopColor: colors.separator }]}>
              {exercise.movementPatterns && exercise.movementPatterns.length > 0 && (
                <View style={styles.detailRow}>
                  <IconSymbol name="arrow.triangle.2.circlepath" size={14} color={colors.textSecondary} />
                  <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>Movement</ThemedText>
                  <ThemedText style={[styles.detailValue, { color: colors.text }]}>
                    {exercise.movementPatterns.join(', ')}
                  </ThemedText>
                </View>
              )}
              {exercise.muscles?.primeMover && (
                <View style={styles.detailRow}>
                  <IconSymbol name="figure.strengthtraining.traditional" size={14} color={colors.textSecondary} />
                  <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>Primary</ThemedText>
                  <ThemedText style={[styles.detailValue, { color: colors.text }]}>
                    {exercise.muscles.primeMover}
                  </ThemedText>
                </View>
              )}
              {exercise.muscles?.secondary && (
                <View style={styles.detailRow}>
                  <IconSymbol name="circle.fill" size={8} color={colors.textTertiary} />
                  <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>Secondary</ThemedText>
                  <ThemedText style={[styles.detailValue, { color: colors.textSecondary }]}>
                    {exercise.muscles.secondary}
                  </ThemedText>
                </View>
              )}
              {exercise.equipment.length > 1 && (
                <View style={styles.detailRow}>
                  <IconSymbol name="dumbbell" size={14} color={colors.textSecondary} />
                  <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>Equipment</ThemedText>
                  <ThemedText style={[styles.detailValue, { color: colors.text }]}>
                    {exercise.equipment.join(', ')}
                  </ThemedText>
                </View>
              )}
              
              {/* Select button in expanded view */}
              {onSelect && (
                <Pressable
                  style={({ pressed }) => [
                    styles.expandedSelectButton,
                    { backgroundColor: colors.tint, opacity: pressed ? 0.8 : 1 },
                  ]}
                  onPress={handleSelect}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${exercise.name} to workout`}
                >
                  <IconSymbol name="plus.circle.fill" size={18} color="#fff" />
                  <ThemedText style={styles.expandedSelectButtonText}>Add to Workout</ThemedText>
                </Pressable>
              )}
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

// Memoized export with custom comparison for performance in lists
export const ExerciseCard = memo(ExerciseCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.exercise.name === nextProps.exercise.name &&
    prevProps.exercise.difficulty === nextProps.exercise.difficulty &&
    prevProps.expanded === nextProps.expanded &&
    prevProps.compact === nextProps.compact &&
    prevProps.showSelectButton === nextProps.showSelectButton &&
    prevProps.onPress === nextProps.onPress &&
    prevProps.onSelect === nextProps.onSelect
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cardCompact: {
    borderRadius: Radius.md,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  mainRowCompact: {
    padding: Spacing.sm,
  },
  diffIndicator: {
    width: 4,
    height: '100%',
    minHeight: 40,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  name: {
    ...Typography.subhead,
    fontWeight: '600',
  },
  nameCompact: {
    ...Typography.footnote,
    fontWeight: '600',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  metaPillText: {
    ...Typography.caption2,
    fontWeight: '600',
  },
  equipmentText: {
    ...Typography.caption1,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  diffBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  diffBadgeText: {
    ...Typography.caption2,
    fontWeight: '600',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  selectButtonText: {
    ...Typography.caption1,
    fontWeight: '600',
    color: '#fff',
  },
  expandedContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    ...Typography.caption1,
    width: 70,
  },
  detailValue: {
    ...Typography.caption1,
    flex: 1,
  },
  expandedSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  expandedSelectButtonText: {
    ...Typography.subhead,
    fontWeight: '600',
    color: '#fff',
  },
});

