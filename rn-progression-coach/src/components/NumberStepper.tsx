import React from 'react';
import { View, Pressable } from 'react-native';
import { Text } from './Text';

export function NumberStepper(props: {
  value: number;
  onChange: (n: number) => void;
  step: number;
  min?: number;
  max?: number;
  precision?: number;
}) {
  const { value, onChange, step, min = -Infinity, max = Infinity, precision = 2 } = props;

  const dec = () => onChange(Math.max(min, Number((value - step).toFixed(precision))));
  const inc = () => onChange(Math.min(max, Number((value + step).toFixed(precision))));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable onPress={dec} style={{ padding: 10, borderRadius: 10, backgroundColor: '#30363d' }}>
        <Text w="700">−</Text>
      </Pressable>
      <Text w="700">{value}</Text>
      <Pressable onPress={inc} style={{ padding: 10, borderRadius: 10, backgroundColor: '#30363d' }}>
        <Text w="700">+</Text>
      </Pressable>
    </View>
  );
}
