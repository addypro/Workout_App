/**
 * History Tab Screen
 *
 * Displays workout history in the main tab navigation.
 * Shows stats summary and completed workouts grouped by time period.
 */

import { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Card } from '@/components/ui/card';
import { WorkoutHistoryCard } from '@/components/history/workout-history-card';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  getUnifiedHistory,
  getWorkoutStats,
  groupHistoryByPeriod,
  type UnifiedWorkoutRecord,
} from '@/lib/db/storage';
import { useAuth } from '@/lib/context/auth-context';

export default function HistoryTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, isGuest } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState<UnifiedWorkoutRecord[]>([]);
  const [groupedHistory, setGroupedHistory] = useState<
    { period: string; records: UnifiedWorkoutRecord[] }[]
  >([]);
  const [stats, setStats] = useState<{
    totalWorkouts: number;
    thisWeek: number;
    thisMonth: number;
    currentStreak: number;
    totalDurationMinutes: number;
  } | null>(null);

  // Get user ID for storage
  const userId = isGuest || !user ? 'local' : user.id;

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [userId])
  );

  const loadData = async () => {
    try {
      const [historyData, statsData] = await Promise.all([
        getUnifiedHistory(userId),
        getWorkoutStats(userId),
      ]);
      setHistory(historyData);
      setGroupedHistory(groupHistoryByPeriod(historyData));
      setStats(statsData);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleRecordPress = (record: UnifiedWorkoutRecord) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/history/${record.id}`);
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.tint}
          />
        }
      >
        {/* Stats Summary */}
        {stats && stats.totalWorkouts > 0 && (
          <Card style={styles.statsCard} padding="md">
            <View style={styles.statsGrid}>
              <StatItem
                icon="flame.fill"
                value={stats.currentStreak}
                label="Day Streak"
                color="#FF9500"
                colors={colors}
              />
              <StatItem
                icon="calendar"
                value={stats.thisWeek}
                label="This Week"
                color={colors.tint}
                colors={colors}
              />
              <StatItem
                icon="chart.bar.fill"
                value={stats.thisMonth}
                label="This Month"
                color="#30D158"
                colors={colors}
              />
              <StatItem
                icon="clock.fill"
                value={Math.round(stats.totalDurationMinutes / 60)}
                label="Total Hours"
                color="#5856D6"
                colors={colors}
              />
            </View>
          </Card>
        )}

        {/* Empty State */}
        {history.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.tintMuted }]}>
              <IconSymbol name="clock.arrow.circlepath" size={40} color={colors.tint} />
            </View>
            <ThemedText style={styles.emptyTitle}>No Workouts Yet</ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Complete your first workout to start tracking your progress
            </ThemedText>
            <Pressable
              style={({ pressed }) => [
                styles.startButton,
                { backgroundColor: colors.tint, opacity: pressed ? 0.9 : 1 },
              ]}
              onPress={() => router.push('/(tabs)')}
            >
              <ThemedText style={styles.startButtonText}>Start a Workout</ThemedText>
            </Pressable>
          </View>
        ) : (
          /* History List */
          <View style={styles.historyList}>
            {groupedHistory.map((group) => (
              <View key={group.period} style={styles.periodSection}>
                <ThemedText style={[styles.periodTitle, { color: colors.textSecondary }]}>
                  {group.period}
                </ThemedText>
                <View style={styles.recordsList}>
                  {group.records.map((record) => (
                    <WorkoutHistoryCard
                      key={record.id}
                      record={record}
                      onPress={handleRecordPress}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

// Stat Item Component
function StatItem({
  icon,
  value,
  label,
  color,
  colors,
}: {
  icon: string;
  value: number;
  label: string;
  color: string;
  colors: typeof Colors['light'];
}) {
  return (
    <View style={styles.statItem}>
      <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>
        <IconSymbol name={icon as any} size={18} color={color} />
      </View>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  statsCard: {
    marginBottom: Spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    gap: 6,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    ...Typography.title2,
    fontWeight: '700',
  },
  statLabel: {
    ...Typography.caption2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
    gap: Spacing.md,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.title3,
    fontWeight: '600',
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: 'center',
    maxWidth: 280,
  },
  startButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    marginTop: Spacing.md,
  },
  startButtonText: {
    color: '#fff',
    ...Typography.headline,
    fontWeight: '600',
  },
  historyList: {
    gap: Spacing.lg,
  },
  periodSection: {
    gap: Spacing.sm,
  },
  periodTitle: {
    ...Typography.subhead,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recordsList: {
    gap: Spacing.sm,
  },
});
