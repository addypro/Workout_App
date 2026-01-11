/**
 * My Athletes Screen
 *
 * List and manage all athletes connected to the coach.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { Screen } from '@/components/screen';
import {
  getMyAthletes,
  removeAthlete,
  CoachAthlete,
  AthleteStatus,
} from '@/lib/services/coach';

export default function MyAthletesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [athletes, setAthletes] = useState<CoachAthlete[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadAthletes = async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const result = await getMyAthletes(AthleteStatus.ACTIVE, 1, 100);
      if (result.success && result.data) {
        setAthletes(result.data.data);
      }
    } catch (error) {
      console.error('Error loading athletes:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadAthletes();
    }, [])
  );

  const handleRemoveAthlete = (athlete: CoachAthlete) => {
    Alert.alert(
      'Remove Athlete',
      `Are you sure you want to remove ${athlete.athleteName || 'this athlete'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeAthlete(athlete.id);
            loadAthletes();
          },
        },
      ]
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    listContent: {
      padding: Spacing.lg,
    },
    athleteCard: {
      backgroundColor: colors.groupedBackground,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: colors.tintMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
    },
    info: {
      flex: 1,
    },
    name: {
      ...Typography.headline,
      color: colors.text,
    },
    meta: {
      ...Typography.footnote,
      color: colors.textSecondary,
      marginTop: 2,
    },
    sharingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.tintMuted,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: Radius.sm,
      marginTop: Spacing.xs,
      alignSelf: 'flex-start',
    },
    sharingText: {
      ...Typography.caption2,
      color: colors.tint,
      marginLeft: 4,
    },
    actions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    actionButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xxl,
    },
    emptyTitle: {
      ...Typography.headline,
      color: colors.text,
      marginTop: Spacing.lg,
    },
    emptyText: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: Spacing.sm,
    },
  });

  const renderAthlete = ({ item }: { item: CoachAthlete }) => (
    <View style={styles.athleteCard}>
      <View style={styles.avatar}>
        <Ionicons name="person" size={24} color={colors.tint} />
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{item.athleteName || 'Athlete'}</Text>
        <Text style={styles.meta}>
          Joined {item.joinedAt?.toLocaleDateString() || 'recently'}
        </Text>
        {item.shareWorkoutHistory && (
          <View style={styles.sharingBadge}>
            <Ionicons name="eye" size={12} color={colors.tint} />
            <Text style={styles.sharingText}>Sharing history</Text>
          </View>
        )}
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleRemoveAthlete(item)}
        >
          <Ionicons name="person-remove-outline" size={20} color="#FF453A" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={64} color={colors.textTertiary} />
      <Text style={styles.emptyTitle}>No Athletes Yet</Text>
      <Text style={styles.emptyText}>
        Invite athletes to start training them with your custom programs.
      </Text>
    </View>
  );

  return (
    <Screen>
      <FlatList
        style={styles.container}
        contentContainerStyle={[
          styles.listContent,
          athletes.length === 0 && { flex: 1 },
        ]}
        data={athletes}
        renderItem={renderAthlete}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={!isLoading ? renderEmpty : null}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadAthletes(true)}
            tintColor={colors.tint}
          />
        }
      />
    </Screen>
  );
}
