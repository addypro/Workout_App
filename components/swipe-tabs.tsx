/**
 * SwipeTabs Component
 *
 * Enhanced tab navigation with edge swipe gestures.
 * Mobile-first design with native-feel interactions.
 *
 * Features:
 * - Edge swipe to navigate between tabs
 * - Smooth haptic feedback
 * - Prevents conflicts with scrollable content
 */

import { PropsWithChildren, useMemo, useRef, useCallback } from 'react';
import { View, useWindowDimensions, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/context/auth-context';

// ============================================================================
// TYPES
// ============================================================================

type TabName = 'index' | 'explore' | 'stats' | 'you' | 'coach';

interface SwipeTabsProps {
  current: TabName;
  children: React.ReactNode;
  /** Callback when refresh is triggered */
  onRefresh?: () => Promise<void>;
  /** Show edge indicators when near tab boundaries */
  showEdgeIndicators?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TAB_ORDER: TabName[] = ['index', 'explore', 'stats', 'you'];

const EDGE_ZONE = 28; // Trigger zone from screen edge
const SWIPE_THRESHOLD = 70; // Distance to trigger tab change
const VELOCITY_THRESHOLD = 700; // Velocity to trigger tab change

const SPRING_CONFIG = { damping: 20, stiffness: 300 };

// ============================================================================
// HELPERS
// ============================================================================

function getNeighbor(order: TabName[], current: TabName, dir: 'prev' | 'next'): TabName | null {
  const i = order.indexOf(current);
  if (i === -1) return null;
  const j = dir === 'prev' ? i - 1 : i + 1;
  return order[j] ?? null;
}

function triggerHaptic(type: 'light' | 'medium' | 'selection') {
  if (Platform.OS !== 'ios') return;

  switch (type) {
    case 'light':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      break;
    case 'medium':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      break;
    case 'selection':
      Haptics.selectionAsync();
      break;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SwipeTabs({
  current,
  children,
  onRefresh,
  showEdgeIndicators = true,
}: SwipeTabsProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { width } = useWindowDimensions();
  const { isCoach } = useAuth();

  const tabOrder = useMemo(() => {
    const base = [...TAB_ORDER];
    if (isCoach) base.push('coach');
    return base;
  }, [isCoach]);

  const startXRef = useRef<number>(0);
  const hasTriggeredHaptic = useRef(false);

  // Animation values
  const edgeProgress = useSharedValue(0); // -1 = left, 0 = center, 1 = right
  const isNearEdge = useSharedValue(false);

  const hasPrev = getNeighbor(tabOrder, current, 'prev') !== null;
  const hasNext = getNeighbor(tabOrder, current, 'next') !== null;

  const navigateToTab = useCallback((tab: TabName) => {
    triggerHaptic('selection');
    router.replace(`/(tabs)/${tab}` as any);
  }, []);

  const gesture = useMemo(() => {
    return Gesture.Pan()
      .onBegin((e) => {
        startXRef.current = e.x;
        hasTriggeredHaptic.current = false;

        const fromLeftEdge = e.x <= EDGE_ZONE;
        const fromRightEdge = e.x >= width - EDGE_ZONE;

        if ((fromLeftEdge && hasPrev) || (fromRightEdge && hasNext)) {
          isNearEdge.value = true;
        }
      })
      .activeOffsetX([-14, 14])
      .failOffsetY([-14, 14])
      .onUpdate((e) => {
        const fromLeftEdge = startXRef.current <= EDGE_ZONE;
        const fromRightEdge = startXRef.current >= width - EDGE_ZONE;

        if (fromLeftEdge && hasPrev) {
          // Swiping from left edge (going to prev tab)
          const progress = Math.min(e.translationX / SWIPE_THRESHOLD, 1.2);
          edgeProgress.value = progress;

          // Haptic when crossing threshold
          if (progress >= 1 && !hasTriggeredHaptic.current) {
            hasTriggeredHaptic.current = true;
            runOnJS(triggerHaptic)('medium');
          } else if (progress < 1 && hasTriggeredHaptic.current) {
            hasTriggeredHaptic.current = false;
          }
        } else if (fromRightEdge && hasNext) {
          // Swiping from right edge (going to next tab)
          const progress = Math.min(-e.translationX / SWIPE_THRESHOLD, 1.2);
          edgeProgress.value = -progress;

          if (progress >= 1 && !hasTriggeredHaptic.current) {
            hasTriggeredHaptic.current = true;
            runOnJS(triggerHaptic)('medium');
          } else if (progress < 1 && hasTriggeredHaptic.current) {
            hasTriggeredHaptic.current = false;
          }
        }
      })
      .onEnd((e) => {
        const fromLeftEdge = startXRef.current <= EDGE_ZONE;
        const fromRightEdge = startXRef.current >= width - EDGE_ZONE;

        // Navigate if threshold crossed
        if (fromLeftEdge && (e.translationX > SWIPE_THRESHOLD || e.velocityX > VELOCITY_THRESHOLD)) {
          const prev = getNeighbor(tabOrder, current, 'prev');
          if (prev) {
            runOnJS(navigateToTab)(prev);
          }
        } else if (fromRightEdge && (e.translationX < -SWIPE_THRESHOLD || e.velocityX < -VELOCITY_THRESHOLD)) {
          const next = getNeighbor(tabOrder, current, 'next');
          if (next) {
            runOnJS(navigateToTab)(next);
          }
        }

        // Reset animation
        edgeProgress.value = withSpring(0, SPRING_CONFIG);
        isNearEdge.value = false;
      })
      .onFinalize(() => {
        edgeProgress.value = withSpring(0, SPRING_CONFIG);
        isNearEdge.value = false;
      });
  }, [current, width, hasPrev, hasNext, navigateToTab, tabOrder]);

  // Edge indicator animations
  const leftIndicatorStyle = useAnimatedStyle(() => {
    if (!showEdgeIndicators || !hasPrev) return { opacity: 0 };

    const opacity = interpolate(edgeProgress.value, [0, 0.3, 1], [0, 0.5, 1], 'clamp');
    const scale = interpolate(edgeProgress.value, [0, 1], [0.8, 1], 'clamp');
    const translateX = interpolate(edgeProgress.value, [0, 1], [-10, 0], 'clamp');

    return {
      opacity,
      transform: [{ scale }, { translateX }],
    };
  });

  const rightIndicatorStyle = useAnimatedStyle(() => {
    if (!showEdgeIndicators || !hasNext) return { opacity: 0 };

    const opacity = interpolate(edgeProgress.value, [0, -0.3, -1], [0, 0.5, 1], 'clamp');
    const scale = interpolate(edgeProgress.value, [0, -1], [0.8, 1], 'clamp');
    const translateX = interpolate(edgeProgress.value, [0, -1], [10, 0], 'clamp');

    return {
      opacity,
      transform: [{ scale }, { translateX }],
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.container}>
        {/* Left Edge Indicator */}
        {showEdgeIndicators && hasPrev && (
          <Animated.View
            style={[
              styles.edgeIndicator,
              styles.leftIndicator,
              { backgroundColor: colors.tint },
              leftIndicatorStyle,
            ]}
          />
        )}

        {/* Right Edge Indicator */}
        {showEdgeIndicators && hasNext && (
          <Animated.View
            style={[
              styles.edgeIndicator,
              styles.rightIndicator,
              { backgroundColor: colors.tint },
              rightIndicatorStyle,
            ]}
          />
        )}

        {/* Content */}
        {children}
      </View>
    </GestureDetector>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  edgeIndicator: {
    position: 'absolute',
    top: '50%',
    width: 4,
    height: 48,
    marginTop: -24,
    borderRadius: 2,
    zIndex: 100,
  },
  leftIndicator: {
    left: 0,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  rightIndicator: {
    right: 0,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
});
