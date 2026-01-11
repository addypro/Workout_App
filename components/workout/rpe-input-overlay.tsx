/**
 * RPE Input Overlay
 *
 * Contextual overlay that appears after completing a working set.
 * Based on "The Invisible Spotter" framework - appears only when relevant
 * and uses a radial selector with haptic feedback for quick, intuitive input.
 */
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInUp, SlideOutDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Shadows, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// RPE descriptors for quick understanding
const RPE_LABELS: Record<number, { label: string; color: string }> = {
  6: { label: 'Easy', color: '#4CD964' },
  7: { label: 'Moderate', color: '#5AC8FA' },
  8: { label: 'Challenging', color: '#FFCC00' },
  9: { label: 'Hard', color: '#FF9500' },
  10: { label: 'Max Effort', color: '#FF3B30' },
};

interface RPEInputOverlayProps {
  visible: boolean;
  onSelect: (rpe: number | null) => void;
  onSkip: () => void;
  setType?: 'warmup' | 'working' | 'top' | 'drop' | 'failure';
}

export function RPEInputOverlay({ visible, onSelect, onSkip, setType }: RPEInputOverlayProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleRPESelect = useCallback((rpe: number) => {
    // Haptic intensity increases with RPE
    if (rpe >= 9) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else if (rpe >= 7) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSelect(rpe);
  }, [onSelect]);

  // Only show for working, top, or failure sets
  const shouldShow = visible && setType !== 'warmup' && setType !== 'drop';

  if (!shouldShow) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
    >
      <Animated.View
        entering={SlideInUp.duration(200)}
        exiting={SlideOutDown.duration(150)}
        style={[styles.container, { backgroundColor: colors.card, ...Shadows.lg }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <ThemedText style={[styles.title, { color: colors.text }]}>
              How hard was that?
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
              Rate your perceived exertion
            </ThemedText>
          </View>
          <Pressable style={styles.skipButton} onPress={onSkip}>
            <ThemedText style={[styles.skipText, { color: colors.textTertiary }]}>Skip</ThemedText>
          </Pressable>
        </View>

        {/* RPE Selector Grid */}
        <View style={styles.rpeGrid}>
          {[6, 7, 8, 9, 10].map((rpe) => {
            const { label, color } = RPE_LABELS[rpe];
            return (
              <Pressable
                key={rpe}
                style={({ pressed }) => [
                  styles.rpeButton,
                  {
                    backgroundColor: color + '15',
                    borderColor: color,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  },
                ]}
                onPress={() => handleRPESelect(rpe)}
              >
                <ThemedText style={[styles.rpeNumber, { color }]}>{rpe}</ThemedText>
                <ThemedText style={[styles.rpeLabel, { color: colors.textSecondary }]}>
                  {label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Pressable
            style={[styles.quickAction, { backgroundColor: colors.tint }]}
            onPress={() => handleRPESelect(10)}
          >
            <IconSymbol name="flame.fill" size={16} color="#fff" />
            <ThemedText style={styles.quickActionText}>Pushed to Failure</ThemedText>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  container: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  skipButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
  },
  rpeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  rpeButton: {
    width: 64,
    height: 72,
    borderRadius: Radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  rpeNumber: {
    fontSize: 24,
    fontWeight: '800',
  },
  rpeLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.lg,
  },
  quickActionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
