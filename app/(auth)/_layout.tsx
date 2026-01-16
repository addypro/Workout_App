/**
 * Auth Stack Layout
 *
 * Provides navigation structure for authentication screens.
 * Landing page is the entry point for new users.
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Stack } from 'expo-router';

// Force landing as the initial route for the auth group
export const unstable_settings = {
  initialRouteName: 'landing',
};

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
      <Stack.Screen name="index" />
      <Stack.Screen
        name="landing"
        options={{
          animation: 'fade',
          gestureEnabled: false,
        }}
      />
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
      <Stack.Screen
        name="select-role"
        options={{
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="privacy-policy"
        options={{
          presentation: 'modal',
        }}
      />
    </Stack>
  );
}
