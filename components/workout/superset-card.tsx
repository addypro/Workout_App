/**
 * SupersetCard Component
 *
 * Compound component that wraps paired exercises with:
 * - Shared visual boundary (Sky Blue accent)
 * - Connector lines between exercises
 * - Link/unlink icon indicator
 * - Staggered rest phase indicator
 */

import React, { useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  WorkoutExercise,
  SupersetGroup,
  SupersetPhase,
  SUPERSET_COLORS,
} from '@/lib/types/workout-session';

interface SupersetCardProps {
  exercises: WorkoutExercise[];
  group: SupersetGroup;
  currentPhase: SupersetPhase;
  onUnlink?: () => void;
  children: React.ReactNode;
}

/**
 * Main SupersetCard wrapper
 */
export function SupersetCard({
  exercises,
  group,
  currentPhase,
  onUnlink,
  children,
}: SupersetCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const pulseScale = useSharedValue(1);

  // Pulse animation when phase changes
  const handlePulse = useCallback(() => {
    pulseScale.value = withSequence(
      withSpring(1.02, { damping: 8, stiffness: 400 }),
      withSpring(1, { damping: 12 })
    );
  }, [pulseScale]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const isResting = currentPhase === 'rest_ab' || currentPhase === 'rest_ba';

  return (
    <Animated.View
      style={[
        styles.container,
        containerStyle,
        {
          backgroundColor: SUPERSET_COLORS.primaryLight,
          borderColor: SUPERSET_COLORS.border,
        },
      ]}
      entering={FadeIn.duration(200)}
    >
      {/* Header with link indicator */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <IconSymbol name="link" size={14} color={SUPERSET_COLORS.primary} />
          <ThemedText style={[styles.headerLabel, { color: SUPERSET_COLORS.text }]}>
            Superset
          </ThemedText>
          <View style={[styles.roundBadge, { backgroundColor: SUPERSET_COLORS.primaryMuted }]}>
            <ThemedText style={[styles.roundText, { color: SUPERSET_COLORS.text }]}>
              Round {group.currentRound}
            </ThemedText>
          </View>
        </View>

        {onUnlink && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onUnlink();
            }}
            hitSlop={12}
            style={styles.unlinkBtn}
          >
            <IconSymbol name="xmark" size={12} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>

      {/* Phase indicator */}
      <SupersetPhaseIndicator
        phase={currentPhase}
        exerciseAName={exercises[0]?.name || 'Exercise A'}
        exerciseBName={exercises[1]?.name || 'Exercise B'}
        restBetween={group.restBetween}
        restAfterRound={group.restAfterRound}
      />

      {/* Exercise cards with connector */}
      <View style={styles.exercisesContainer}>
        {children}
      </View>
    </Animated.View>
  );
}

/**
 * Phase indicator showing current position in superset flow
 */
function SupersetPhaseIndicator({
  phase,
  exerciseAName,
  exerciseBName,
  restBetween,
  restAfterRound,
}: {
  phase: SupersetPhase;
  exerciseAName: string;
  exerciseBName: string;
  restBetween: number;
  restAfterRound: number;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const getPhaseLabel = () => {
    switch (phase) {
      case 'exercise_a': return exerciseAName;
      case 'rest_ab': return `Rest ${restBetween}s`;
      case 'exercise_b': return exerciseBName;
      case 'rest_ba': return `Rest ${restAfterRound}s`;
    }
  };

  const isActive = (p: SupersetPhase) => p === phase;

  return (
    <View style={styles.phaseContainer}>
      {/* A */}
      <View style={[
        styles.phaseNode,
        isActive('exercise_a') && styles.phaseNodeActive,
        { borderColor: SUPERSET_COLORS.primary },
      ]}>
        <ThemedText style={[
          styles.phaseNodeText,
          { color: isActive('exercise_a') ? SUPERSET_COLORS.text : colors.textTertiary }
        ]}>
          A
        </ThemedText>
      </View>

      {/* Connector A→B */}
      <View style={[
        styles.phaseConnector,
        { backgroundColor: isActive('rest_ab') ? SUPERSET_COLORS.primary : SUPERSET_COLORS.primaryMuted },
      ]}>
        {isActive('rest_ab') && (
          <View style={[styles.restIndicator, { backgroundColor: SUPERSET_COLORS.primary }]}>
            <IconSymbol name="timer" size={10} color="#fff" />
          </View>
        )}
      </View>

      {/* B */}
      <View style={[
        styles.phaseNode,
        isActive('exercise_b') && styles.phaseNodeActive,
        { borderColor: SUPERSET_COLORS.primary },
      ]}>
        <ThemedText style={[
          styles.phaseNodeText,
          { color: isActive('exercise_b') ? SUPERSET_COLORS.text : colors.textTertiary }
        ]}>
          B
        </ThemedText>
      </View>

      {/* Connector B→A (curved back) */}
      <View style={[
        styles.phaseConnectorBack,
        { borderColor: isActive('rest_ba') ? SUPERSET_COLORS.primary : SUPERSET_COLORS.primaryMuted },
      ]}>
        {isActive('rest_ba') && (
          <View style={[styles.restIndicator, { backgroundColor: SUPERSET_COLORS.primary }]}>
            <IconSymbol name="arrow.counterclockwise" size={10} color="#fff" />
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * Connector line between exercises
 */
export function SupersetConnector({ isActive }: { isActive?: boolean }) {
  return (
    <View style={styles.connectorContainer}>
      <View
        style={[
          styles.connectorLine,
          { backgroundColor: isActive ? SUPERSET_COLORS.primary : SUPERSET_COLORS.primaryMuted },
        ]}
      />
      <View
        style={[
          styles.connectorDot,
          { backgroundColor: isActive ? SUPERSET_COLORS.primary : SUPERSET_COLORS.primaryMuted },
        ]}
      />
    </View>
  );
}

/**
 * Link button to create superset (shown on individual exercise cards)
 */
export function SupersetLinkButton({
  onPress,
  isHighlighted,
}: {
  onPress: () => void;
  isHighlighted?: boolean;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.linkButton,
        {
          backgroundColor: isHighlighted ? SUPERSET_COLORS.primaryLight : colors.elevated,
          borderColor: isHighlighted ? SUPERSET_COLORS.border : colors.separator,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <IconSymbol
        name="link"
        size={14}
        color={isHighlighted ? SUPERSET_COLORS.primary : colors.textSecondary}
      />
      <ThemedText
        style={[
          styles.linkButtonText,
          { color: isHighlighted ? SUPERSET_COLORS.text : colors.textSecondary },
        ]}
      >
        Superset
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerLabel: {
    ...Typography.caption1,
    fontWeight: '600',
  },
  roundBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  roundText: {
    ...Typography.caption2,
    fontWeight: '600',
  },
  unlinkBtn: {
    padding: 4,
  },
  phaseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    gap: 0,
  },
  phaseNode: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  phaseNodeActive: {
    backgroundColor: SUPERSET_COLORS.primaryLight,
  },
  phaseNodeText: {
    ...Typography.caption2,
    fontWeight: '700',
  },
  phaseConnector: {
    height: 3,
    width: 40,
    borderRadius: 1.5,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseConnectorBack: {
    height: 20,
    width: 20,
    borderWidth: 2,
    borderRadius: 10,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    marginLeft: -10,
    position: 'relative',
  },
  restIndicator: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exercisesContainer: {
    gap: 0,
  },
  connectorContainer: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  connectorLine: {
    width: 2,
    height: 16,
    borderRadius: 1,
  },
  connectorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: -2,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  linkButtonText: {
    ...Typography.caption2,
    fontWeight: '600',
  },
});
