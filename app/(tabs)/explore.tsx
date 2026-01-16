/**
 * History Tab Screen
 *
 * Displays workout history in the main tab navigation.
 * Shows stats summary and completed workouts grouped by time period.
 */

import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GymPickerModal } from '@/components/gym/gym-picker-modal';
import { WorkoutHistoryCard } from '@/components/history/workout-history-card';
import { Screen } from '@/components/screen';
import { SwipeTabs } from '@/components/swipe-tabs';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUserId } from '@/lib/context/auth-context';
import { usePreferences } from '@/lib/context/preferences-context';
import {
  getUnifiedHistory,
  getWorkoutStats,
  groupHistoryByPeriod,
  type UnifiedWorkoutRecord,
} from '@/lib/db/storage';

export default function HistoryTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { homeGym, setHomeGym } = usePreferences();

  // Gym picker modal state
  const [showGymPicker, setShowGymPicker] = useState(false);

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

  // Use actual user ID from auth context to match Strong import
  const userId = useUserId();

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

  const latestRecord = history[0];
  const latestRecordId = latestRecord?.id;
  const groupedHistoryFiltered = latestRecordId
    ? groupedHistory
      .map((group) => ({
        ...group,
        records: group.records.filter((record) => record.id !== latestRecordId),
      }))
      .filter((group) => group.records.length > 0)
    : groupedHistory;

  if (loading) {
    return (
      <SwipeTabs current="explore">
        <Screen>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        </Screen>
      </SwipeTabs>
    );
  }

  return (
    <SwipeTabs current="explore">
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
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
              At a Glance
            </ThemedText>
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
          </View>
        )}

        {latestRecord && (
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
              Latest Workout
            </ThemedText>
            <WorkoutHistoryCard record={latestRecord} onPress={handleRecordPress} />
          </View>
        )}

        {/* My Gym Card */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowGymPicker(true);
          }}
        >
          <Card style={styles.gymCard} padding="md">
            <View style={styles.gymHeader}>
              <View style={styles.gymInfo}>
                <IconSymbol name="star" size={20} color={colors.tint} />
                <ThemedText style={styles.gymLabel}>My Gym</ThemedText>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
            </View>
            <ThemedText style={[styles.gymName, { color: homeGym ? colors.text : colors.textTertiary }]}>
              {homeGym?.name || 'Tap to select your gym'}
            </ThemedText>
            {homeGym?.address && (
              <ThemedText style={[styles.gymAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                {homeGym.address}
              </ThemedText>
            )}
          </Card>
        </Pressable>

        {/* Gym Picker Modal */}
        <GymPickerModal
          visible={showGymPicker}
          onClose={() => setShowGymPicker(false)}
          onSelectGym={setHomeGym}
          currentGym={homeGym}
        />

        {/* Feature Hub - Navigation to Leagues & Challenges */}
        <View style={styles.featureHub}>
          <Pressable
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/leagues' as any);
            }}
          >
            <Card style={styles.featureCard} padding="md">
              <View style={styles.featureContent}>
                <View style={[styles.featureIcon, { backgroundColor: '#FFD60A20' }]}>
                  <ThemedText style={styles.featureEmoji}>🏆</ThemedText>
                </View>
                <View style={styles.featureText}>
                  <ThemedText style={styles.featureTitle}>Leagues</ThemedText>
                  <ThemedText style={[styles.featureSubtitle, { color: colors.textSecondary }]}>
                    Weekly competition & rankings
                  </ThemedText>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
              </View>
            </Card>
          </Pressable>

          <Pressable
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/challenges' as any);
            }}
          >
            <Card style={styles.featureCard} padding="md">
              <View style={styles.featureContent}>
                <View style={[styles.featureIcon, { backgroundColor: '#FF453A20' }]}>
                  <ThemedText style={styles.featureEmoji}>🎯</ThemedText>
                </View>
                <View style={styles.featureText}>
                  <ThemedText style={styles.featureTitle}>Challenges</ThemedText>
                  <ThemedText style={[styles.featureSubtitle, { color: colors.textSecondary }]}>
                    Iron Will 75 & more
                  </ThemedText>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
              </View>
            </Card>
          </Pressable>
        </View>

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
            {groupedHistoryFiltered.map((group) => (
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
    </SwipeTabs>
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
  section: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.headline,
    fontWeight: '600',
  },
  statsCard: {
    marginBottom: 0,
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
  // Gym card styles
  gymCard: {
    marginBottom: Spacing.md,
  },
  gymHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  gymInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  gymLabel: {
    ...Typography.subhead,
    fontWeight: '600',
  },
  gymName: {
    ...Typography.body,
  },
  gymEditRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  gymInput: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
    ...Typography.body,
  },
  gymSaveBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    justifyContent: 'center',
  },
  gymSaveBtnText: {
    color: '#fff',
    ...Typography.subhead,
    fontWeight: '600',
  },
  gymAddress: {
    ...Typography.caption1,
    marginTop: 2,
  },
  // Feature Hub styles
  featureHub: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  featureCard: {
    marginBottom: 0,
  },
  featureContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureEmoji: {
    fontSize: 22,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    ...Typography.headline,
    fontWeight: '600',
  },
  featureSubtitle: {
    ...Typography.caption1,
    marginTop: 2,
  },
});
