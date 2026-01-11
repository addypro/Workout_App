/**
 * Coach Layout
 *
 * Layout for coach-specific screens.
 * Note: Dashboard has moved to /(tabs)/coach.tsx
 * Programs/Program Builder use shared routes at /(tabs)/index and /program/[id]/edit
 *
 * Navigation: All screens in this stack navigate back to /(tabs)/coach
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Platform, Text, TouchableOpacity } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function CoachLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  // Custom back button component that ensures proper navigation
  const BackButton = ({ label = 'Coach' }: { label?: string }) => (
    <TouchableOpacity
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          // Fallback: navigate to coach tab if no history
          router.replace('/(tabs)/coach');
        }
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: Platform.OS === 'ios' ? -8 : 0,
        paddingVertical: 8,
        paddingRight: 16,
      }}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={`Go back to ${label}`}
    >
      <Ionicons
        name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
        size={Platform.OS === 'ios' ? 28 : 24}
        color={colors.tint}
      />
      {Platform.OS === 'ios' && (
        <Text style={{ color: colors.tint, fontSize: 17, marginLeft: -4 }}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );

  // Close button for modals
  const CloseButton = () => (
    <TouchableOpacity
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)/coach');
        }
      }}
      style={{ padding: 8 }}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel="Close"
    >
      <Ionicons name="close" size={24} color={colors.text} />
    </TouchableOpacity>
  );

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
          headerLeft: () => <BackButton label="Coach" />,
        }}
      />

      {/* Single athlete detail view */}
      <Stack.Screen
        name="athlete/[id]"
        options={{
          title: 'Athlete Details',
          headerLeft: () => <BackButton label="Athletes" />,
        }}
      />

      {/* Invite athletes modal */}
      <Stack.Screen
        name="invite"
        options={{
          title: 'Invite Athletes',
          presentation: 'modal',
          animation: 'slide_from_bottom',
          headerLeft: () => <CloseButton />,
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
          headerLeft: () => <CloseButton />,
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
          headerLeft: () => <CloseButton />,
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
          headerLeft: () => <CloseButton />,
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
    </Stack>
  );
}
