/**
 * Skeleton Loading Component
 *
 * Modern shimmer-effect skeleton placeholders for instant-feel UI.
 * Provides visual feedback during data loading without jarring spinners.
 */

import { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// ============================================================================
// SKELETON PRIMITIVES
// ============================================================================

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Base skeleton element with shimmer animation
 */
export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = Radius.sm,
  style,
}: SkeletonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(shimmer.value, [0, 1], [-200, 200]),
      },
    ],
  }));

  const baseColor = colorScheme === 'dark' ? '#2C2C2E' : '#E5E5EA';
  const shimmerColor = colorScheme === 'dark' ? '#3A3A3C' : '#F2F2F7';

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseColor,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View style={[styles.shimmerContainer, animatedStyle]}>
        <LinearGradient
          colors={['transparent', shimmerColor, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.shimmerGradient}
        />
      </Animated.View>
    </View>
  );
}

// ============================================================================
// SKELETON VARIANTS
// ============================================================================

/**
 * Skeleton for text lines
 */
export function SkeletonText({
  lines = 1,
  lastLineWidth = '60%',
  lineHeight = 16,
  gap = Spacing.xs,
  style,
}: {
  lines?: number;
  lastLineWidth?: number | `${number}%`;
  lineHeight?: number;
  gap?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ gap }, style]}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 && lines > 1 ? lastLineWidth : '100%'}
          height={lineHeight}
          borderRadius={Radius.xs}
        />
      ))}
    </View>
  );
}

/**
 * Skeleton for card layout (program card, workout card, etc.)
 */
export function SkeletonCard({ style }: { style?: ViewStyle }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.separator,
        },
        style,
      ]}
    >
      {/* Header row */}
      <View style={styles.cardHeader}>
        <Skeleton width={48} height={48} borderRadius={Radius.md} />
        <View style={styles.cardHeaderText}>
          <Skeleton width="70%" height={18} />
          <Skeleton width="40%" height={14} />
        </View>
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        <SkeletonText lines={2} lineHeight={14} />
      </View>

      {/* Footer chips */}
      <View style={styles.cardFooter}>
        <Skeleton width={60} height={24} borderRadius={Radius.full} />
        <Skeleton width={80} height={24} borderRadius={Radius.full} />
        <Skeleton width={50} height={24} borderRadius={Radius.full} />
      </View>
    </View>
  );
}

/**
 * Skeleton for exercise card in list
 */
export function SkeletonExerciseCard({ style }: { style?: ViewStyle }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View
      style={[
        styles.exerciseCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.separator,
        },
        style,
      ]}
    >
      {/* Exercise name and muscle */}
      <View style={styles.exerciseMain}>
        <Skeleton width="65%" height={17} />
        <Skeleton width="35%" height={13} />
      </View>

      {/* Equipment chip */}
      <Skeleton width={70} height={26} borderRadius={Radius.full} />
    </View>
  );
}

/**
 * Skeleton for list items (simple row layout)
 */
export function SkeletonListItem({ style }: { style?: ViewStyle }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View
      style={[
        styles.listItem,
        { borderBottomColor: colors.separator },
        style,
      ]}
    >
      <Skeleton width={40} height={40} borderRadius={Radius.sm} />
      <View style={styles.listItemContent}>
        <Skeleton width="60%" height={16} />
        <Skeleton width="40%" height={13} />
      </View>
      <Skeleton width={24} height={24} borderRadius={12} />
    </View>
  );
}

/**
 * Skeleton for workout set row
 */
export function SkeletonSetRow({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.setRow, style]}>
      <Skeleton width={28} height={28} borderRadius={Radius.xs} />
      <Skeleton width={60} height={36} borderRadius={Radius.sm} />
      <Skeleton width={60} height={36} borderRadius={Radius.sm} />
      <Skeleton width={36} height={36} borderRadius={18} />
    </View>
  );
}

/**
 * Skeleton for search/filter bar
 */
export function SkeletonSearchBar({ style }: { style?: ViewStyle }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.searchBar, style]}>
      <Skeleton width="100%" height={44} borderRadius={Radius.md} />
      <View style={styles.filterRow}>
        <Skeleton width={80} height={32} borderRadius={Radius.full} />
        <Skeleton width={90} height={32} borderRadius={Radius.full} />
        <Skeleton width={70} height={32} borderRadius={Radius.full} />
      </View>
    </View>
  );
}

// ============================================================================
// SKELETON LISTS
// ============================================================================

/**
 * Full skeleton list for programs/workouts screen
 */
export function SkeletonCardList({
  count = 3,
  style,
}: {
  count?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.list, style]}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

/**
 * Full skeleton list for exercises screen
 */
export function SkeletonExerciseList({
  count = 5,
  showSearch = true,
  style,
}: {
  count?: number;
  showSearch?: boolean;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.list, style]}>
      {showSearch && <SkeletonSearchBar />}
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonExerciseCard key={i} />
      ))}
    </View>
  );
}

/**
 * Skeleton for workout execution screen
 */
export function SkeletonWorkoutScreen({ style }: { style?: ViewStyle }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.workoutScreen, style]}>
      {/* Exercise header */}
      <View style={styles.workoutHeader}>
        <Skeleton width="50%" height={28} />
        <Skeleton width="30%" height={16} />
      </View>

      {/* Sets */}
      <View style={styles.setsContainer}>
        <View style={styles.setsHeader}>
          <Skeleton width={40} height={14} />
          <Skeleton width={50} height={14} />
          <Skeleton width={50} height={14} />
          <Skeleton width={30} height={14} />
        </View>
        <SkeletonSetRow />
        <SkeletonSetRow />
        <SkeletonSetRow />
      </View>

      {/* Bottom action */}
      <View style={styles.workoutAction}>
        <Skeleton width="100%" height={50} borderRadius={Radius.md} />
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  shimmerContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  shimmerGradient: {
    width: 200,
    height: '100%',
  },

  // Card skeleton
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  cardHeaderText: {
    flex: 1,
    gap: Spacing.xs,
    justifyContent: 'center',
  },
  cardContent: {
    paddingVertical: Spacing.xs,
  },
  cardFooter: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },

  // Exercise card skeleton
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  exerciseMain: {
    flex: 1,
    gap: Spacing.xs,
  },

  // List item skeleton
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listItemContent: {
    flex: 1,
    gap: Spacing.xs,
  },

  // Set row skeleton
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },

  // Search bar skeleton
  searchBar: {
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },

  // List container
  list: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },

  // Workout screen skeleton
  workoutScreen: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  workoutHeader: {
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
  },
  setsContainer: {
    gap: Spacing.xs,
  },
  setsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  workoutAction: {
    marginTop: 'auto',
    paddingVertical: Spacing.md,
  },
});
