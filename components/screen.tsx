import { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ScreenVariant = 'plain' | 'grouped';

export function Screen({
  children,
  style,
  contentStyle,
  edges = ['top', 'left', 'right'],
  variant = 'grouped',
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  /** Applies padding to the inner content area (not the SafeArea itself) */
  contentStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
  variant?: ScreenVariant;
}>) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const backgroundColor =
    variant === 'grouped' ? colors.groupedBackground : colors.background;

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.safeArea, { backgroundColor }, style]}
    >
      <SafeAreaView
        edges={[]}
        style={[styles.content, { backgroundColor }, contentStyle]}
      >
        {children}
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
});


