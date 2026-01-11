/**
 * Platform-Aware Icon System
 *
 * Uses SF Symbols on iOS and Material Icons on Android/Web.
 * Ensures native look and feel on each platform.
 *
 * Usage:
 * <IconSymbol name="house.fill" size={24} color={colors.tint} />
 */

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle, Platform } from 'react-native';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];
type IoniconName = ComponentProps<typeof Ionicons>['name'];

// Comprehensive SF Symbol to Material/Ionicon mapping
const MAPPING = {
  // Navigation
  'house.fill': 'home',
  'house': 'home-outline',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'chevron.up': 'expand-less',
  'chevron.down': 'expand-more',
  'arrow.left': 'arrow-back',
  'arrow.right': 'arrow-forward',
  'arrow.up': 'arrow-upward',
  'arrow.down': 'arrow-downward',

  // Actions
  'plus': 'add',
  'plus.circle': 'add-circle-outline',
  'plus.circle.fill': 'add-circle',
  'minus': 'remove',
  'minus.circle': 'remove-circle-outline',
  'minus.circle.fill': 'remove-circle',
  'xmark': 'close',
  'xmark.circle': 'cancel',
  'xmark.circle.fill': 'cancel',
  'checkmark': 'check',
  'checkmark.circle': 'check-circle-outline',
  'checkmark.circle.fill': 'check-circle',
  'pencil': 'edit',
  'pencil.circle.fill': 'edit',
  'trash': 'delete-outline',
  'trash.fill': 'delete',

  // Media
  'play.fill': 'play-arrow',
  'pause.fill': 'pause',
  'stop.fill': 'stop',
  'forward.fill': 'fast-forward',
  'backward.fill': 'fast-rewind',

  // Voice & Audio
  'mic.fill': 'mic',
  'mic': 'mic-none',
  'mic.slash': 'mic-off',
  'waveform': 'graphic-eq',
  'waveform.circle': 'graphic-eq',

  // Communication
  'paperplane.fill': 'send',
  'bell.fill': 'notifications',
  'bell': 'notifications-none',
  'text.bubble': 'chat-bubble-outline',
  'text.bubble.fill': 'chat-bubble',

  // Search & Filter
  'magnifyingglass': 'search',
  'line.3.horizontal.decrease': 'filter-list',
  'slider.horizontal.3': 'tune',
  'square.grid.2x2': 'grid-view',
  'list.bullet': 'format-list-bulleted',

  // Workout & Fitness
  'figure.strengthtraining.traditional': 'fitness-center',
  'figure.strengthtraining': 'fitness-center',
  'dumbbell': 'fitness-center',
  'dumbbell.fill': 'fitness-center',
  'figure.run': 'directions-run',
  'figure.walk': 'directions-walk',
  'timer': 'timer',
  'stopwatch': 'timer',
  'flame.fill': 'whatshot',
  'bolt.fill': 'flash-on',
  'bolt': 'flash-on',
  'scalemass': 'scale',
  'scalemass.fill': 'scale',

  // Time & Calendar
  'clock': 'access-time',
  'clock.fill': 'schedule',
  'clock.arrow.circlepath': 'history',
  'calendar': 'calendar-today',
  'calendar.badge.plus': 'event',

  // Status & Info
  'info.circle': 'info-outline',
  'info.circle.fill': 'info',
  'exclamationmark.triangle': 'warning',
  'exclamationmark.triangle.fill': 'warning',
  'exclamationmark.circle': 'error-outline',
  'exclamationmark.circle.fill': 'error',
  'questionmark.circle': 'help-outline',
  'questionmark.circle.fill': 'help',

  // UI Elements
  'ellipsis': 'more-horiz',
  'ellipsis.circle': 'more-horiz',
  'ellipsis.circle.fill': 'more-horiz',
  'gear': 'settings',
  'gearshape': 'settings',
  'gearshape.fill': 'settings',
  'wrench.and.screwdriver': 'build',
  'person.fill': 'person',
  'person': 'person-outline',
  'person.circle': 'account-circle',
  'person.circle.fill': 'account-circle',
  'person.badge.shield.checkmark.fill': 'verified-user',
  'person.badge.shield.checkmark': 'verified-user',

  // Charts & Data
  'chart.bar.fill': 'bar-chart',
  'chart.line.uptrend.xyaxis': 'trending-up',
  'arrow.up.circle.fill': 'arrow-circle-up',
  'arrow.up.circle': 'arrow-circle-up',
  'arrow.down.circle': 'arrow-circle-down',
  'arrow.triangle.2.circlepath': 'sync',
  'arrow.turn.down.right': 'subdirectory-arrow-right',

  // Misc
  'chevron.left.forwardslash.chevron.right': 'code',
  'sparkles': 'auto-awesome',
  'star.fill': 'star',
  'star': 'star-outline',
  'heart.fill': 'favorite',
  'heart': 'favorite-border',
  'leaf.fill': 'eco',
  'eye.fill': 'visibility',
  'eye': 'visibility',
  'gamecontroller.fill': 'sports-esports',
  'link': 'link',
  'arrow.triangle.branch': 'call-split',

  // Documents & Files
  'doc.badge.plus': 'note-add',
  'doc.text.magnifyingglass': 'find-in-page',
  'square.and.arrow.down': 'download',
  'square.and.arrow.up': 'upload',
  'doc.text': 'description',

  // Grid & Layout
  'rectangle.3.group': 'view-module',
  'rectangle.grid.2x2': 'grid-view',

  // Refresh & Sync
  'arrow.counterclockwise': 'refresh',
  'arrow.clockwise': 'refresh',

  // Circle variants (for indicators)
  'circle.fill': 'circle',
  'circle': 'radio-button-unchecked',
} as const;

export type IconSymbolName = keyof typeof MAPPING;

/**
 * Platform-aware icon component
 *
 * Uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const iconName = MAPPING[name];

  if (!iconName) {
    console.warn(`IconSymbol: No mapping found for "${name}"`);
    return <MaterialIcons color={color} size={size} name="help-outline" style={style} />;
  }

  return (
    <MaterialIcons
      color={color}
      size={size}
      name={iconName as MaterialIconName}
      style={style}
    />
  );
}

/**
 * Get the Material Icon name for a given SF Symbol name
 */
export function getMaterialIconName(sfSymbolName: IconSymbolName): MaterialIconName {
  return MAPPING[sfSymbolName] as MaterialIconName;
}

/**
 * Check if an icon name is valid
 */
export function isValidIconName(name: string): name is IconSymbolName {
  return name in MAPPING;
}
