import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useAppReady } from '@/hooks/use-app-ready';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/lib/context/auth-context';
import { PreferencesProvider } from '@/lib/context/preferences-context';
import { ProgramImportProvider } from '@/lib/context/program-import-context';
import { SyncProvider } from '@/lib/context/sync-context';
import { TabContextProvider } from '@/lib/context/tab-context';
import { AppThemeProvider } from '@/lib/context/theme-context';
import { WorkoutMachineProvider } from '@/lib/context/workout-machine-provider';
import { initFeatureFlags } from '@/lib/config/feature-flags';

// Prevent splash from auto-hiding before app is ready
// This MUST be called before any React code runs
// Wrap in try-catch for tunnel/web mode where native splash may not exist
SplashScreen.preventAutoHideAsync().catch(() => {
  // Silently ignore - expected in Expo Go/tunnel mode
});

export const unstable_settings = {
  anchor: '(tabs)',
  // Ensure cold-start always lands on the tab navigator (Expo Go can restore the last route).
  initialRouteName: '(tabs)',
};

// ASTEROID PROOF: Neural Speed transitions (120ms)
const FAST_ANIMATION_DURATION = 120;

// Storage key to track if user has seen landing
const HAS_SEEN_LANDING_KEY = '@has_seen_landing';

/**
 * Navigation guard for first-time users and role selection
 * - First-time users → Landing page
 * - New sign-ins needing role → Role selection
 */
function NavigationGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading, needsRoleSelection, isCoach, isGuest } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [hasSeenLanding, setHasSeenLanding] = useState<boolean | null>(null);

  // Check if user has seen landing on mount
  useEffect(() => {
    const checkLandingState = async () => {
      const value = await AsyncStorage.getItem(HAS_SEEN_LANDING_KEY);
      console.log('[NavigationGuard] hasSeenLanding from storage:', value);
      setHasSeenLanding(value === 'true');
    };
    checkLandingState();
  }, []);

  useEffect(() => {
    // Debug logging
    console.log('[NavigationGuard] State:', {
      isLoading,
      hasSeenLanding,
      isGuest,
      user: !!user,
      segments: segments.join('/'),
    });

    // Wait for both auth and landing check to complete
    if (isLoading || hasSeenLanding === null) {
      console.log('[NavigationGuard] Still loading, skipping redirect');
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';

    // GUEST RESCUE: If user is a guest but stuck in (auth) group, force them to tabs
    // This fixes the "stuck on landing" issue if the button click navigation fails
    if (isGuest && inAuthGroup) {
      console.log('[NavigationGuard] Guest rescue - redirecting to tabs');
      // Use setImmediate to ensure we don't conflict with current render
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 0);
      return;
    }

    // First-time users (not signed in and haven't seen landing) → Landing page
    // Guest users bypass this check since they explicitly chose to continue without account
    if (hasSeenLanding === false && !user && !isGuest && !inAuthGroup) {
      AsyncStorage.getItem(HAS_SEEN_LANDING_KEY).then((value) => {
        if (value === 'true') {
          // Storage was updated, sync state
          console.log('[NavigationGuard] Storage was updated, syncing state');
          setHasSeenLanding(true);
        } else {
          // Actually redirect to landing
          console.log('[NavigationGuard] Redirecting to landing page');
          router.replace('/(auth)/landing' as any);
        }
      });
      return;
    }

    // If user just signed in and needs role selection
    if (user && needsRoleSelection && !inAuthGroup) {
      console.log('[NavigationGuard] Redirecting to role selection');
      router.replace('/(auth)/select-role' as any);
      return;
    }
  }, [user, isLoading, isGuest, needsRoleSelection, isCoach, segments, hasSeenLanding]);

  return <>{children}</>;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();

  // Hide splash screen once app is fully ready and interactive
  useAppReady();

  // Pre-warm data indices in parallel for instant first-button-press
  // STATE-OF-THE-ART PATTERN: Background preloading eliminates first-interaction lag
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      // Dynamic imports to avoid slowing initial bundle parse
      // All preloads run in parallel for maximum speed
      Promise.all([
        // Curated programs preload - extracts 38 programs from Kaggle to SQLite
        // This is the ONE-TIME heavy load that eliminates runtime Kaggle loading
        import('@/lib/services/programs/curated-preloader').then(({ preloadCuratedPrograms }) => {
          preloadCuratedPrograms();
        }),

        // Exercise search index for instant search/filter responses
        import('@/lib/services/exercise/search').then(({ warmSearchIndex }) => {
          warmSearchIndex();
        }),
        // Exercise database for instant exercise lookups
        import('@/lib/services/exercise/database').then(({ preloadExerciseDatabase }) => {
          preloadExerciseDatabase?.();
        }),
      ]).catch(err => {
        console.warn('[Preload] Background preload failed:', err);
      });
    });

    return () => {
      task.cancel();
    };
  }, []);

  useEffect(() => {
    initFeatureFlags(user?.id).catch((error) => {
      console.warn('[FeatureFlags] Init failed:', error);
    });
  }, [user?.id]);

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
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
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
            <WorkoutMachineProvider>
              <ProgramImportProvider>
                <RootLayoutNav />
              </ProgramImportProvider>
            </WorkoutMachineProvider>
          </PreferencesProvider>
        </SyncProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
