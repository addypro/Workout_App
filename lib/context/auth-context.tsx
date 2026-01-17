/**
 * Authentication Context
 *
 * Provides user authentication state and methods throughout the app.
 * Supports Sign in with Apple (iOS) and email magic links.
 * Handles local data migration on first sign-in.
 *
 * Works in guest mode when Supabase is not configured.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import { router } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { ensureStorageTables, getDatabase } from '@/lib/db/sqlite';
import { initializeTierSystem } from '@/lib/services/leagues/tier-system';
import { supabase } from '@/lib/supabase/client';

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
  signInWithGoogle: () => Promise<void>;
  signInWithTwitter: () => Promise<void>;
  signInWithSpotify: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
  setUserRole: (role: UserRole) => Promise<void>;
  devModeLogin: (role: UserRole) => Promise<void>;
  isCoach: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getParamValue(params: URLSearchParams, key: string): string | null {
  const value = params.get(key);
  return value && value.length > 0 ? value : null;
}

async function completeOAuthSession(resultUrl: string): Promise<void> {
  const url = new URL(resultUrl);
  const hashParams = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
  const queryParams = url.searchParams;

  const accessToken = getParamValue(hashParams, 'access_token') ?? getParamValue(queryParams, 'access_token');
  const refreshToken = getParamValue(hashParams, 'refresh_token') ?? getParamValue(queryParams, 'refresh_token') ?? '';
  const code = getParamValue(queryParams, 'code') ?? getParamValue(hashParams, 'code');
  const errorDescription =
    getParamValue(queryParams, 'error_description') ?? getParamValue(hashParams, 'error_description');

  if (errorDescription) {
    throw new Error(errorDescription);
  }

  if (accessToken) {
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return;
  }

  if (code && typeof supabase.auth.exchangeCodeForSession === 'function') {
    await supabase.auth.exchangeCodeForSession(code);
    return;
  }

  throw new Error('OAuth sign-in did not return a session.');
}

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

          // Migrate local data first to prevent race conditions
          await migrateLocalData(session.user.id);

          setState({
            user: session.user,
            session,
            isLoading: false,
            isGuest: false,
            userRole,
            needsRoleSelection,
          });
          // Initialize tier system from database
          initializeTierSystem(supabase);
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

              if (event === 'SIGNED_IN') {
                // Migrate local data first so UI finds it immediately
                await migrateLocalData(session.user.id);
                initializeTierSystem(supabase);
              }

              setState({
                user: session.user,
                session,
                isLoading: false,
                isGuest: false,
                userRole: role,
                needsRoleSelection: needsRole,
              });
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

      // Update userId in workout programs
      const programsData = await AsyncStorage.getItem('@workout_programs');
      if (programsData) {
        const programs = JSON.parse(programsData);
        const updatedPrograms = programs.map((p: any) => ({
          ...p,
          userId: p.userId === 'local' ? newUserId : p.userId,
        }));
        await AsyncStorage.setItem('@workout_programs', JSON.stringify(updatedPrograms));
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

      // Update userId in SQLite-backed history and templates
      const db = await getDatabase();
      if (db && await ensureStorageTables()) {
        await db.runAsync(
          'UPDATE unified_workout_history SET user_id = ? WHERE user_id = ?',
          [newUserId, 'local']
        );
        await db.runAsync(
          'UPDATE saved_workout_templates SET user_id = ? WHERE user_id = ?',
          [newUserId, 'local']
        );
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

  /**
   * Sign in with email and password
   */
  const signInWithPassword = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error('Password sign-in error:', error);
      throw error; // Re-throw to let UI handle it
    }
  }, []);

  /**
   * Sign up with email and password
   */
  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    try {
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'workoutapp://auth/callback',
        },
      });

      if (error) {
        throw error;
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        const msg = 'Check your email to confirm your account.';
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Confirm Your Email', msg);
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      throw error; // Re-throw to let UI handle it
    }
  }, []);

  /**
   * Sign in with Google using OAuth
   */
  const signInWithGoogle = useCallback(async () => {
    try {
      // Import web browser for OAuth
      const WebBrowser = await import('expo-web-browser');
      const AuthSession = await import('expo-auth-session');

      // Get the redirect URL that works with Expo Go
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: 'workoutapp',
        path: 'auth/callback',
      });

      console.log('Google OAuth redirect URL:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        throw error;
      }

      // Open the OAuth URL in an auth session (handles redirect back to app)
      if (data.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

        if (result.type === 'success' && result.url) {
          await completeOAuthSession(result.url);
        }
      }
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      const msg = error.message || 'An error occurred during Google sign in.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Sign In Failed', msg);
    }
  }, []);

  /**
   * Sign in with Twitter/X using OAuth
   */
  const signInWithTwitter = useCallback(async () => {
    try {
      const WebBrowser = await import('expo-web-browser');
      const AuthSession = await import('expo-auth-session');

      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: 'workoutapp',
        path: 'auth/callback',
      });

      console.log('Twitter OAuth redirect URL:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'twitter',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) throw error;

      if (data.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

        if (result.type === 'success' && result.url) {
          await completeOAuthSession(result.url);
        }
      }
    } catch (error: any) {
      console.error('Twitter sign-in error:', error);
      const msg = error.message || 'An error occurred during Twitter sign in.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Sign In Failed', msg);
    }
  }, []);

  /**
   * Sign in with Spotify using OAuth
   */
  const signInWithSpotify = useCallback(async () => {
    try {
      const WebBrowser = await import('expo-web-browser');
      const AuthSession = await import('expo-auth-session');

      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: 'workoutapp',
        path: 'auth/callback',
      });

      console.log('Spotify OAuth redirect URL:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'spotify',
        options: {
          redirectTo: redirectUrl,
          scopes: 'user-read-email',
        },
      });

      if (error) throw error;

      if (data.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

        if (result.type === 'success' && result.url) {
          await completeOAuthSession(result.url);
        }
      }
    } catch (error: any) {
      console.error('Spotify sign-in error:', error);
      const msg = error.message || 'An error occurred during Spotify sign in.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Sign In Failed', msg);
    }
  }, []);

  /**
   * Sign in with Facebook using OAuth
   */
  const signInWithFacebook = useCallback(async () => {
    try {
      const WebBrowser = await import('expo-web-browser');
      const AuthSession = await import('expo-auth-session');

      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: 'workoutapp',
        path: 'auth/callback',
      });

      console.log('Facebook OAuth redirect URL:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: redirectUrl,
          scopes: 'email,public_profile',
        },
      });

      if (error) throw error;

      if (data.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

        if (result.type === 'success' && result.url) {
          await completeOAuthSession(result.url);
        }
      }
    } catch (error: any) {
      console.error('Facebook sign-in error:', error);
      const msg = error.message || 'An error occurred during Facebook sign in.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Sign In Failed', msg);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      // Clear stored data on sign out
      await AsyncStorage.removeItem(USER_ROLE_KEY);
      await AsyncStorage.removeItem('@user_display_name');
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
      // Navigate to landing page after sign out (full auth options)
      router.replace('/(auth)/landing');
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

    // Use valid UUIDs so Supabase queries work in dev mode
    const mockUserId = role === 'coach'
      ? '00000000-0000-0000-0000-000000000001'  // dev-coach
      : '00000000-0000-0000-0000-000000000002'; // dev-athlete
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
    signInWithGoogle,
    signInWithTwitter,
    signInWithSpotify,
    signInWithFacebook,
    signInWithEmail,
    signInWithPassword,
    signUpWithPassword,
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
