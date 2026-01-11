/**
 * Bottom Action Bar Component
 *
 * Thumb-first ergonomic layout for primary actions.
 * Places CTAs in the natural thumb reach zone at the bottom of the screen.
 *
 * Mobile-first: Designed for one-handed operation.
 */

import React from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withTiming,
  interpolate,
  FadeInDown,
  FadeOutDown,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// ============================================================================
// TYPES
// ============================================================================

interface ActionButton {
  label: string;
  onPress: () => void;
  icon?: IconSymbolName;
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
}

interface BottomActionBarProps {
  /** Primary action (appears on the right, more prominent) */
  primaryAction?: ActionButton;
  /** Secondary action (appears on the left, less prominent) */
  secondaryAction?: ActionButton;
  /** Optional center content (e.g., counter, info) */
  centerContent?: React.ReactNode;
  /** Whether to show glassmorphic background */
  blurred?: boolean;
  /** Safe area padding (default: true on iOS) */
  safeArea?: boolean;
  /** Whether the bar is visible */
  visible?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SPRING_CONFIG = { damping: 18, stiffness: 200 };
const SAFE_AREA_BOTTOM = Platform.OS === 'ios' ? 34 : 16;

// ============================================================================
// COMPONENT
// ============================================================================

export function BottomActionBar({
  primaryAction,
  secondaryAction,
  centerContent,
  blurred = true,
  safeArea = Platform.OS === 'ios',
  visible = true,
}: BottomActionBarProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  if (!visible) return null;

  const renderButton = (action: ActionButton, isPrimary: boolean) => {
    const variant = action.variant || (isPrimary ? 'primary' : 'secondary');
    const isDestructive = variant === 'destructive';
    const isGhost = variant === 'ghost';

    const getBackgroundColor = () => {
      if (action.disabled) return colors.separator;
      if (isDestructive) return '#FF3B30';
      if (isPrimary) return colors.tint;
      if (isGhost) return 'transparent';
      return colors.elevated;
    };

    const getTextColor = () => {
      if (action.disabled) return colors.textTertiary;
      if (isPrimary || isDestructive) return '#fff';
      if (isGhost) return colors.tint;
      return colors.text;
    };

    const handlePress = () => {
      if (action.disabled || action.loading) return;
      Haptics.impactAsync(
        isPrimary
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light
      );
      action.onPress();
    };

    return (
      <Pressable
        onPress={handlePress}
        disabled={action.disabled || action.loading}
        style={({ pressed }) => [
          styles.button,
          isPrimary ? styles.primaryButton : styles.secondaryButton,
          {
            backgroundColor: getBackgroundColor(),
            borderColor: isGhost ? colors.separator : 'transparent',
            borderWidth: isGhost ? 1 : 0,
            opacity: pressed && !action.disabled ? 0.85 : 1,
            transform: [{ scale: pressed && !action.disabled ? 0.98 : 1 }],
          },
        ]}
      >
        {action.loading ? (
          <ActivityIndicator
            size="small"
            color={isPrimary ? '#fff' : colors.tint}
          />
        ) : (
          <>
            {action.icon && (
              <IconSymbol
                name={action.icon}
                size={18}
                color={getTextColor()}
              />
            )}
            <ThemedText
              style={[
                styles.buttonText,
                isPrimary && styles.primaryButtonText,
                { color: getTextColor() },
              ]}
            >
              {action.label}
            </ThemedText>
          </>
        )}
      </Pressable>
    );
  };

  const content = (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(150)}
      style={[
        styles.container,
        {
          paddingBottom: safeArea ? SAFE_AREA_BOTTOM : Spacing.md,
          backgroundColor: blurred ? 'transparent' : colors.card,
          borderTopColor: colors.separator,
        },
      ]}
    >
      <View style={styles.content}>
        {/* Secondary Action (Left) */}
        <View style={styles.leftSection}>
          {secondaryAction && renderButton(secondaryAction, false)}
        </View>

        {/* Center Content */}
        {centerContent && (
          <View style={styles.centerSection}>{centerContent}</View>
        )}

        {/* Primary Action (Right) */}
        <View style={styles.rightSection}>
          {primaryAction && renderButton(primaryAction, true)}
        </View>
      </View>
    </Animated.View>
  );

  if (blurred) {
    return (
      <View style={styles.wrapper}>
        <BlurView
          intensity={80}
          tint={colorScheme === 'dark' ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        {content}
      </View>
    );
  }

  return <View style={styles.wrapper}>{content}</View>;
}

// ============================================================================
// SPECIALIZED VARIANTS
// ============================================================================

/**
 * Workout Action Bar - Specialized for workout screens
 */
export function WorkoutActionBar({
  onComplete,
  onSkip,
  onAddSet,
  setsCompleted,
  totalSets,
  isLastSet,
}: {
  onComplete: () => void;
  onSkip?: () => void;
  onAddSet?: () => void;
  setsCompleted: number;
  totalSets: number;
  isLastSet?: boolean;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <BottomActionBar
      secondaryAction={
        onSkip
          ? {
              label: 'Skip',
              onPress: onSkip,
              variant: 'ghost',
            }
          : undefined
      }
      centerContent={
        <View style={styles.setsCounter}>
          <ThemedText style={[styles.setsCounterText, { color: colors.textSecondary }]}>
            {setsCompleted}/{totalSets}
          </ThemedText>
          <ThemedText style={[styles.setsLabel, { color: colors.textTertiary }]}>
            sets
          </ThemedText>
        </View>
      }
      primaryAction={{
        label: isLastSet ? 'Finish' : 'Complete Set',
        onPress: onComplete,
        icon: isLastSet ? 'checkmark.circle.fill' : 'checkmark',
        variant: 'primary',
      }}
    />
  );
}

/**
 * Form Action Bar - For forms with save/cancel
 */
export function FormActionBar({
  onSave,
  onCancel,
  saveLabel = 'Save',
  cancelLabel = 'Cancel',
  saveDisabled = false,
  saveLoading = false,
}: {
  onSave: () => void;
  onCancel: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  saveDisabled?: boolean;
  saveLoading?: boolean;
}) {
  return (
    <BottomActionBar
      secondaryAction={{
        label: cancelLabel,
        onPress: onCancel,
        variant: 'ghost',
      }}
      primaryAction={{
        label: saveLabel,
        onPress: onSave,
        disabled: saveDisabled,
        loading: saveLoading,
      }}
    />
  );
}

/**
 * Selection Action Bar - For multi-select operations
 */
export function SelectionActionBar({
  selectedCount,
  onAction,
  onClear,
  actionLabel = 'Add',
  actionIcon,
}: {
  selectedCount: number;
  onAction: () => void;
  onClear: () => void;
  actionLabel?: string;
  actionIcon?: IconSymbolName;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <BottomActionBar
      secondaryAction={{
        label: 'Clear',
        onPress: onClear,
        variant: 'ghost',
      }}
      centerContent={
        <View style={styles.selectionCounter}>
          <ThemedText style={[styles.selectionCountText, { color: colors.tint }]}>
            {selectedCount}
          </ThemedText>
          <ThemedText style={[styles.selectionLabel, { color: colors.textSecondary }]}>
            selected
          </ThemedText>
        </View>
      }
      primaryAction={{
        label: actionLabel,
        onPress: onAction,
        icon: actionIcon,
        disabled: selectedCount === 0,
      }}
    />
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  leftSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  centerSection: {
    alignItems: 'center',
  },
  rightSection: {
    flex: 1,
    alignItems: 'flex-end',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderRadius: Radius.md,
    minWidth: 100,
  },
  primaryButton: {
    minWidth: 140,
    ...Shadows.sm,
  },
  secondaryButton: {
    minWidth: 80,
  },
  buttonText: {
    ...Typography.subhead,
    fontWeight: '600',
  },
  primaryButtonText: {
    fontWeight: '700',
  },
  setsCounter: {
    alignItems: 'center',
  },
  setsCounterText: {
    ...Typography.title2,
    fontWeight: '700',
  },
  setsLabel: {
    ...Typography.caption2,
  },
  selectionCounter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  selectionCountText: {
    ...Typography.title2,
    fontWeight: '700',
  },
  selectionLabel: {
    ...Typography.caption1,
  },
});
