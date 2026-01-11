/**
 * Quick Entry Modal
 *
 * One-tap workout entry for minimal interaction depth.
 * Enables instant capture of workout intent before motivation is lost.
 *
 * Mobile-first design with thumb-friendly layout.
 */

import React, { useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Pressable,
  StyleSheet,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { createProgram } from '@/lib/db/storage';

// ============================================================================
// TYPES
// ============================================================================

interface QuickEntryModalProps {
  visible: boolean;
  onClose: () => void;
  /** Recent workouts for quick continuation */
  recentWorkouts?: RecentWorkout[];
}

interface RecentWorkout {
  id: string;
  name: string;
  lastDate: string;
  programName?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MODAL_HEIGHT = 380;
const SPRING_CONFIG = { damping: 20, stiffness: 200 };

// ============================================================================
// COMPONENT
// ============================================================================

export function QuickEntryModal({
  visible,
  onClose,
  recentWorkouts = [],
}: QuickEntryModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const translateY = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, SPRING_CONFIG);
    } else {
      backdropOpacity.value = withTiming(0, { duration: 150 });
      translateY.value = withSpring(MODAL_HEIGHT, SPRING_CONFIG);
    }
  }, [visible]);

  const triggerHaptic = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleStartQuickWorkout = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Create an empty quick workout and go directly to execution
      const workoutName = `Quick Workout - ${new Date().toLocaleDateString()}`;
      const program = await createProgram(workoutName, 'Quick workout session');

      // Update with empty exercises (user will add as they go)
      const allPrograms = await AsyncStorage.getItem('@workout_programs');
      if (allPrograms) {
        const list = JSON.parse(allPrograms);
        const index = list.findIndex((p: any) => p.id === program.id);
        if (index !== -1) {
          list[index].parsedData = {
            workouts: [{
              week: 1,
              day: 1,
              name: workoutName,
              exercises: [], // Empty - user adds exercises during workout
              order: 0,
            }],
          };
          list[index].sourceType = 'BUILTIN';
          list[index].isQuickWorkout = true;
          await AsyncStorage.setItem('@workout_programs', JSON.stringify(list));
        }
      }

      // Close modal first, then navigate after a small delay to prevent glitch
      onClose();

      // Small delay to let modal close animation complete before navigation
      await new Promise(resolve => setTimeout(resolve, 150));

      // Navigate directly to workout execution (replace to avoid back-nav issues)
      router.replace(`/workout/${program.id}?week=1&day=1&quick=true`);
    } catch (e) {
      console.error('Error starting quick workout:', e);
      const msg = 'Failed to start quick workout';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    }
  }, [onClose]);

  const handleContinueWorkout = useCallback(
    (workout: RecentWorkout) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onClose();
      // Navigate to the workout with context
      router.push(`/workout/${workout.id}`);
    },
    [onClose]
  );

  // Swipe down to dismiss gesture
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > 100 || e.velocityY > 500) {
        translateY.value = withSpring(MODAL_HEIGHT, SPRING_CONFIG);
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, SPRING_CONFIG);
      }
    });

  const modalStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={styles.backdropPressable} onPress={onClose}>
          <BlurView
            intensity={20}
            tint={colorScheme === 'dark' ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        </Pressable>
      </Animated.View>

      {/* Modal Content */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              backgroundColor: colors.card,
              borderColor: colors.separator,
            },
            modalStyle,
          ]}
        >
          {/* Handle Bar */}
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: colors.separator }]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <IconSymbol name="bolt.fill" size={24} color={colors.tint} />
              <ThemedText style={[styles.title, { color: colors.text }]}>
                Quick Workout
              </ThemedText>
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                { opacity: pressed ? 0.5 : 1 },
              ]}
            >
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.textTertiary} />
            </Pressable>
          </View>

          {/* Primary Action: Start Quick Workout */}
          <Pressable
            onPress={handleStartQuickWorkout}
            style={({ pressed }) => [
              styles.primaryAction,
              {
                backgroundColor: colors.tint,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <View style={styles.primaryActionContent}>
              <IconSymbol name="play.fill" size={28} color="#fff" />
              <View style={styles.primaryActionText}>
                <ThemedText style={styles.primaryActionTitle}>
                  Start Quick Workout
                </ThemedText>
                <ThemedText style={styles.primaryActionSubtitle}>
                  Jump into unstructured logging
                </ThemedText>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={20} color="rgba(255,255,255,0.6)" />
          </Pressable>

          {/* Recent Workouts */}
          {recentWorkouts.length > 0 && (
            <View style={styles.recentSection}>
              <View style={styles.dividerRow}>
                <View style={[styles.divider, { backgroundColor: colors.separator }]} />
                <ThemedText style={[styles.dividerText, { color: colors.textTertiary }]}>
                  or continue
                </ThemedText>
                <View style={[styles.divider, { backgroundColor: colors.separator }]} />
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentList}
              >
                {recentWorkouts.slice(0, 5).map((workout) => (
                  <Pressable
                    key={workout.id}
                    onPress={() => handleContinueWorkout(workout)}
                    style={({ pressed }) => [
                      styles.recentChip,
                      {
                        backgroundColor: colors.elevated,
                        borderColor: colors.separator,
                        transform: [{ scale: pressed ? 0.95 : 1 }],
                      },
                    ]}
                  >
                    <IconSymbol
                      name="clock.arrow.circlepath"
                      size={14}
                      color={colors.textSecondary}
                    />
                    <ThemedText
                      style={[styles.recentChipText, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {workout.name}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <QuickActionButton
              icon="figure.strengthtraining.traditional"
              label="From Program"
              onPress={() => {
                triggerHaptic();
                onClose();
                router.push('/(tabs)' as any);
              }}
              colors={colors}
            />
            <QuickActionButton
              icon="list.bullet"
              label="Browse"
              onPress={() => {
                triggerHaptic();
                onClose();
                router.push('/(tabs)/browse');
              }}
              colors={colors}
            />
            <QuickActionButton
              icon="clock"
              label="History"
              onPress={() => {
                triggerHaptic();
                onClose();
                router.push('/history');
              }}
              colors={colors}
            />
          </View>
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function QuickActionButton({
  icon,
  label,
  onPress,
  colors,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  colors: typeof Colors.light;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickActionButton,
        {
          backgroundColor: colors.groupedBackground,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <IconSymbol name={icon as any} size={22} color={colors.tint} />
      <ThemedText style={[styles.quickActionLabel, { color: colors.textSecondary }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  backdropPressable: {
    flex: 1,
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    ...Shadows.lg,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    ...Typography.title3,
  },
  closeButton: {
    padding: 4,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
  },
  primaryActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  primaryActionText: {
    gap: 2,
  },
  primaryActionTitle: {
    ...Typography.headline,
    color: '#fff',
  },
  primaryActionSubtitle: {
    ...Typography.caption1,
    color: 'rgba(255,255,255,0.7)',
  },
  recentSection: {
    marginTop: Spacing.md,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  divider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    ...Typography.caption1,
  },
  recentList: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: Spacing.xs,
  },
  recentChipText: {
    ...Typography.caption1,
    fontWeight: '500',
    maxWidth: 120,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  quickActionLabel: {
    ...Typography.caption1,
    fontWeight: '500',
  },
});
