/**
 * Settings Screen (Wrapper)
 *
 * Keeps /settings as a stable route while reusing the unified settings content.
 */

import { Stack } from 'expo-router';
import React from 'react';

import { SettingsContent } from '@/components/settings';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Settings',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.groupedBackground },
        }}
      />
      <SettingsContent />
    </>
  );
}
