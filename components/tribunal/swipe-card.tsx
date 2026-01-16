/**
 * Tribunal Swipe Card Component
 *
 * A Tinder-style swipeable card for PR verification.
 * - Swipe right to approve
 * - Swipe left to reject
 * - Swipe up to skip
 *
 * Features:
 * - Gesture-based interaction
 * - Visual feedback during swipe
 * - Haptic feedback
 * - Photo/video proof display
 */

import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect } from 'react';
import { Dimensions, Image, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { PRRecord } from '@/lib/services/tribunal/types';
import { formatPRDisplay, getStatusInfo } from '@/lib/services/tribunal/engine';

// ============================================
// CONSTANTS
// ============================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - Spacing.lg * 2;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.6;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;
const SWIPE_VELOCITY_THRESHOLD = 500;

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 200,
  mass: 0.8,
};

// ============================================
// TYPES
// ============================================

interface SwipeCardProps {
  pr: PRRecord;
  onApprove: (pr: PRRecord) => void;
  onReject: (pr: PRRecord) => void;
  onSkip: (pr: PRRecord) => void;
  isTop?: boolean;
}

// ============================================
// COMPONENT
// ============================================

export function SwipeCard({ pr, onApprove, onReject, onSkip, isTop = false }: SwipeCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Animation values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(isTop ? 1 : 0.95);
  const opacity = useSharedValue(isTop ? 1 : 0.8);

  // Update scale when isTop changes
  useEffect(() => {
    scale.value = withSpring(isTop ? 1 : 0.95, SPRING_CONFIG);
    opacity.value = withTiming(isTop ? 1 : 0.8, { duration: 200 });
  }, [isTop]);

  // Haptic feedback handlers
  const triggerHaptic = useCallback((style: Haptics.ImpactFeedbackStyle) => {
    Haptics.impactAsync(style);
  }, []);

  // Decision handlers
  const handleApprove = useCallback(() => {
    onApprove(pr);
  }, [pr, onApprove]);

  const handleReject = useCallback(() => {
    onReject(pr);
  }, [pr, onReject]);

  const handleSkip = useCallback(() => {
    onSkip(pr);
  }, [pr, onSkip]);

  // Pan gesture for swiping
  const panGesture = Gesture.Pan()
    .enabled(isTop)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
      rotate.value = interpolate(e.translationX, [-SCREEN_WIDTH, SCREEN_WIDTH], [-15, 15]);
    })
    .onEnd((e) => {
      const shouldSwipeRight =
        e.translationX > SWIPE_THRESHOLD || e.velocityX > SWIPE_VELOCITY_THRESHOLD;
      const shouldSwipeLeft =
        e.translationX < -SWIPE_THRESHOLD || e.velocityX < -SWIPE_VELOCITY_THRESHOLD;
      const shouldSwipeUp =
        e.translationY < -SWIPE_THRESHOLD || e.velocityY < -SWIPE_VELOCITY_THRESHOLD;

      if (shouldSwipeRight) {
        // Approve
        translateX.value = withSpring(SCREEN_WIDTH * 1.5, SPRING_CONFIG);
        runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Medium);
        runOnJS(handleApprove)();
      } else if (shouldSwipeLeft) {
        // Reject
        translateX.value = withSpring(-SCREEN_WIDTH * 1.5, SPRING_CONFIG);
        runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Medium);
        runOnJS(handleReject)();
      } else if (shouldSwipeUp) {
        // Skip
        translateY.value = withSpring(-SCREEN_HEIGHT, SPRING_CONFIG);
        runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Light);
        runOnJS(handleSkip)();
      } else {
        // Return to center
        translateX.value = withSpring(0, SPRING_CONFIG);
        translateY.value = withSpring(0, SPRING_CONFIG);
        rotate.value = withSpring(0, SPRING_CONFIG);
      }
    });

  // Animated styles
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  // Overlay opacity based on swipe direction
  const approveOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));

  const rejectOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));

  const skipOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));

  // Format time since submission
  const getTimeSince = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, cardStyle, { backgroundColor: colors.card }]}>
        {/* Decision overlays */}
        <Animated.View style={[styles.overlay, styles.approveOverlay, approveOverlayStyle]}>
          <IconSymbol name="checkmark.circle.fill" size={60} color="#34C759" />
          <ThemedText style={styles.overlayText}>APPROVE</ThemedText>
        </Animated.View>

        <Animated.View style={[styles.overlay, styles.rejectOverlay, rejectOverlayStyle]}>
          <IconSymbol name="xmark.circle.fill" size={60} color="#FF3B30" />
          <ThemedText style={styles.overlayText}>REJECT</ThemedText>
        </Animated.View>

        <Animated.View style={[styles.overlay, styles.skipOverlay, skipOverlayStyle]}>
          <IconSymbol name="arrow.up.circle.fill" size={60} color="#8E8E93" />
          <ThemedText style={styles.overlayText}>SKIP</ThemedText>
        </Animated.View>

        {/* Card content */}
        <View style={styles.cardContent}>
          {/* Header with user info */}
          <View style={styles.header}>
            <View style={[styles.avatar, { backgroundColor: colors.tint }]}>
              <ThemedText style={styles.avatarText}>
                {pr.username.charAt(0).toUpperCase()}
              </ThemedText>
            </View>
            <View style={styles.headerInfo}>
              <ThemedText style={[styles.username, { color: colors.text }]}>{pr.username}</ThemedText>
              <ThemedText style={[styles.timestamp, { color: colors.textSecondary }]}>
                {getTimeSince(pr.submittedAt)}
              </ThemedText>
            </View>
            <View style={styles.votesNeeded}>
              <ThemedText style={[styles.votesText, { color: colors.tint }]}>
                {pr.votes.length}/{pr.votesNeeded}
              </ThemedText>
              <ThemedText style={[styles.votesLabel, { color: colors.textSecondary }]}>votes</ThemedText>
            </View>
          </View>

          {/* PR Details */}
          <View style={styles.prDetails}>
            <ThemedText style={[styles.exerciseName, { color: colors.text }]}>
              {pr.exerciseName}
            </ThemedText>
            <ThemedText style={[styles.prValue, { color: colors.tint }]}>
              {formatPRDisplay(pr)}
            </ThemedText>
            <View style={[styles.prTypeBadge, { backgroundColor: colors.tint + '20' }]}>
              <ThemedText style={[styles.prTypeText, { color: colors.tint }]}>
                {pr.prType.toUpperCase()} PR
              </ThemedText>
            </View>
          </View>

          {/* Proof section */}
          {(pr.photoUrl || pr.videoUrl) && (
            <View style={styles.proofSection}>
              {pr.photoUrl && (
                <Image
                  source={{ uri: pr.photoUrl }}
                  style={styles.proofImage}
                  resizeMode="cover"
                />
              )}
              {pr.videoUrl && (
                <View style={styles.videoPlaceholder}>
                  <IconSymbol name="play.fill" size={40} color="#FFFFFF" />
                  <ThemedText style={styles.videoText}>Video Proof</ThemedText>
                </View>
              )}
            </View>
          )}

          {/* Previous PR comparison */}
          {pr.previousValue && (
            <View style={[styles.comparison, { backgroundColor: colors.groupedBackground }]}>
              <View style={styles.comparisonItem}>
                <ThemedText style={[styles.comparisonLabel, { color: colors.textSecondary }]}>
                  Previous
                </ThemedText>
                <ThemedText style={[styles.comparisonValue, { color: colors.textSecondary }]}>
                  {pr.previousValue} {pr.unit.split(' ')[0]}
                </ThemedText>
              </View>
              <IconSymbol name="arrow.right" size={16} color={colors.textSecondary} />
              <View style={styles.comparisonItem}>
                <ThemedText style={[styles.comparisonLabel, { color: colors.tint }]}>New</ThemedText>
                <ThemedText style={[styles.comparisonValue, { color: colors.tint }]}>
                  {pr.newValue} {pr.unit.split(' ')[0]}
                </ThemedText>
              </View>
              <View style={[styles.improvementBadge, { backgroundColor: '#34C759' }]}>
                <ThemedText style={styles.improvementText}>
                  +{Math.round(((pr.newValue - pr.previousValue) / pr.previousValue) * 100)}%
                </ThemedText>
              </View>
            </View>
          )}

          {/* Swipe hints */}
          <View style={styles.hints}>
            <View style={styles.hint}>
              <IconSymbol name="arrow.left" size={16} color="#FF3B30" />
              <ThemedText style={[styles.hintText, { color: colors.textSecondary }]}>Reject</ThemedText>
            </View>
            <View style={styles.hint}>
              <IconSymbol name="arrow.up" size={16} color="#8E8E93" />
              <ThemedText style={[styles.hintText, { color: colors.textSecondary }]}>Skip</ThemedText>
            </View>
            <View style={styles.hint}>
              <IconSymbol name="arrow.right" size={16} color="#34C759" />
              <ThemedText style={[styles.hintText, { color: colors.textSecondary }]}>Approve</ThemedText>
            </View>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: Radius.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderRadius: Radius.xl,
  },
  approveOverlay: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
  },
  rejectOverlay: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
  },
  skipOverlay: {
    backgroundColor: 'rgba(142, 142, 147, 0.2)',
  },
  overlayText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginTop: Spacing.sm,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cardContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
  },
  votesNeeded: {
    alignItems: 'center',
  },
  votesText: {
    fontSize: 18,
    fontWeight: '700',
  },
  votesLabel: {
    fontSize: 10,
  },
  prDetails: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  exerciseName: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  prValue: {
    fontSize: 48,
    fontWeight: '800',
    marginBottom: Spacing.sm,
  },
  prTypeBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.lg,
  },
  prTypeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  proofSection: {
    height: 160,
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  proofImage: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: Spacing.xs,
  },
  comparison: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  comparisonItem: {
    alignItems: 'center',
  },
  comparisonLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  comparisonValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  improvementBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  improvementText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  hints: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 'auto',
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hintText: {
    fontSize: 12,
  },
});
