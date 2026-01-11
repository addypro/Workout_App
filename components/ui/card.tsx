import { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type CardVariant = 'card' | 'elevated';

export function Card({
  children,
  style,
  variant = 'card',
  padding = 'md',
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  variant?: CardVariant;
  padding?: 'sm' | 'md';
}>) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <ThemedView
      style={[
        styles.base,
        {
          backgroundColor: variant === 'elevated' ? colors.elevated : colors.card,
          borderColor: colors.separator,
          padding: padding === 'sm' ? Spacing.sm : Spacing.md,
        },
        style,
      ]}
    >
      {children}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
});


