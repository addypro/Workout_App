// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'chevron.up': 'expand-less',
  'chevron.down': 'expand-more',
  'list.bullet': 'format-list-bulleted',
  'checkmark.circle.fill': 'check-circle',
  'checkmark.circle': 'check-circle-outline',
  'checkmark': 'check',
  'square.grid.2x2': 'grid-view',
  'wrench.and.screwdriver': 'build',
  'arrow.up.circle.fill': 'arrow-circle-up',
  'arrow.up.circle': 'arrow-circle-up',
  'arrow.down.circle': 'arrow-circle-down',
  'plus.circle.fill': 'add-circle',
  'play.fill': 'play-arrow',
  'pause.fill': 'pause',
  'stop.fill': 'stop',
  'forward.fill': 'fast-forward',
  'xmark': 'close',
  'xmark.circle.fill': 'cancel',
  'timer': 'timer',
  'flame.fill': 'whatshot',
  'figure.run': 'directions-run',
  'chart.bar.fill': 'bar-chart',
  'scalemass': 'scale',
  'calendar': 'calendar-today',
  'dumbbell': 'fitness-center',
  'figure.strengthtraining.traditional': 'fitness-center',
  'magnifyingglass': 'search',
  'slider.horizontal.3': 'tune',
  'exclamationmark.triangle': 'warning',
  'pencil': 'edit',
  'trash': 'delete',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
