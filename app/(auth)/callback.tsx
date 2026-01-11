/**
 * Auth Callback Screen
 *
 * Handles magic link redirects from email sign-in.
 * Shows loading state while Supabase processes the auth token.
 */

import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase/client';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, Typography } from '@/constants/theme';

export default function AuthCallbackScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const params = useLocalSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // The Supabase auth state listener in AuthProvider will handle the session
        // We just need to wait a moment for it to process
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Check if we have a session now
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          // Successfully authenticated, go to home
          router.replace('/(tabs)');
        } else {
          // Something went wrong, go back to login
          router.replace('/(auth)/login');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        router.replace('/(auth)/login');
      }
    };

    handleCallback();
  }, [params]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.lg,
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.tintMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.lg,
    },
    title: {
      ...Typography.title2,
      color: colors.text,
      textAlign: 'center',
      marginBottom: Spacing.sm,
    },
    subtitle: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: Spacing.xl,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="checkmark-circle-outline" size={40} color={colors.tint} />
      </View>
      <Text style={styles.title}>Signing you in...</Text>
      <Text style={styles.subtitle}>Please wait while we verify your account</Text>
      <ActivityIndicator size="large" color={colors.tint} />
    </View>
  );
}
