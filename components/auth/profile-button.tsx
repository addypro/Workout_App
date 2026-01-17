/**
 * Profile Button Component
 *
 * Shows user avatar/initial when signed in, or sign-in prompt for guests.
 * Displays role-aware menu with options for coaches/athletes.
 * Used in headers across the app for quick access to auth state.
 */

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/context/auth-context';

interface ProfileButtonProps {
  size?: 'small' | 'medium';
  showLabel?: boolean;
}

export function ProfileButton({ size = 'medium', showLabel = false }: ProfileButtonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, isGuest } = useAuth();
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    const loadDisplayName = async () => {
      // Priority: user metadata > AsyncStorage fallback
      const sessionName = user?.user_metadata?.name
        || user?.user_metadata?.full_name
        || user?.user_metadata?.display_name;

      if (sessionName) {
        setDisplayName(sessionName);
        return;
      }

      // Fallback to AsyncStorage (for dev mode or Apple sign-in first time)
      const storedName = await AsyncStorage.getItem('@user_display_name');
      setDisplayName(storedName);
    };
    loadDisplayName();
  }, [user]);

  const handlePress = () => {
    router.push('/(tabs)/you' as any);
  };

  const buttonSize = size === 'small' ? 32 : 40;
  const iconSize = size === 'small' ? 18 : 22;
  const fontSize = size === 'small' ? Typography.caption1.fontSize : Typography.footnote.fontSize;

  const getInitial = (): string => {
    if (displayName) return displayName.charAt(0).toUpperCase();
    if (user?.email) return user.email.charAt(0).toUpperCase();
    return '?';
  };

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    button: {
      width: buttonSize,
      height: buttonSize,
      borderRadius: buttonSize / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    guestButton: {
      backgroundColor: colors.groupedBackground,
      borderWidth: 1,
      borderColor: colors.separator,
      borderStyle: 'dashed',
    },
    userButton: {
      backgroundColor: colors.tint,
    },
    initial: {
      fontSize: fontSize,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    label: {
      ...Typography.footnote,
      color: colors.textSecondary,
    },
    signInLabel: {
      color: colors.tint,
    },
  });

  if (isGuest || !user) {
    return (
      <TouchableOpacity style={styles.container} onPress={handlePress}>
        <View style={[styles.button, styles.guestButton]}>
          <Ionicons name="person-outline" size={iconSize} color={colors.textTertiary} />
        </View>
        {showLabel && (
          <Text style={[styles.label, styles.signInLabel]}>Sign in</Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress}>
      <View style={[styles.button, styles.userButton]}>
        <Text style={styles.initial}>{getInitial()}</Text>
      </View>
      {showLabel && displayName && (
        <Text style={styles.label}>{displayName}</Text>
      )}
    </TouchableOpacity>
  );
}
