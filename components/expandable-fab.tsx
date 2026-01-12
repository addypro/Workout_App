/**
 * Expandable FAB Component
 *
 * An innovative floating action button that transforms from a simple plus button
 * into a vertical capsule with two options: Quick Workout and New Program.
 *
 * Features:
 * - Tap to expand/collapse
 * - Swipe up/down to switch selection
 * - Haptic feedback on interactions
 * - Smooth spring animations
 */

import * as Haptics from 'expo-haptics';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ExpandableFABProps {
  onQuickWorkout: () => void;
  onNewProgram: () => void;
  onVoiceLog?: () => void;
}

const COLLAPSED_SIZE = 56;
const EXPANDED_HEIGHT = 240; // Increased for 3 options
const EXPANDED_WIDTH = 200;
const SPRING_CONFIG = {
  damping: 18,
  stiffness: 200,
  mass: 0.8,
};

export function ExpandableFAB({ onQuickWorkout, onNewProgram, onVoiceLog }: ExpandableFABProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Animation values
  const expanded = useSharedValue(0); // 0 = collapsed, 1 = expanded
  const selectedIndex = useSharedValue(0); // 0 = Voice Log, 1 = Quick Workout, 2 = New Program
  const translateY = useSharedValue(0);

  const triggerHaptic = useCallback((style: Haptics.ImpactFeedbackStyle) => {
    Haptics.impactAsync(style);
  }, []);

  const handleExpand = useCallback(() => {
    'worklet';
    if (expanded.value === 0) {
      expanded.value = withSpring(1, SPRING_CONFIG);
      runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, []);

  const handleCollapse = useCallback(() => {
    'worklet';
    expanded.value = withSpring(0, SPRING_CONFIG);
    selectedIndex.value = 0;
    translateY.value = 0;
  }, []);

  // When expanded, tap gesture just closes (inner Pressables handle selection)
  // When collapsed, tap expands
  const handleSelect = useCallback(() => {
    'worklet';
    if (expanded.value > 0.5) {
      // Just collapse - inner Pressables handle the action
      expanded.value = withSpring(0, SPRING_CONFIG);
      selectedIndex.value = 0;
    } else {
      handleExpand();
    }
  }, []);

  // Pan gesture for swiping between options (3 options now)
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (expanded.value > 0.5) {
        translateY.value = e.translationY;
        // Update selection based on swipe direction (0=Voice, 1=Quick, 2=Program)
        if (e.translationY > 40) {
          selectedIndex.value = withSpring(2, SPRING_CONFIG);
        } else if (e.translationY > 15) {
          selectedIndex.value = withSpring(1, SPRING_CONFIG);
        } else if (e.translationY < -15) {
          selectedIndex.value = withSpring(0, SPRING_CONFIG);
        }
      }
    })
    .onEnd(() => {
      translateY.value = withSpring(0, SPRING_CONFIG);
    });

  // Tap gesture
  const tapGesture = Gesture.Tap().onEnd(() => {
    handleSelect();
  });

  // Long press to expand (alternative to tap)
  const longPressGesture = Gesture.LongPress()
    .minDuration(200)
    .onStart(() => {
      handleExpand();
    });

  const composedGesture = Gesture.Race(
    panGesture,
    Gesture.Exclusive(longPressGesture, tapGesture)
  );

  // Container animation
  const containerStyle = useAnimatedStyle(() => {
    const width = interpolate(expanded.value, [0, 1], [COLLAPSED_SIZE, EXPANDED_WIDTH]);
    const height = interpolate(expanded.value, [0, 1], [COLLAPSED_SIZE, EXPANDED_HEIGHT]);
    const borderRadius = interpolate(expanded.value, [0, 1], [COLLAPSED_SIZE / 2, Radius.lg]);

    return {
      width,
      height,
      borderRadius,
    };
  });

  // Plus icon animation (fades out when expanded)
  const plusIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expanded.value, [0, 0.3], [1, 0]),
    transform: [{ rotate: `${interpolate(expanded.value, [0, 1], [0, 45])}deg` }],
  }));

  // Options container animation
  const optionsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expanded.value, [0.5, 1], [0, 1]),
    transform: [{ translateY: interpolate(expanded.value, [0.5, 1], [20, 0]) }],
  }));

  // Voice Log option animation (index 0)
  const voiceLogStyle = useAnimatedStyle(() => {
    const scale = interpolate(selectedIndex.value, [0, 1, 2], [1.05, 0.95, 0.9]);
    const opacity = interpolate(selectedIndex.value, [0, 1, 2], [1, 0.5, 0.4]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  // Quick Workout option animation (index 1)
  const quickWorkoutStyle = useAnimatedStyle(() => {
    const scale = interpolate(selectedIndex.value, [0, 1, 2], [0.95, 1.05, 0.95]);
    const opacity = interpolate(selectedIndex.value, [0, 1, 2], [0.5, 1, 0.5]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  // New Program option animation (index 2)
  const newProgramStyle = useAnimatedStyle(() => {
    const scale = interpolate(selectedIndex.value, [0, 1, 2], [0.9, 0.95, 1.05]);
    const opacity = interpolate(selectedIndex.value, [0, 1, 2], [0.4, 0.5, 1]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <>
      {/* Backdrop (tap to close) */}
      <Animated.View
        style={[
          styles.backdrop,
          useAnimatedStyle(() => ({
            opacity: expanded.value * 0.3,
            pointerEvents: expanded.value > 0.5 ? 'auto' : 'none',
          })),
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => handleCollapse()} />
      </Animated.View>

      {/* FAB Container */}
      <GestureDetector gesture={composedGesture}>
        <Animated.View
          style={[
            styles.container,
            containerStyle,
            {
              backgroundColor: colors.tint,
              shadowColor: '#000',
            },
          ]}
        >
          {/* Collapsed Plus Icon */}
          <Animated.View style={[styles.plusIconContainer, plusIconStyle]}>
            <IconSymbol name="plus" size={26} color="#fff" />
          </Animated.View>

          {/* Expanded Options */}
          <Animated.View style={[styles.optionsContainer, optionsStyle]}>
            {/* Voice Log Option (Direct-to-Intent) */}
            {onVoiceLog && (
              <>
                <Animated.View style={[styles.option, voiceLogStyle]}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.optionPressable,
                      pressed && styles.optionPressed,
                    ]}
                    hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      expanded.value = withSpring(0, SPRING_CONFIG);
                      onVoiceLog();
                    }}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: 'rgba(255,59,48,0.3)' }]}>
                      <IconSymbol name="mic.fill" size={20} color="#fff" />
                    </View>
                    <View style={styles.optionTextContainer}>
                      <ThemedText style={styles.optionTitle}>Voice Log</ThemedText>
                      <ThemedText style={styles.optionSubtitle}>Speak your workout</ThemedText>
                    </View>
                  </Pressable>
                </Animated.View>
                <View style={styles.divider} />
              </>
            )}

            {/* Quick Workout Option */}
            <Animated.View style={[styles.option, quickWorkoutStyle]}>
              <Pressable
                style={({ pressed }) => [
                  styles.optionPressable,
                  pressed && styles.optionPressed,
                ]}
                hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  expanded.value = withSpring(0, SPRING_CONFIG);
                  onQuickWorkout();
                }}
              >
                <View style={styles.optionIcon}>
                  <IconSymbol name="bolt.fill" size={20} color="#fff" />
                </View>
                <View style={styles.optionTextContainer}>
                  <ThemedText style={styles.optionTitle}>Quick Workout</ThemedText>
                  <ThemedText style={styles.optionSubtitle}>Start now, no setup</ThemedText>
                </View>
              </Pressable>
            </Animated.View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* New Program Option */}
            <Animated.View style={[styles.option, newProgramStyle]}>
              <Pressable
                style={({ pressed }) => [
                  styles.optionPressable,
                  pressed && styles.optionPressed,
                ]}
                hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  expanded.value = withSpring(0, SPRING_CONFIG);
                  onNewProgram();
                }}
              >
                <View style={styles.optionIcon}>
                  <IconSymbol name="doc.badge.plus" size={20} color="#fff" />
                </View>
                <View style={styles.optionTextContainer}>
                  <ThemedText style={styles.optionTitle}>New Program</ThemedText>
                  <ThemedText style={styles.optionSubtitle}>Build a routine</ThemedText>
                </View>
              </Pressable>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  container: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    overflow: 'hidden',
  },
  plusIconContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsContainer: {
    flex: 1,
    width: '100%',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    justifyContent: 'space-around',
  },
  option: {
    flex: 1,
    justifyContent: 'center',
  },
  optionPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  optionPressed: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextContainer: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  optionSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: -Spacing.md,
  },
});
