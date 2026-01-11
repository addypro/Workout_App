import { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, TextStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function SectionTitle({
  children,
  style,
}: PropsWithChildren<{
  style?: StyleProp<TextStyle>;
}>) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <ThemedText style={[styles.title, { color: colors.textSecondary + 'CC' }, style]}>
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});


