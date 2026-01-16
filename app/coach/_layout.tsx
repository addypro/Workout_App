/**
 * Coach Layout
 *
 * Layout for coach-specific screens.
 * Note: Dashboard has moved to /(tabs)/coach.tsx
 * Programs/Program Builder use shared routes at /(tabs)/index and /program/[id]/edit
 *
 * Navigation: All screens in this stack navigate back to /(tabs)/coach
 */

import { Stack } from 'expo-router';

import { BackButton, CloseButton } from '@/components/navigation/back-button';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const COACH_FALLBACK = '/(tabs)/coach';

export default function CoachLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.tint,
        headerTitleStyle: {
          color: colors.text,
          fontWeight: '600',
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
        headerBackVisible: false, // We use custom back buttons
        gestureEnabled: true,
        animation: 'ios_from_right',
      }}
    >
      {/* First-time coach onboarding */}
      <Stack.Screen
        name="onboarding"
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
          gestureEnabled: false,
        }}
      />

      {/* Index redirects to tabs - hide it */}
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />

      {/* Manage athletes */}
      <Stack.Screen
        name="athletes"
        options={{
          title: 'My Athletes',
          headerLeft: () => <BackButton label="Coach" fallbackRoute={COACH_FALLBACK} />,
        }}
      />

      {/* Single athlete detail view */}
      <Stack.Screen
        name="athlete/[id]"
        options={{
          title: 'Athlete Details',
          headerLeft: () => <BackButton label="Athletes" fallbackRoute={COACH_FALLBACK} />,
        }}
      />

      {/* Invite athletes modal */}
      <Stack.Screen
        name="invite"
        options={{
          title: 'Invite Athletes',
          presentation: 'modal',
          animation: 'slide_from_bottom',
          headerLeft: () => <CloseButton fallbackRoute={COACH_FALLBACK} />,
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />

      {/* Assign program modal */}
      <Stack.Screen
        name="assign-program"
        options={{
          title: 'Assign Program',
          presentation: 'modal',
          animation: 'slide_from_bottom',
          headerLeft: () => <CloseButton fallbackRoute={COACH_FALLBACK} />,
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />

      {/* Programs sub-stack */}
      <Stack.Screen
        name="programs"
        options={{
          headerShown: false,
        }}
      />

      {/* Quick workout creation */}
      <Stack.Screen
        name="quick-workout"
        options={{
          title: 'Quick Workout',
          presentation: 'modal',
          animation: 'slide_from_bottom',
          headerLeft: () => <CloseButton fallbackRoute={COACH_FALLBACK} />,
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />

      {/* Assign single workout */}
      <Stack.Screen
        name="assign-workout"
        options={{
          title: 'Assign Workout',
          presentation: 'modal',
          animation: 'slide_from_bottom',
          headerLeft: () => <CloseButton fallbackRoute={COACH_FALLBACK} />,
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
    </Stack>
  );
}
