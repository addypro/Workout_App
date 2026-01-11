import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/lib/context/auth-context';
import { SyncProvider } from '@/lib/context/sync-context';
import { AppThemeProvider } from '@/lib/context/theme-context';
import { TabContextProvider } from '@/lib/context/tab-context';
import { PreferencesProvider } from '@/lib/context/preferences-context';
import { ProgramImportProvider } from '@/lib/context/program-import-context';

export const unstable_settings = {
  anchor: '(tabs)',
  // Ensure cold-start always lands on the tab navigator (Expo Go can restore the last route).
  initialRouteName: '(tabs)',
};

// Fast transition config for snappy navigation
const FAST_ANIMATION_DURATION = 200;

/**
 * Navigation guard for role selection
 * Redirects new users to role selection after sign-in
 */
function NavigationGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading, needsRoleSelection, isCoach } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inCoachGroup = segments[0] === 'coach' as any;

    // If user just signed in and needs role selection
    if (user && needsRoleSelection && !inAuthGroup) {
      router.replace('/(auth)/select-role' as any);
      return;
    }

    // If coach is trying to access regular tabs, redirect to coach dashboard
    // (optional - remove if you want coaches to access athlete features too)
    // if (user && isCoach && !inCoachGroup && !inAuthGroup && segments[0] === '(tabs)') {
    //   router.replace('/coach/dashboard' as any);
    // }
  }, [user, isLoading, needsRoleSelection, isCoach, segments]);

  return <>{children}</>;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <AppThemeProvider colorScheme={colorScheme}>
      <TabContextProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <NavigationGuard>
            <Stack
              screenOptions={{
                // Fast iOS-native slide transitions
                animation: 'ios_from_right',
                gestureEnabled: true,
                animationDuration: FAST_ANIMATION_DURATION,
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false, presentation: 'modal' }} />
              <Stack.Screen name="coach" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              {/* Workout screens - optimized for fast entry */}
              <Stack.Screen
                name="workout/quick"
                options={{
                  animation: 'fade_from_bottom',
                  animationDuration: 150,
                }}
              />
              <Stack.Screen
                name="workout/[id]"
                options={{
                  animation: 'ios_from_right',
                  animationDuration: FAST_ANIMATION_DURATION,
                  gestureEnabled: false, // Prevent accidental back during workout
                }}
              />
              <Stack.Screen
                name="exercise-picker"
                options={{
                  animation: 'fade_from_bottom',
                  animationDuration: 150,
                }}
              />
            </Stack>
          </NavigationGuard>
          <StatusBar style="auto" />
        </ThemeProvider>
      </TabContextProvider>
    </AppThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <SyncProvider>
          <PreferencesProvider>
            <ProgramImportProvider>
              <RootLayoutNav />
            </ProgramImportProvider>
          </PreferencesProvider>
        </SyncProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
