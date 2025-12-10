import { supabase } from '../client';
import type { User, Session } from '@supabase/supabase-js';
import type { DbUser, DbUserProfile, CreateUserProfileInput, UserRole } from '../types';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  image: string | null;
}

export interface SignUpData {
  email: string;
  password: string;
  name?: string;
  role?: UserRole;
}

export interface SignInData {
  email: string;
  password: string;
}

// Sign up with email and password
export async function signUp(data: SignUpData): Promise<{
  user: User | null;
  session: Session | null;
}> {
  const { data: authData, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        name: data.name ?? null,
        role: data.role ?? 'CONSUMER',
      },
    },
  });

  if (error) throw error;

  // Create user record in our users table
  if (authData.user) {
    const { error: userError } = await supabase.from('users').insert({
      id: authData.user.id,
      email: data.email,
      name: data.name ?? null,
      password: '', // We don't store password - Supabase Auth handles it
      role: data.role ?? 'CONSUMER',
    });

    if (userError && userError.code !== '23505') { // Ignore duplicate key error
      console.error('Error creating user record:', userError);
    }
  }

  return {
    user: authData.user,
    session: authData.session,
  };
}

// Sign in with email and password
export async function signIn(data: SignInData): Promise<{
  user: User | null;
  session: Session | null;
}> {
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (error) throw error;

  return {
    user: authData.user,
    session: authData.session,
  };
}

// Sign out
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Get current session
export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

// Get current user from Supabase Auth
export async function getCurrentAuthUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

// Get current user profile from our database
export async function getCurrentUserProfile(): Promise<AuthUser | null> {
  const authUser = await getCurrentAuthUser();
  if (!authUser) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return null;

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    role: data.role,
    image: data.image,
  };
}

// Update user profile
export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<DbUser, 'name' | 'image' | 'role'>>
): Promise<AuthUser> {
  const { data, error } = await supabase
    .from('users')
    .update({
      ...updates,
      updatedAt: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    role: data.role,
    image: data.image,
  };
}

// Get user's extended profile
export async function getUserExtendedProfile(userId: string): Promise<DbUserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('userId', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// Create or update extended profile
export async function upsertUserExtendedProfile(
  input: CreateUserProfileInput
): Promise<DbUserProfile> {
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert({
      ...input,
      preferredEquipment: input.preferredEquipment ?? [],
      updatedAt: new Date().toISOString(),
    }, {
      onConflict: 'userId',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Listen to auth state changes
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
) {
  return supabase.auth.onAuthStateChange(callback);
}

// Send password reset email
export async function resetPassword(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

// Update password (when logged in)
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (error) throw error;
}
