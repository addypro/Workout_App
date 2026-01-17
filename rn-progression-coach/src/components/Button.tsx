import React from 'react';
import { Pressable, PressableProps } from 'react-native';
import { Text } from './Text';

export function Button(
  props: PressableProps & { title: string; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean }
) {
  const { title, variant = 'primary', disabled, style, ...rest } = props;

  const bg =
    variant === 'primary' ? '#1f6feb' :
    variant === 'secondary' ? '#30363d' :
    '#da3633';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        {
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 12,
          backgroundColor: bg,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
      {...rest}
    >
      <Text w="600" s={16}>
        {title}
      </Text>
    </Pressable>
  );
}
