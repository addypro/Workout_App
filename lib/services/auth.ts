// Authentication Service for Expo
// Using expo-secure-store for token storage

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { prisma } from '@/lib/db/client';
import type { User, UserRole } from '@prisma/client';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

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

/**
 * Hash password using SHA-256
 */
async function hashPassword(password: string): Promise<string> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password
  );
  return hash;
}

/**
 * Generate a random token
 */
async function generateToken(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  return Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Sign up a new user
 */
export async function signUp(data: SignUpData): Promise<AuthUser> {
  const { email, password, name, role = 'CONSUMER' } = data;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: name || null,
      role,
    },
  });

  // Generate token
  const token = await generateToken();
  await SecureStore.setItemAsync(TOKEN_KEY, token);

  // Store user data
  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    image: user.image,
  };
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(authUser));

  return authUser;
}

/**
 * Sign in an existing user
 */
export async function signIn(data: SignInData): Promise<AuthUser> {
  const { email, password } = data;

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error('Invalid email or password');
  }

  // Verify password
  const hashedPassword = await hashPassword(password);
  if (user.password !== hashedPassword) {
    throw new Error('Invalid email or password');
  }

  // Generate token
  const token = await generateToken();
  await SecureStore.setItemAsync(TOKEN_KEY, token);

  // Store user data
  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    image: user.image,
  };
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(authUser));

  return authUser;
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

/**
 * Get the current user
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const userJson = await SecureStore.getItemAsync(USER_KEY);
    if (!userJson) {
      return null;
    }
    return JSON.parse(userJson);
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  return !!token;
}

/**
 * Get auth token
 */
export async function getAuthToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}
