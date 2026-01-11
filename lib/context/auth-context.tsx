/**
 * Authentication Context
 *
 * Provides user authentication state and methods throughout the app.
 * Supports Sign in with Apple (iOS) and email magic links.
 * Handles local data migration on first sign-in.
 *
 * Works in guest mode when Supabase is not configured.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase/client';
import { syncService } from '@/lib/services/sync';
import { getWorkoutHistory } from '@/lib/db/storage';

// Conditionally import Apple Authentication (only available on iOS)
let AppleAuthentication: typeof import('expo-apple-authentication') | null = null;
if (Platform.OS === 'ios') {
  AppleAuthentication = require('expo-apple-authentication');
}

// User role type
export type UserRole = 'athlete' | 'coach' | null;

// Storage keys
const USER_ROLE_KEY = '@user_role';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isGuest: boolean;
  userRole: UserRole;
  needsRoleSelection: boolean;
}

interface AuthContextType extends AuthState {
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
  setUserRole: (role: UserRole) => Promise<void>;
  devModeLogin: (role: UserRole) => Promise<void>;
  isCoach: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isGuest: true,
    userRole: null,
    needsRoleSelection: false,
  });

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    const initAuth = async () => {
      try {
        // Get stored role
        const storedRole = await AsyncStorage.getItem(USER_ROLE_KEY);
        const userRole = storedRole as UserRole;

        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.warn('Auth session error:', error.message);
          setState(prev => ({ ...prev, isLoading: false, userRole }));
          return;
        }

        if (session) {
          // Check if user needs role selection (new user with no role)
          const needsRoleSelection = !userRole;

          setState({
            user: session.user,
            session,
            isLoading: false,
            isGuest: false,
            userRole,
            needsRoleSelection,
          });
          // Migrate local data if needed
          migrateLocalData(session.user.id);
        } else {
          setState(prev => ({ ...prev, isLoading: false, userRole }));
        }

        // Listen for auth changes
        const { data } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (session) {
              // Get stored role again in case it changed
              const currentRole = await AsyncStorage.getItem(USER_ROLE_KEY);
              const role = currentRole as UserRole;
              const needsRole = !role;

              setState({
                user: session.user,
                session,
                isLoading: false,
                isGuest: false,
                userRole: role,
                needsRoleSelection: needsRole,
              });
              if (event === 'SIGNED_IN') {
                await migrateLocalData(session.user.id);
              }
            } else {
              setState(prev => ({
                ...prev,
                user: null,
                session: null,
                isGuest: true,
                needsRoleSelection: false,
              }));
            }
          }
        );
        subscription = data.subscription;
      } catch (error) {
        console.warn('Auth initialization error:', error);
        // Continue in guest mode
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    initAuth();

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  /**
   * Migrate data from 'local' userId to the authenticated user's ID
   * Also syncs existing local workouts to the server
   */
  const migrateLocalData = async (newUserId: string) => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const localKeys = keys.filter(key => key.includes(':local:') || key.includes(':local'));

      for (const key of localKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          // Replace 'local' with the new userId in the key
          const newKey = key.replace(':local:', `:${newUserId}:`).replace(':local', `:${newUserId}`);
          await AsyncStorage.setItem(newKey, data);
          // Keep local data as backup (don't delete)
        }
      }

      // Update userId in unified history records
      const historyData = await AsyncStorage.getItem('@unified_workout_history');
      if (historyData) {
        const records = JSON.parse(historyData);
        const updatedRecords = records.map((r: any) => ({
          ...r,
          userId: r.userId === 'local' ? newUserId : r.userId,
        }));
        await AsyncStorage.setItem('@unified_workout_history', JSON.stringify(updatedRecords));
      }

      console.log('Successfully migrated local data to user:', newUserId);

      // Queue all existing local workouts for sync to server
      await syncExistingWorkoutsToServer(newUserId);
    } catch (error) {
      console.error('Error migrating local data:', error);
    }
  };

  /**
   * Sync all existing local workouts to the server
   * TODO: Implement when workout log storage is properly set up
   */
  const syncExistingWorkoutsToServer = async (_userId: string) => {
    // Note: This function is currently disabled because getWorkoutHistory
    // requires a programId and returns program-specific history, not a
    // general workout log. Re-enable when proper workout log storage exists.
    console.log('Workout sync to server: Not yet implemented (needs workout log storage)');
    return;

    /* Original implementation - requires proper workout log storage:
    try {
      const allWorkouts = await getWorkoutHistory(programId);
      const workouts = allWorkouts.completions;

      if (workouts.length === 0) {
        console.log('No workouts to sync');
        return;
      }

      console.log(`Syncing ${workouts.length} existing workouts to server...`);

      // Convert each workout to syncable format and queue it
      for (const workout of workouts) {
        const syncableWorkout = {
          id: `${allWorkouts.programId}-${workout.week}-${workout.day}`,
          localId: `${allWorkouts.programId}-${workout.week}-${workout.day}`,
          workoutName: `Week ${workout.week} Day ${workout.day}`,
          workoutType: 'program' as 'program' | 'quick',
          completedAt: workout.completedAt,
          durationSeconds: workout.durationSeconds || 0,
          exercises: (workout as unknown as { exercises?: Array<{ name: string; totalSets: number; setsCompleted: number; bestSet?: { weight?: number; reps?: number } }> }).exercises?.map((ex) => ({
            exerciseName: ex.name,
            canonicalName: ex.name.toLowerCase().replace(/\s+/g, '_'),
            sets: Array.from({ length: ex.totalSets }, (_, i) => ({
              setNumber: i + 1,
              weight: ex.bestSet?.weight,
              reps: i < ex.setsCompleted ? (ex.bestSet?.reps || 0) : 0,
              completed: i < ex.setsCompleted,
            })),
          })) || [],
        };

        await syncService.queueWorkout(syncableWorkout);
      }

      // Trigger sync
      await syncService.forceSync();

      console.log('Finished queueing workouts for sync');
    } catch (error) {
      console.error('Error syncing existing workouts:', error);
    }
    */
  };

  const signInWithApple = useCallback(async () => {
    try {
      // Check if Apple Authentication module is available
      if (!AppleAuthentication) {
        const msg = 'Sign in with Apple is only available on iOS devices.';
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Not Available', msg);
        return;
      }

      // Check if Apple auth is available on device
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        const msg = 'Sign in with Apple is not available on this device.';
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Not Available', msg);
        return;
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });

        if (error) {
          throw error;
        }

        // Store user's name if provided (Apple only gives it on first sign-in)
        if (credential.fullName?.givenName) {
          await AsyncStorage.setItem(
            '@user_display_name',
            `${credential.fullName.givenName} ${credential.fullName.familyName || ''}`.trim()
          );
        }
      }
    } catch (error: any) {
      if (error.code !== 'ERR_REQUEST_CANCELED') {
        console.error('Apple sign-in error:', error);
        const msg = error.message || 'An error occurred during sign in.';
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Sign In Failed', msg);
      }
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: 'workoutapp://auth/callback',
        },
      });

      if (error) {
        throw error;
      }

      const msg = 'Check your email for a magic link to sign in.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Check Your Email', msg);
    } catch (error: any) {
      console.error('Email sign-in error:', error);
      const msg = error.message || 'An error occurred. Make sure Supabase is configured.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Sign In Failed', msg);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      // Clear stored role on sign out
      await AsyncStorage.removeItem(USER_ROLE_KEY);
    } catch (error: any) {
      console.error('Sign out error:', error);
    } finally {
      // Always reset to guest state
      setState(prev => ({
        ...prev,
        user: null,
        session: null,
        isGuest: true,
        userRole: null,
        needsRoleSelection: false,
      }));
    }
  }, []);

  const continueAsGuest = useCallback(() => {
    setState(prev => ({
      ...prev,
      isGuest: true,
      isLoading: false,
    }));
  }, []);

  /**
   * Set the user's role (athlete or coach)
   * Persists to AsyncStorage and updates state
   */
  const setUserRole = useCallback(async (role: UserRole) => {
    try {
      if (role) {
        await AsyncStorage.setItem(USER_ROLE_KEY, role);
      } else {
        await AsyncStorage.removeItem(USER_ROLE_KEY);
      }
      setState(prev => ({
        ...prev,
        userRole: role,
        needsRoleSelection: false,
      }));
    } catch (error) {
      console.error('Error setting user role:', error);
    }
  }, []);

  /**
   * DEV MODE ONLY: Login with a mock user for testing
   * Creates a fake user session to test coach/athlete flows
   */
  const devModeLogin = useCallback(async (role: UserRole) => {
    if (!__DEV__) {
      console.warn('devModeLogin should only be used in development');
      return;
    }

    const mockUserId = role === 'coach' ? 'dev-coach-123' : 'dev-athlete-456';
    const mockEmail = role === 'coach' ? 'coach@test.dev' : 'athlete@test.dev';
    const mockDisplayName = role === 'coach' ? 'Test Coach' : 'Test Athlete';

    // Store the role and display name
    await AsyncStorage.setItem(USER_ROLE_KEY, role || 'athlete');
    await AsyncStorage.setItem('@user_display_name', mockDisplayName);

    // Create a mock user object (mimics Supabase User structure)
    const mockUser = {
      id: mockUserId,
      email: mockEmail,
      app_metadata: {},
      user_metadata: { name: mockDisplayName },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as User;

    setState({
      user: mockUser,
      session: null, // No real session, but user is "logged in"
      isLoading: false,
      isGuest: false,
      userRole: role,
      needsRoleSelection: false,
    });

    console.log(`[DEV MODE] Logged in as ${role}: ${mockEmail}`);
  }, []);

  const value: AuthContextType = {
    ...state,
    signInWithApple,
    signInWithEmail,
    signOut,
    continueAsGuest,
    setUserRole,
    devModeLogin,
    isCoach: state.userRole === 'coach',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Get the current user ID for storage operations.
 * Returns 'local' for guests, or the authenticated user's ID.
 */
export function useUserId(): string {
  const { user, isGuest } = useAuth();
  return isGuest || !user ? 'local' : user.id;
}
