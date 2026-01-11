/**
 * Auth Stack Layout
 *
 * Provides navigation structure for authentication screens.
 * Modal-style presentation for login flow.
 */

import { Stack } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

export default function AuthLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_bottom',
      }}
    >
      <Stack.Screen
        name="login"
        options={{
          presentation: 'modal',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="callback"
        options={{
          presentation: 'modal',
          gestureEnabled: false,
        }}
      />
    </Stack>
  );
}
