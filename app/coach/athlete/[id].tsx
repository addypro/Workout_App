/**
 * Athlete Detail Screen
 *
 * Shows details for a single athlete including:
 * - Profile info
 * - Assigned programs
 * - Workout history
 * - Coach notes
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import { Screen } from '@/components/screen';
import {
  getAthleteAssignments,
  getAssignedWorkouts,
  type ProgramAssignment,
  type AssignedWorkout,
  AssignmentStatus,
} from '@/lib/services/coach';

export default function AthleteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [assignments, setAssignments] = useState<ProgramAssignment[]>([]);
  const [recentWorkouts, setRecentWorkouts] = useState<AssignedWorkout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      // Load athlete's assignments
      // Note: We'd need an API that filters by athlete ID
      // For now, show placeholder
      console.log('[AthleteDetail] Loading data for athlete:', id);
    } catch (error) {
      console.error('[AthleteDetail] Error loading data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id])
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: Spacing.lg,
      paddingBottom: 100,
    },
    // Profile Header
    profileHeader: {
      alignItems: 'center',
      marginBottom: Spacing.xl,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.tintMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md,
    },
    athleteName: {
      ...Typography.title2,
      color: colors.text,
      fontWeight: '700',
    },
    athleteStatus: {
      ...Typography.body,
      color: colors.textSecondary,
      marginTop: Spacing.xs,
    },
    // Stats
    statsRow: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginBottom: Spacing.xl,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.groupedBackground,
      padding: Spacing.md,
      borderRadius: Radius.lg,
      alignItems: 'center',
    },
    statValue: {
      ...Typography.title2,
      color: colors.text,
      fontWeight: '700',
    },
    statLabel: {
      ...Typography.caption1,
      color: colors.textSecondary,
      marginTop: Spacing.xs,
    },
    // Section
    sectionTitle: {
      ...Typography.headline,
      color: colors.text,
      marginBottom: Spacing.md,
    },
    // Quick Actions
    actionsRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.xl,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      backgroundColor: colors.groupedBackground,
      paddingVertical: Spacing.md,
      borderRadius: Radius.md,
    },
    actionButtonText: {
      ...Typography.subhead,
      color: colors.tint,
      fontWeight: '600',
    },
    // Empty State
    emptyState: {
      padding: Spacing.xl,
      alignItems: 'center',
    },
    emptyText: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: Spacing.sm,
    },
    // Card
    card: {
      backgroundColor: colors.groupedBackground,
      padding: Spacing.md,
      borderRadius: Radius.lg,
      marginBottom: Spacing.sm,
    },
    cardTitle: {
      ...Typography.subhead,
      color: colors.text,
      fontWeight: '600',
    },
    cardSubtitle: {
      ...Typography.caption1,
      color: colors.textSecondary,
      marginTop: 2,
    },
    // Loading
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <Text style={{ color: colors.textSecondary }}>Loading...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadData(true)}
            tintColor={colors.tint}
          />
        }
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color={colors.tint} />
          </View>
          <Text style={styles.athleteName}>Athlete</Text>
          <Text style={styles.athleteStatus}>Active</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Programs</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>0%</Text>
            <Text style={styles.statLabel}>Completion</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/coach/assign-program' as any)}
          >
            <Ionicons name="send-outline" size={18} color={colors.tint} />
            <Text style={styles.actionButtonText}>Assign</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => Alert.alert('Coming Soon', 'Message feature coming soon!')}
          >
            <Ionicons name="chatbubble-outline" size={18} color={colors.tint} />
            <Text style={styles.actionButtonText}>Message</Text>
          </TouchableOpacity>
        </View>

        {/* Assigned Programs */}
        <Text style={styles.sectionTitle}>Assigned Programs</Text>
        {assignments.length > 0 ? (
          assignments.map((assignment) => (
            <View key={assignment.id} style={styles.card}>
              <Text style={styles.cardTitle}>{assignment.programName}</Text>
              <Text style={styles.cardSubtitle}>
                Week {assignment.currentWeek} · {assignment.status}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={40} color={colors.textTertiary} />
            <Text style={styles.emptyText}>
              No programs assigned yet.{'\n'}Tap "Assign" to get started.
            </Text>
          </View>
        )}

        {/* Recent Workouts */}
        <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>Recent Workouts</Text>
        {recentWorkouts.length > 0 ? (
          recentWorkouts.map((workout) => (
            <View key={workout.id} style={styles.card}>
              <Text style={styles.cardTitle}>{workout.workoutName}</Text>
              <Text style={styles.cardSubtitle}>
                {workout.completedAt?.toLocaleDateString() || 'In progress'}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="barbell-outline" size={40} color={colors.textTertiary} />
            <Text style={styles.emptyText}>
              No workouts logged yet.
            </Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
