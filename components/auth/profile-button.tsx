/**
 * Profile Button Component
 *
 * Shows user avatar/initial when signed in, or sign-in prompt for guests.
 * Displays role-aware menu with options for coaches/athletes.
 * Used in headers across the app for quick access to auth state.
 */

import React, { useEffect, useState } from 'react';
import { TouchableOpacity, View, Text, StyleSheet, ActionSheetIOS, Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '@/lib/context/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';

interface ProfileButtonProps {
  size?: 'small' | 'medium';
  showLabel?: boolean;
}

export function ProfileButton({ size = 'medium', showLabel = false }: ProfileButtonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, isGuest, isCoach, signOut } = useAuth();
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    const loadDisplayName = async () => {
      const name = await AsyncStorage.getItem('@user_display_name');
      setDisplayName(name);
    };
    loadDisplayName();
  }, [user]);

  const showMenu = () => {
    // Build menu options based on role
    const options: { label: string; action: () => void; destructive?: boolean }[] = [];

    if (isCoach) {
      options.push(
        { label: 'Coach Dashboard', action: () => router.push('/(tabs)/coach') },
        { label: 'My Athletes', action: () => router.push('/coach/athletes' as any) },
        { label: 'Invite Athletes', action: () => router.push('/coach/invite' as any) },
      );
    }

    options.push(
      { label: 'Settings', action: () => Alert.alert('Coming Soon', 'Settings screen coming soon!') },
      { label: 'Sign Out', action: signOut, destructive: true },
    );

    const optionLabels = options.map(o => o.label);

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...optionLabels, 'Cancel'],
          destructiveButtonIndex: options.findIndex(o => o.destructive),
          cancelButtonIndex: optionLabels.length,
          title: displayName || user?.email || 'Account',
        },
        (buttonIndex) => {
          if (buttonIndex < options.length) {
            options[buttonIndex].action();
          }
        }
      );
    } else {
      // Android: Use Alert for now
      Alert.alert(
        displayName || user?.email || 'Account',
        'Select an option',
        [
          ...options.map((o) => ({
            text: o.label,
            onPress: o.action,
            style: o.destructive ? ('destructive' as const) : ('default' as const),
          })),
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const handlePress = () => {
    if (isGuest || !user) {
      router.push('/(auth)/login');
    } else {
      showMenu();
    }
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
