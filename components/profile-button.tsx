/**
 * Profile Button Component
 *
 * Shows user avatar/initials or a default icon.
 * Displays workout streak badge when active.
 * Navigates to workout history on tap.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getWorkoutStats } from '@/lib/db/storage';

interface ProfileButtonProps {
  userId?: string;
  userName?: string;
}

export function ProfileButton({ userId = 'local', userName }: ProfileButtonProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    loadStreak();
  }, []);

  const loadStreak = async () => {
    try {
      const stats = await getWorkoutStats(userId);
      setStreak(stats.currentStreak);
    } catch (error) {
      console.error('Error loading streak:', error);
    }
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/history');
  };

  const getInitial = () => {
    if (userName && userName.length > 0) {
      return userName.charAt(0).toUpperCase();
    }
    return null;
  };

  const initial = getInitial();

  return (
    <Pressable onPress={handlePress} hitSlop={12}>
      {({ pressed }) => (
        <View style={[styles.container, { opacity: pressed ? 0.7 : 1 }]}>
          {/* Avatar Circle */}
          <View
            style={[
              styles.avatar,
              {
                backgroundColor: initial ? colors.tint : colors.separator,
              },
            ]}
          >
            {initial ? (
              <ThemedText style={styles.initial}>{initial}</ThemedText>
            ) : (
              <IconSymbol name="person.fill" size={16} color={colors.textSecondary} />
            )}
          </View>

          {/* Streak Badge */}
          {streak > 0 && (
            <View style={styles.streakBadge}>
              <IconSymbol name="flame.fill" size={10} color="#FF9500" />
              <ThemedText style={styles.streakText}>{streak}</ThemedText>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  streakBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: Radius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  streakText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FF9500',
  },
});
