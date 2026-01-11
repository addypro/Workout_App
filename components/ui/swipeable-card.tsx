/**
 * Swipeable Card Component
 *
 * Wraps any card to add swipe-to-action functionality.
 * - Swipe right: Primary action (e.g., Add to workout)
 * - Swipe left: Secondary action (e.g., More options, Delete)
 *
 * Mobile-first: Optimized for thumb gestures with haptic feedback.
 */

import React, { useCallback, useRef } from 'react';
import { StyleSheet, View, Pressable, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  interpolateColor,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// ============================================================================
// TYPES
// ============================================================================

interface SwipeAction {
  icon: IconSymbolName;
  label: string;
  color: string;
  onAction: () => void;
}

interface SwipeableCardProps {
  children: React.ReactNode;
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
  /** Threshold to trigger action (default: 80) */
  threshold?: number;
  /** Whether swipe is enabled (default: true) */
  enabled?: boolean;
  /** Called when swipe starts */
  onSwipeStart?: () => void;
  /** Called when swipe ends */
  onSwipeEnd?: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SCREEN_WIDTH = Dimensions.get('window').width;
const ACTION_WIDTH = 80;
const SPRING_CONFIG = { damping: 20, stiffness: 200, mass: 0.8 };

// ============================================================================
// COMPONENT
// ============================================================================

export function SwipeableCard({
  children,
  leftAction,
  rightAction,
  threshold = 80,
  enabled = true,
  onSwipeStart,
  onSwipeEnd,
}: SwipeableCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const translateX = useSharedValue(0);
  const isActive = useSharedValue(false);
  const hasTriggeredHaptic = useRef(false);

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const triggerAction = useCallback((action: SwipeAction) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    action.onAction();
  }, []);

  const panGesture = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onStart(() => {
      isActive.value = true;
      hasTriggeredHaptic.current = false;
      if (onSwipeStart) {
        runOnJS(onSwipeStart)();
      }
    })
    .onUpdate((e) => {
      // Limit swipe based on available actions
      let newX = e.translationX;

      if (!leftAction && newX > 0) newX = 0;
      if (!rightAction && newX < 0) newX = 0;

      // Add resistance at edges
      if (leftAction && newX > threshold * 1.5) {
        newX = threshold * 1.5 + (newX - threshold * 1.5) * 0.3;
      }
      if (rightAction && newX < -threshold * 1.5) {
        newX = -threshold * 1.5 + (newX + threshold * 1.5) * 0.3;
      }

      translateX.value = newX;

      // Haptic feedback when crossing threshold
      const crossedThreshold =
        (leftAction && newX > threshold) ||
        (rightAction && newX < -threshold);

      if (crossedThreshold && !hasTriggeredHaptic.current) {
        hasTriggeredHaptic.current = true;
        runOnJS(triggerHaptic)();
      } else if (!crossedThreshold && hasTriggeredHaptic.current) {
        hasTriggeredHaptic.current = false;
      }
    })
    .onEnd((e) => {
      isActive.value = false;

      // Check if action should be triggered
      if (leftAction && translateX.value > threshold) {
        runOnJS(triggerAction)(leftAction);
      } else if (rightAction && translateX.value < -threshold) {
        runOnJS(triggerAction)(rightAction);
      }

      // Snap back
      translateX.value = withSpring(0, SPRING_CONFIG);

      if (onSwipeEnd) {
        runOnJS(onSwipeEnd)();
      }
    });

  // Animated styles for the card
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Animated styles for left action
  const leftActionStyle = useAnimatedStyle(() => {
    if (!leftAction) return { opacity: 0 };

    const progress = interpolate(translateX.value, [0, threshold], [0, 1], 'clamp');
    const scale = interpolate(translateX.value, [0, threshold * 0.5, threshold], [0.5, 0.8, 1], 'clamp');
    const iconScale = interpolate(translateX.value, [threshold * 0.8, threshold, threshold * 1.2], [1, 1.2, 1], 'clamp');

    return {
      opacity: progress,
      transform: [{ scale }, { translateX: interpolate(progress, [0, 1], [-20, 0]) }],
    };
  });

  const leftIconStyle = useAnimatedStyle(() => {
    if (!leftAction) return {};

    const iconScale = interpolate(
      translateX.value,
      [threshold * 0.8, threshold, threshold * 1.2],
      [1, 1.3, 1],
      'clamp'
    );

    return {
      transform: [{ scale: iconScale }],
    };
  });

  // Animated styles for right action
  const rightActionStyle = useAnimatedStyle(() => {
    if (!rightAction) return { opacity: 0 };

    const progress = interpolate(translateX.value, [0, -threshold], [0, 1], 'clamp');
    const scale = interpolate(translateX.value, [0, -threshold * 0.5, -threshold], [0.5, 0.8, 1], 'clamp');

    return {
      opacity: progress,
      transform: [{ scale }, { translateX: interpolate(progress, [0, 1], [20, 0]) }],
    };
  });

  const rightIconStyle = useAnimatedStyle(() => {
    if (!rightAction) return {};

    const iconScale = interpolate(
      translateX.value,
      [-threshold * 0.8, -threshold, -threshold * 1.2],
      [1, 1.3, 1],
      'clamp'
    );

    return {
      transform: [{ scale: iconScale }],
    };
  });

  return (
    <View style={styles.container}>
      {/* Left Action Background */}
      {leftAction && (
        <Animated.View
          style={[
            styles.actionContainer,
            styles.leftAction,
            { backgroundColor: leftAction.color },
            leftActionStyle,
          ]}
        >
          <Animated.View style={[styles.actionContent, leftIconStyle]}>
            <IconSymbol name={leftAction.icon} size={24} color="#fff" />
            <ThemedText style={styles.actionLabel}>{leftAction.label}</ThemedText>
          </Animated.View>
        </Animated.View>
      )}

      {/* Right Action Background */}
      {rightAction && (
        <Animated.View
          style={[
            styles.actionContainer,
            styles.rightAction,
            { backgroundColor: rightAction.color },
            rightActionStyle,
          ]}
        >
          <Animated.View style={[styles.actionContent, rightIconStyle]}>
            <IconSymbol name={rightAction.icon} size={24} color="#fff" />
            <ThemedText style={styles.actionLabel}>{rightAction.label}</ThemedText>
          </Animated.View>
        </Animated.View>
      )}

      {/* Card Content */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.card, cardStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// ============================================================================
// QUICK SWIPE WRAPPER
// ============================================================================

/**
 * Pre-configured swipeable for exercise cards
 * - Swipe right: Add to workout
 */
export function SwipeableExerciseCard({
  children,
  onAdd,
  onMoreOptions,
}: {
  children: React.ReactNode;
  onAdd?: () => void;
  onMoreOptions?: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <SwipeableCard
      leftAction={
        onAdd
          ? {
              icon: 'plus.circle.fill',
              label: 'Add',
              color: colors.tint,
              onAction: onAdd,
            }
          : undefined
      }
      rightAction={
        onMoreOptions
          ? {
              icon: 'ellipsis.circle.fill',
              label: 'More',
              color: colors.textSecondary,
              onAction: onMoreOptions,
            }
          : undefined
      }
    >
      {children}
    </SwipeableCard>
  );
}

/**
 * Pre-configured swipeable for program cards
 * - Swipe right: Start workout
 * - Swipe left: View details
 */
export function SwipeableProgramCard({
  children,
  onStart,
  onViewDetails,
}: {
  children: React.ReactNode;
  onStart?: () => void;
  onViewDetails?: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <SwipeableCard
      leftAction={
        onStart
          ? {
              icon: 'play.fill',
              label: 'Start',
              color: '#34C759',
              onAction: onStart,
            }
          : undefined
      }
      rightAction={
        onViewDetails
          ? {
              icon: 'info.circle.fill',
              label: 'Details',
              color: colors.tint,
              onAction: onViewDetails,
            }
          : undefined
      }
    >
      {children}
    </SwipeableCard>
  );
}

/**
 * Pre-configured swipeable for workout set rows
 * - Swipe right: Complete set
 * - Swipe left: Delete set
 */
export function SwipeableSetRow({
  children,
  onComplete,
  onDelete,
}: {
  children: React.ReactNode;
  onComplete?: () => void;
  onDelete?: () => void;
}) {
  return (
    <SwipeableCard
      leftAction={
        onComplete
          ? {
              icon: 'checkmark.circle.fill',
              label: 'Done',
              color: '#34C759',
              onAction: onComplete,
            }
          : undefined
      }
      rightAction={
        onDelete
          ? {
              icon: 'trash.fill',
              label: 'Delete',
              color: '#FF3B30',
              onAction: onDelete,
            }
          : undefined
      }
      threshold={60}
    >
      {children}
    </SwipeableCard>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: Radius.lg,
  },
  card: {
    zIndex: 1,
  },
  actionContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH * 1.5,
    justifyContent: 'center',
    borderRadius: Radius.lg,
  },
  leftAction: {
    left: 0,
    alignItems: 'flex-start',
    paddingLeft: Spacing.md,
  },
  rightAction: {
    right: 0,
    alignItems: 'flex-end',
    paddingRight: Spacing.md,
  },
  actionContent: {
    alignItems: 'center',
    gap: 4,
  },
  actionLabel: {
    ...Typography.caption2,
    color: '#fff',
    fontWeight: '600',
  },
});
