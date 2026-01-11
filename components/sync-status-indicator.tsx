/**
 * Sync Status Indicator
 *
 * Shows the current sync status with visual feedback.
 * Displays pending count and can be tapped to force sync.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useSyncStatus } from '@/lib/context/sync-context';
import { useAuth } from '@/lib/context/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';

interface SyncStatusIndicatorProps {
  variant?: 'compact' | 'full';
  onPress?: () => void;
}

export function SyncStatusIndicator({
  variant = 'compact',
  onPress,
}: SyncStatusIndicatorProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { status, pendingCount, isOnline } = useSyncStatus();
  const { isGuest } = useAuth();

  // Don't show for guests
  if (isGuest) {
    return null;
  }

  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        icon: 'cloud-offline-outline' as const,
        color: colors.textTertiary,
        text: 'Offline',
      };
    }

    switch (status) {
      case 'syncing':
        return {
          icon: 'sync-outline' as const,
          color: colors.tint,
          text: 'Syncing...',
          spinning: true,
        };
      case 'error':
        return {
          icon: 'cloud-offline-outline' as const,
          color: '#FF3B30',
          text: 'Sync error',
        };
      default:
        if (pendingCount > 0) {
          return {
            icon: 'cloud-upload-outline' as const,
            color: '#FF9500',
            text: `${pendingCount} pending`,
          };
        }
        return {
          icon: 'cloud-done-outline' as const,
          color: '#34C759',
          text: 'Synced',
        };
    }
  };

  const statusInfo = getStatusInfo();

  const styles = StyleSheet.create({
    compactContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.sm,
      backgroundColor: colors.groupedBackground,
    },
    fullContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
      borderRadius: Radius.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.separator,
    },
    leftSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    iconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: statusInfo.color + '20',
    },
    text: {
      ...Typography.footnote,
      color: colors.textSecondary,
    },
    fullText: {
      ...Typography.body,
      color: colors.text,
    },
    subText: {
      ...Typography.caption1,
      color: colors.textTertiary,
    },
    badge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: '#FF9500',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    badgeText: {
      ...Typography.caption2,
      color: '#FFFFFF',
      fontWeight: '600',
    },
  });

  if (variant === 'compact') {
    return (
      <TouchableOpacity
        style={styles.compactContainer}
        onPress={onPress}
        disabled={status === 'syncing'}
      >
        {statusInfo.spinning ? (
          <ActivityIndicator size="small" color={statusInfo.color} />
        ) : (
          <Ionicons name={statusInfo.icon} size={16} color={statusInfo.color} />
        )}
        {pendingCount > 0 && status !== 'syncing' && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.fullContainer}
      onPress={onPress}
      disabled={status === 'syncing'}
    >
      <View style={styles.leftSection}>
        <View style={styles.iconContainer}>
          {statusInfo.spinning ? (
            <ActivityIndicator size="small" color={statusInfo.color} />
          ) : (
            <Ionicons name={statusInfo.icon} size={18} color={statusInfo.color} />
          )}
        </View>
        <View>
          <Text style={styles.fullText}>{statusInfo.text}</Text>
          {pendingCount > 0 && (
            <Text style={styles.subText}>
              {pendingCount} workout{pendingCount !== 1 ? 's' : ''} waiting to sync
            </Text>
          )}
        </View>
      </View>
      {status !== 'syncing' && pendingCount > 0 && (
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      )}
    </TouchableOpacity>
  );
}

/**
 * Minimal sync dot indicator for headers
 */
export function SyncDot() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { status, pendingCount, isOnline } = useSyncStatus();
  const { isGuest } = useAuth();

  if (isGuest || (status === 'idle' && pendingCount === 0 && isOnline)) {
    return null;
  }

  let dotColor = '#34C759'; // Green - synced

  if (!isOnline) {
    dotColor = colors.textTertiary; // Gray - offline
  } else if (status === 'syncing') {
    dotColor = colors.tint; // Blue - syncing
  } else if (status === 'error') {
    dotColor = '#FF3B30'; // Red - error
  } else if (pendingCount > 0) {
    dotColor = '#FF9500'; // Orange - pending
  }

  return (
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: dotColor,
      }}
    />
  );
}
