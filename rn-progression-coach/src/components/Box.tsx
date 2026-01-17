import React from 'react';
import { View, ViewProps } from 'react-native';

export function Box(props: ViewProps & { p?: number; m?: number; bg?: string; r?: number }) {
  const { p, m, bg, r, style, ...rest } = props;
  return (
    <View
      style={[
        {
          padding: p ?? 0,
          margin: m ?? 0,
          backgroundColor: bg,
          borderRadius: r ?? 0,
        },
        style,
      ]}
      {...rest}
    />
  );
}
