/**
 * Shared Back Button Component
 *
 * Consistent back navigation across the app.
 * Falls back to a specified route if no history exists.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface BackButtonProps {
  label?: string;
  fallbackRoute?: string;
  onPress?: () => void;
}

export function BackButton({
  label = 'Back',
  fallbackRoute = '/(tabs)',
  onPress
}: BackButtonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallbackRoute as any);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={styles.container}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={`Go back to ${label}`}
    >
      <Ionicons
        name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
        size={Platform.OS === 'ios' ? 28 : 24}
        color={colors.tint}
      />
      {Platform.OS === 'ios' && (
        <Text style={[styles.label, { color: colors.tint }]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

interface CloseButtonProps {
  fallbackRoute?: string;
  onPress?: () => void;
}

export function CloseButton({
  fallbackRoute = '/(tabs)',
  onPress
}: CloseButtonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallbackRoute as any);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={styles.closeButton}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel="Close"
    >
      <Ionicons name="close" size={24} color={colors.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: Platform.OS === 'ios' ? -8 : 0,
    paddingVertical: 8,
    paddingRight: 16,
  },
  label: {
    fontSize: 17,
    marginLeft: -4,
  },
  closeButton: {
    padding: 8,
  },
});
