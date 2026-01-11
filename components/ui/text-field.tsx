import { StyleProp, StyleSheet, TextInput, TextInputProps, TextStyle, ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function TextField({
  label,
  containerStyle,
  inputStyle,
  lightColor,
  darkColor,
  ...props
}: TextInputProps & {
  label?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  lightColor?: string;
  darkColor?: string;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <ThemedView style={[styles.container, containerStyle]}>
      {label ? (
        <ThemedText style={[styles.label, { color: colors.textSecondary + 'CC' }]}>{label}</ThemedText>
      ) : null}
      <TextInput
        {...props}
        placeholderTextColor={props.placeholderTextColor ?? colors.textSecondary + '99'}
        style={[
          styles.input,
          {
            color: colors.text,
            borderColor: colors.separator,
            backgroundColor: colors.elevated,
          },
          inputStyle,
        ]}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
});


