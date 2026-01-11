/**
 * Breadcrumb Navigation Component
 *
 * Shows navigation path with quick back-jump capability.
 * Helps users understand their location in the app hierarchy.
 *
 * Mobile-first: Compact, scrollable, thumb-accessible.
 */

import React, { useCallback, useRef } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useBreadcrumbs } from '@/lib/utils/navigation';

// ============================================================================
// TYPES
// ============================================================================

export interface BreadcrumbItem {
  label: string;
  path: string;
  icon?: string;
}

interface BreadcrumbNavProps {
  /** Custom breadcrumb items (overrides auto-generated) */
  items?: BreadcrumbItem[];
  /** Maximum items to show before collapsing */
  maxItems?: number;
  /** Whether to show the home icon */
  showHomeIcon?: boolean;
  /** Called when a breadcrumb is pressed */
  onNavigate?: (path: string, index: number) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BreadcrumbNav({
  items: customItems,
  maxItems = 4,
  showHomeIcon = true,
  onNavigate,
}: BreadcrumbNavProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const scrollRef = useRef<ScrollView>(null);

  const { breadcrumbs: autoBreadcrumbs, navigateToCrumb } = useBreadcrumbs();
  const items = customItems || autoBreadcrumbs;

  // Don't render if only one item
  if (items.length <= 1) return null;

  // Collapse items if too many
  const displayItems = items.length > maxItems
    ? [
        items[0],
        { label: '...', path: '' },
        ...items.slice(-2),
      ]
    : items;

  const handlePress = useCallback(
    (item: BreadcrumbItem, index: number) => {
      if (item.path === '' || index === displayItems.length - 1) return;

      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      if (onNavigate) {
        onNavigate(item.path, index);
      } else if (customItems) {
        router.push(item.path as any);
      } else {
        navigateToCrumb(index);
      }
    },
    [displayItems, onNavigate, customItems, navigateToCrumb]
  );

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={[styles.container, { backgroundColor: colors.groupedBackground }]}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={() => {
          scrollRef.current?.scrollToEnd({ animated: false });
        }}
      >
        {displayItems.map((item, index) => {
          const isLast = index === displayItems.length - 1;
          const isCollapsed = item.label === '...';
          const isFirst = index === 0;

          return (
            <View key={`${item.path}-${index}`} style={styles.itemContainer}>
              {/* Separator */}
              {index > 0 && (
                <IconSymbol
                  name="chevron.right"
                  size={10}
                  color={colors.textTertiary}
                  style={styles.separator}
                />
              )}

              {/* Breadcrumb Item */}
              <Pressable
                onPress={() => handlePress(item, index)}
                disabled={isLast || isCollapsed}
                style={({ pressed }) => [
                  styles.item,
                  isLast && styles.itemCurrent,
                  {
                    backgroundColor: isLast ? colors.tintMuted : 'transparent',
                    opacity: pressed && !isLast ? 0.6 : 1,
                  },
                ]}
              >
                {/* Home icon for first item */}
                {isFirst && showHomeIcon && (
                  <IconSymbol
                    name="house.fill"
                    size={12}
                    color={isLast ? colors.tint : colors.textSecondary}
                    style={styles.homeIcon}
                  />
                )}

                {/* Label */}
                <ThemedText
                  style={[
                    styles.label,
                    isLast && styles.labelCurrent,
                    {
                      color: isLast ? colors.tint : colors.textSecondary,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </ThemedText>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}

// ============================================================================
// COMPACT VARIANT
// ============================================================================

/**
 * Compact breadcrumb showing only back button and current location
 */
export function CompactBreadcrumb({
  backLabel,
  currentLabel,
  onBack,
}: {
  backLabel?: string;
  currentLabel: string;
  onBack?: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleBack = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    }
  }, [onBack]);

  return (
    <View style={[styles.compactContainer, { borderBottomColor: colors.separator }]}>
      {/* Back button */}
      <Pressable
        onPress={handleBack}
        style={({ pressed }) => [
          styles.backButton,
          { opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <IconSymbol name="chevron.left" size={16} color={colors.tint} />
        {backLabel && (
          <ThemedText style={[styles.backLabel, { color: colors.tint }]}>
            {backLabel}
          </ThemedText>
        )}
      </Pressable>

      {/* Current location */}
      <ThemedText
        style={[styles.currentLabel, { color: colors.text }]}
        numberOfLines={1}
      >
        {currentLabel}
      </ThemedText>

      {/* Spacer for centering */}
      <View style={styles.spacer} />
    </View>
  );
}

// ============================================================================
// CONTEXT PILL VARIANT
// ============================================================================

/**
 * Context pill showing active filters/context
 */
export function ContextPills({
  pills,
  onRemove,
  onClearAll,
}: {
  pills: { key: string; label: string; value: string }[];
  onRemove?: (key: string) => void;
  onClearAll?: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  if (pills.length === 0) return null;

  const handleRemove = useCallback(
    (key: string) => {
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onRemove?.(key);
    },
    [onRemove]
  );

  return (
    <View style={[styles.pillsContainer, { borderBottomColor: colors.separator }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillsScroll}
      >
        {/* Context label */}
        <ThemedText style={[styles.contextLabel, { color: colors.textTertiary }]}>
          Context:
        </ThemedText>

        {/* Pills */}
        {pills.map((pill) => (
          <Pressable
            key={pill.key}
            onPress={() => handleRemove(pill.key)}
            style={({ pressed }) => [
              styles.pill,
              {
                backgroundColor: colors.tintMuted,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <ThemedText style={[styles.pillText, { color: colors.tint }]}>
              {pill.value}
            </ThemedText>
            {onRemove && (
              <IconSymbol name="xmark" size={10} color={colors.tint} />
            )}
          </Pressable>
        ))}

        {/* Clear all button */}
        {onClearAll && pills.length > 1 && (
          <Pressable
            onPress={onClearAll}
            style={({ pressed }) => [
              styles.clearButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <ThemedText style={[styles.clearText, { color: colors.textSecondary }]}>
              Clear
            </ThemedText>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  separator: {
    marginHorizontal: 6,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.xs,
  },
  itemCurrent: {
    paddingHorizontal: 10,
  },
  homeIcon: {
    marginRight: 4,
  },
  label: {
    ...Typography.caption1,
    maxWidth: 120,
  },
  labelCurrent: {
    fontWeight: '600',
  },

  // Compact variant
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 60,
  },
  backLabel: {
    ...Typography.body,
  },
  currentLabel: {
    ...Typography.headline,
    flex: 1,
    textAlign: 'center',
  },
  spacer: {
    minWidth: 60,
  },

  // Context pills
  pillsContainer: {
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pillsScroll: {
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  contextLabel: {
    ...Typography.caption2,
    marginRight: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  pillText: {
    ...Typography.caption2,
    fontWeight: '600',
  },
  clearButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearText: {
    ...Typography.caption2,
  },
});
