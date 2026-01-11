/**
 * My Program Card Component
 *
 * Clean, iOS-style program card with:
 * - Single tap to start/continue workout
 * - Swipe left to reveal delete action (iOS-style)
 * - Long-press or ellipsis for more actions (edit, export, delete)
 * - Simple progress bar
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  Modal,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ProgramOverview, type Workout } from './program-overview';
import { Colors, Radius, Spacing, StatusColors, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getCompletedWorkouts, type Program } from '@/lib/db/storage';

export type ProgramWithProgress = Program & {
  completedCount: number;
  totalWorkouts: number;
};

interface MyProgramCardProps {
  program: ProgramWithProgress;
  onStart: (program: ProgramWithProgress) => void;
  onEdit: (program: ProgramWithProgress) => void;
  onDelete: (program: ProgramWithProgress) => void;
  onExport: (program: ProgramWithProgress) => void;
}

const DELETE_THRESHOLD = -80;
const SPRING_CONFIG = { damping: 20, stiffness: 200 };

export function MyProgramCard({
  program,
  onStart,
  onEdit,
  onDelete,
  onExport,
}: MyProgramCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const [completedSet, setCompletedSet] = useState<Set<string>>(new Set());

  // Swipe animation values
  const translateX = useSharedValue(0);
  const isSwipeActive = useSharedValue(false);

  const progressPercent =
    program.totalWorkouts > 0
      ? Math.round((program.completedCount / program.totalWorkouts) * 100)
      : 0;
  const hasProgress = program.completedCount > 0;
  const isComplete = progressPercent === 100;
  const progressColor = isComplete ? StatusColors.success : colors.tint;

  // Parse workouts from program data (memoized - zero cost on re-render)
  const workouts = useMemo<Workout[]>(() => {
    try {
      const parsed = typeof program.parsedData === 'string'
        ? JSON.parse(program.parsedData)
        : program.parsedData;
      return parsed?.workouts || [];
    } catch {
      return [];
    }
  }, [program.parsedData]);

  // Load completions when overview is expanded (lazy loading)
  useEffect(() => {
    if (overviewExpanded && completedSet.size === 0) {
      getCompletedWorkouts(program.id).then(setCompletedSet);
    }
  }, [overviewExpanded, program.id, completedSet.size]);

  // Handle starting workout from inline preview
  const handleSelectWorkout = useCallback((week: number, day: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/workout/${program.id}?week=${week}&day=${day}`);
  }, [program.id, router]);

  const toggleOverview = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOverviewExpanded(prev => !prev);
  }, []);

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMenuVisible(true);
  };

  const handleMenuAction = (action: () => void) => {
    setMenuVisible(false);
    action();
  };

  const triggerDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    // Reset swipe position before showing confirmation (so card isn't stuck if cancelled)
    translateX.value = withSpring(0, SPRING_CONFIG);
    onDelete(program);
  };

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const getStatusInfo = () => {
    if (program.status !== 'READY') {
      return {
        color: program.status === 'ERROR' ? StatusColors.error : StatusColors.warning,
        text: program.status,
      };
    }
    return null;
  };

  const statusInfo = getStatusInfo();

  // Swipe gesture for delete
  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10]) // Fail if vertical scroll starts - prevents conflict with FlatList
    .minDistance(10) // Minimum distance before gesture activates
    .onStart(() => {
      isSwipeActive.value = true;
    })
    .onUpdate((e) => {
      // Only allow swiping left (negative values)
      translateX.value = Math.min(0, Math.max(-120, e.translationX));

      // Haptic at threshold
      if (translateX.value <= DELETE_THRESHOLD && !isSwipeActive.value) {
        runOnJS(triggerHaptic)();
      }
    })
    .onEnd(() => {
      isSwipeActive.value = false;
      if (translateX.value <= DELETE_THRESHOLD) {
        // Trigger delete
        translateX.value = withTiming(-120, { duration: 150 });
        runOnJS(triggerDelete)();
      } else {
        // Snap back
        translateX.value = withSpring(0, SPRING_CONFIG);
      }
    });

  // Card animated style
  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Delete button animated style
  const deleteButtonStyle = useAnimatedStyle(() => {
    const width = interpolate(
      translateX.value,
      [-120, -80, 0],
      [120, 80, 0]
    );
    const opacity = interpolate(
      translateX.value,
      [-80, -40, 0],
      [1, 0.5, 0]
    );
    return {
      width: Math.max(0, width),
      opacity,
    };
  });

  return (
    <>
      <View style={styles.swipeContainer}>
        {/* Delete action behind card */}
        <Animated.View
          style={[
            styles.deleteAction,
            { backgroundColor: StatusColors.error },
            deleteButtonStyle,
          ]}
        >
          <IconSymbol name="trash.fill" size={22} color="#fff" />
          <ThemedText style={styles.deleteText}>Delete</ThemedText>
        </Animated.View>

        {/* Swipeable Card */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={cardAnimatedStyle}>
            <Pressable
              onPress={() => {
                if (translateX.value < -10) {
                  translateX.value = withSpring(0, SPRING_CONFIG);
                  return;
                }
                if (program.status === 'READY') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onStart(program);
                }
              }}
              onLongPress={handleLongPress}
              delayLongPress={400}
            >
              {({ pressed }) => (
                <Card
                  style={[styles.card, pressed && styles.cardPressed]}
                  padding="md"
                >
            {/* Header Row */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <ThemedText style={styles.title} numberOfLines={1}>
                  {program.name}
                </ThemedText>
                {program.description && (
                  <ThemedText
                    style={[styles.subtitle, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {program.description}
                  </ThemedText>
                )}
              </View>

              {/* More Button */}
              <Pressable
                hitSlop={16}
                onPress={(e) => {
                  e.stopPropagation();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setMenuVisible(true);
                }}
                style={({ pressed: p }) => [
                  styles.moreButton,
                  { opacity: p ? 0.5 : 1 },
                ]}
              >
                <IconSymbol
                  name="ellipsis.circle"
                  size={22}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>

            {/* Status Badge OR Progress */}
            {statusInfo ? (
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statusInfo.color + '18' },
                ]}
              >
                <ThemedText
                  style={[styles.statusText, { color: statusInfo.color }]}
                >
                  {statusInfo.text}
                </ThemedText>
              </View>
            ) : (
              program.totalWorkouts > 0 && (
                <View style={styles.progressSection}>
                  {/* Progress Bar */}
                  <View
                    style={[
                      styles.progressBar,
                      { backgroundColor: colors.separator },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${progressPercent}%`,
                          backgroundColor: progressColor,
                        },
                      ]}
                    />
                  </View>

                  {/* Progress Text */}
                  <View style={styles.progressInfo}>
                    <ThemedText
                      style={[styles.progressText, { color: colors.textSecondary }]}
                    >
                      {isComplete ? (
                        <>
                          <IconSymbol
                            name="checkmark.circle.fill"
                            size={13}
                            color={progressColor}
                          />{' '}
                          Complete
                        </>
                      ) : hasProgress ? (
                        `${program.completedCount}/${program.totalWorkouts} workouts`
                      ) : (
                        `${program.totalWorkouts} workouts`
                      )}
                    </ThemedText>

                    {/* Tap to start hint */}
                    <ThemedText
                      style={[styles.tapHint, { color: colors.tint }]}
                    >
                      {hasProgress ? 'Continue' : 'Start'}{' '}
                      <IconSymbol
                        name="chevron.right"
                        size={11}
                        color={colors.tint}
                      />
                    </ThemedText>
                  </View>
                </View>
              )
            )}

            {/* Expandable Program Overview */}
            {workouts.length > 0 && program.status === 'READY' && (
              <ProgramOverview
                workouts={workouts}
                completedSet={completedSet}
                onSelectWorkout={handleSelectWorkout}
                expanded={overviewExpanded}
                onToggleExpand={toggleOverview}
                programId={program.id}
              />
            )}
                  </Card>
                )}
              </Pressable>
            </Animated.View>
          </GestureDetector>
        </View>

      {/* Action Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.menuContainer,
                  {
                    backgroundColor:
                      colorScheme === 'dark'
                        ? colors.elevated
                        : colors.card,
                  },
                ]}
              >
                <ThemedText style={styles.menuTitle} numberOfLines={1}>
                  {program.name}
                </ThemedText>

                <MenuItem
                  icon="pencil"
                  label="Edit Program"
                  onPress={() => handleMenuAction(() => onEdit(program))}
                  colors={colors}
                />
                <MenuItem
                  icon="square.and.arrow.down"
                  label="Export CSV"
                  onPress={() => handleMenuAction(() => onExport(program))}
                  colors={colors}
                />
                <View
                  style={[styles.menuDivider, { backgroundColor: colors.separator }]}
                />
                <MenuItem
                  icon="trash"
                  label="Delete"
                  onPress={() => handleMenuAction(() => onDelete(program))}
                  colors={colors}
                  destructive
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

// Menu Item Component
function MenuItem({
  icon,
  label,
  onPress,
  colors,
  destructive = false,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  colors: (typeof Colors)['light'];
  destructive?: boolean;
}) {
  const color = destructive ? StatusColors.error : colors.text;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuItem,
        pressed && { backgroundColor: colors.separator + '40' },
      ]}
      onPress={onPress}
    >
      <IconSymbol name={icon as any} size={20} color={color} />
      <ThemedText style={[styles.menuItemText, { color }]}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  swipeContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: Radius.lg,
  },
  deleteAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
  },
  deleteText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    gap: Spacing.sm,
  },
  cardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.98 }],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Typography.headline,
    fontWeight: '600',
  },
  subtitle: {
    ...Typography.subhead,
  },
  moreButton: {
    padding: 4,
    marginTop: -4,
    marginRight: -4,
  },
  progressSection: {
    gap: Spacing.xs,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressText: {
    ...Typography.caption1,
  },
  tapHint: {
    ...Typography.caption1,
    fontWeight: '600',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusText: {
    ...Typography.caption1,
    fontWeight: '600',
  },
  // Menu styles
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  menuContainer: {
    width: '100%',
    maxWidth: 300,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  menuTitle: {
    ...Typography.subhead,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  menuItemText: {
    ...Typography.body,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.xs,
  },
});
