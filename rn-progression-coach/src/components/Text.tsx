import React from 'react';
import { Text as RNText, TextProps } from 'react-native';

export function Text(props: TextProps & { c?: string; s?: number; w?: '400' | '500' | '600' | '700' }) {
  const { c = '#fff', s = 16, w = '400', style, ...rest } = props;
  return <RNText style={[{ color: c, fontSize: s, fontWeight: w }, style]} {...rest} />;
}
