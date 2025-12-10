import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '../supabase/client';
import {
  signUp,
  signIn,
  signOut,
  getCurrentAuthUser,
  getCurrentUserProfile,
  updateUserProfile,
  getUserExtendedProfile,
  upsertUserExtendedProfile,
  onAuthStateChange,
} from '../supabase/services/auth';
import type {
  SignUpData,
  SignInData,
  AuthUser,
} from '../supabase/services/auth';
import type { DbUserProfile, CreateUserProfileInput } from '../supabase/types';
import type { User, Session } from '@supabase/supabase-js';

// Query keys
export const authKeys = {
  all: ['auth'] as const,
  session: () => [...authKeys.all, 'session'] as const,
  user: () => [...authKeys.all, 'user'] as const,
  profile: () => [...authKeys.all, 'profile'] as const,
  extendedProfile: (userId: string) => [...authKeys.all, 'extendedProfile', userId] as const,
};

// Hook to get current auth session and user
export function useAuth() {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = onAuthStateChange((event, session) => {
      setSession(session);

      // Invalidate auth queries on auth changes
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        queryClient.invalidateQueries({ queryKey: authKeys.user() });
        queryClient.invalidateQueries({ queryKey: authKeys.profile() });
      } else if (event === 'SIGNED_OUT') {
        queryClient.removeQueries({ queryKey: authKeys.all });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  return {
    session,
    user: session?.user ?? null,
    isAuthenticated: !!session,
    loading,
  };
}

// Hook to get current Supabase Auth user
export function useAuthUser() {
  return useQuery({
    queryKey: authKeys.user(),
    queryFn: getCurrentAuthUser,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Hook to get current user profile from our database
export function useUserProfile() {
  return useQuery({
    queryKey: authKeys.profile(),
    queryFn: getCurrentUserProfile,
    staleTime: 1000 * 60 * 5,
  });
}

// Hook to get extended user profile
export function useExtendedProfile(userId: string | undefined) {
  return useQuery({
    queryKey: authKeys.extendedProfile(userId ?? ''),
    queryFn: () => getUserExtendedProfile(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Hook to sign up
export function useSignUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SignUpData) => signUp(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.all });
    },
  });
}

// Hook to sign in
export function useSignIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SignInData) => signIn(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.all });
    },
  });
}

// Hook to sign out
export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      // Clear all cached data on sign out
      queryClient.clear();
    },
  });
}

// Hook to update user profile
export function useUpdateUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      updates,
    }: {
      userId: string;
      updates: Partial<Pick<AuthUser, 'name' | 'image' | 'role'>>;
    }) => updateUserProfile(userId, updates),
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(authKeys.profile(), updatedProfile);
    },
  });
}

// Hook to update extended profile
export function useUpdateExtendedProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateUserProfileInput) => upsertUserExtendedProfile(input),
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(
        authKeys.extendedProfile(updatedProfile.userId),
        updatedProfile
      );
    },
  });
}
