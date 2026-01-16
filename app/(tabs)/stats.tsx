/**
 * Stats Tab Screen
 *
 * Analytics dashboard showing:
 * - Summary cards (total workouts, PRs, streak)
 * - Exercise progress with charts
 * - Recent PRs
 */

import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/screen';
import { SwipeTabs } from '@/components/swipe-tabs';
import { ExerciseProgressChart } from '@/components/stats/progress-chart';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/context/auth-context';
import {
  calculateStats,
  formatPR,
  getPRTypeName,
  getRecentPRs,
  getTopExercises,
  type ExerciseStats,
  type PersonalRecord,
  type StatsSnapshot,
} from '@/lib/services/stats';

export default function StatsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id || 'local';

  const [stats, setStats] = useState<StatsSnapshot | null>(null);
  const [topExercises, setTopExercises] = useState<ExerciseStats[]>([]);
  const [recentPRs, setRecentPRs] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseStats | null>(null);

  const loadStats = useCallback(async (forceRefresh = false) => {
    try {
      const [statsData, exercises, prs] = await Promise.all([
        calculateStats(userId, forceRefresh),
        getTopExercises(userId, 10),
        getRecentPRs(userId, 30),
      ]);
      setStats(statsData);
      setTopExercises(exercises);
      setRecentPRs(prs);
    } catch (error) {
      console.error('[Stats] Error loading stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadStats(true);
  }, [loadStats]);

  const handleExerciseTap = useCallback((exercise: ExerciseStats) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedExercise(exercise);
  }, []);

  if (loading) {
    return (
      <SwipeTabs current="stats">
        <Screen contentStyle={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
            Calculating your stats...
          </ThemedText>
        </Screen>
      </SwipeTabs>
    );
  }

  // Show chart detail view
  if (selectedExercise) {
    return (
      <SwipeTabs current="stats">
        <ExerciseProgressChart
          exercise={selectedExercise}
          onClose={() => setSelectedExercise(null)}
        />
      </SwipeTabs>
    );
  }

  return (
    <SwipeTabs current="stats">
      <Screen>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 100 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.tint}
            />
          }
          showsVerticalScrollIndicator={false}
        >
        {/* Highlights */}
        {stats && (
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
              Highlights
            </ThemedText>
            <View style={styles.highlightsRow}>
              <View style={[styles.highlightCard, { backgroundColor: colors.glassBackground, borderColor: colors.separator }]}>
                <View style={[styles.highlightIcon, { backgroundColor: colors.tint + '15' }]}>
                  <IconSymbol name="clock.fill" size={16} color={colors.tint} />
                </View>
                <View>
                  <ThemedText style={[styles.highlightLabel, { color: colors.textSecondary }]}>
                    Last Workout
                  </ThemedText>
                  <ThemedText style={styles.highlightValue}>
                    {stats.lastWorkoutDate ? formatRelativeDate(stats.lastWorkoutDate) : 'No workouts yet'}
                  </ThemedText>
                </View>
              </View>
              <View style={[styles.highlightCard, { backgroundColor: colors.glassBackground, borderColor: colors.separator }]}>
                <View style={[styles.highlightIcon, { backgroundColor: '#FF9500' + '18' }]}>
                  <IconSymbol name="flame.fill" size={16} color="#FF9500" />
                </View>
                <View>
                  <ThemedText style={[styles.highlightLabel, { color: colors.textSecondary }]}>
                    Longest Streak
                  </ThemedText>
                  <ThemedText style={styles.highlightValue}>
                    {stats.longestStreak} day{stats.longestStreak === 1 ? '' : 's'}
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Summary Cards */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
            Overview
          </ThemedText>
          <View style={styles.summaryGrid}>
            <SummaryCard
              icon="flame.fill"
              iconColor="#FF9500"
              label="Current Streak"
              value={stats?.currentStreak || 0}
              unit="days"
              colors={colors}
            />
            <SummaryCard
              icon="figure.strengthtraining.traditional"
              iconColor="#007AFF"
              label="Total Workouts"
              value={stats?.totalWorkouts || 0}
              colors={colors}
            />
            <SummaryCard
              icon="trophy.fill"
              iconColor="#FFD60A"
              label="PRs This Month"
              value={stats?.prsThisMonth || 0}
              colors={colors}
            />
            <SummaryCard
              icon="chart.line.uptrend.xyaxis"
              iconColor="#30D158"
              label="Exercises Tracked"
              value={stats?.totalExercises || 0}
              colors={colors}
            />
          </View>
        </View>

        {/* Recent PRs */}
        {recentPRs.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
              Recent PRs
            </ThemedText>
            <View style={[styles.prList, { backgroundColor: colors.glassBackground }]}>
              {recentPRs.slice(0, 5).map((pr, index) => (
                <View
                  key={`${pr.id}-${index}`}
                  style={[
                    styles.prItem,
                    index < recentPRs.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.separator,
                    },
                  ]}
                >
                  <View style={styles.prIcon}>
                    <IconSymbol name="trophy.fill" size={20} color="#FFD60A" />
                  </View>
                  <View style={styles.prInfo}>
                    <ThemedText style={[styles.prExercise, { color: colors.text }]}>
                      {pr.exerciseName}
                    </ThemedText>
                    <ThemedText style={[styles.prValue, { color: colors.textSecondary }]}>
                      {formatPR(pr)} • {getPRTypeName(pr.recordType)}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.prDate, { color: colors.textTertiary }]}>
                    {formatRelativeDate(pr.achievedAt)}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Exercise Progress */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
            Your Progress
          </ThemedText>
          {topExercises.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.glassBackground }]}>
              <IconSymbol name="chart.bar.fill" size={48} color={colors.textTertiary} />
              <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
                No data yet
              </ThemedText>
              <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Complete some workouts to see your progress
              </ThemedText>
            </View>
          ) : (
            <View style={styles.exerciseList}>
              {topExercises.map(exercise => (
                <ExerciseCard
                  key={exercise.exerciseName}
                  exercise={exercise}
                  colors={colors}
                  onPress={() => handleExerciseTap(exercise)}
                />
              ))}
            </View>
          )}
        </View>
        </ScrollView>
      </Screen>
    </SwipeTabs>
  );
}

// ============================================
// Components
// ============================================

function SummaryCard({
  icon,
  iconColor,
  label,
  value,
  unit,
  colors,
}: {
  icon: string;
  iconColor: string;
  label: string;
  value: number;
  unit?: string;
  colors: (typeof Colors)['light'];
}) {
  return (
    <View style={[styles.summaryCard, { backgroundColor: colors.glassBackground }]}>
      <View style={[styles.summaryIcon, { backgroundColor: `${iconColor}20` }]}>
        <IconSymbol name={icon as any} size={22} color={iconColor} />
      </View>
      <View style={styles.summaryContent}>
        <ThemedText style={[styles.summaryValue, { color: colors.text }]}>
          {value.toLocaleString()}
          {unit && <ThemedText style={styles.summaryUnit}> {unit}</ThemedText>}
        </ThemedText>
        <ThemedText style={[styles.summaryLabel, { color: colors.textSecondary }]}>
          {label}
        </ThemedText>
      </View>
    </View>
  );
}

function ExerciseCard({
  exercise,
  colors,
  onPress,
}: {
  exercise: ExerciseStats;
  colors: (typeof Colors)['light'];
  onPress: () => void;
}) {
  const currentPR = exercise.currentPRs.oneRepMax;
  const trend = useMemo(() => {
    if (exercise.progressData.length < 2) return null;
    const recent = exercise.progressData.slice(-5);
    const first = recent[0].maxWeight;
    const last = recent[recent.length - 1].maxWeight;
    return last - first;
  }, [exercise.progressData]);

  return (
    <Pressable
      style={[styles.exerciseCard, { backgroundColor: colors.glassBackground }]}
      onPress={onPress}
    >
      <View style={styles.exerciseHeader}>
        <View style={styles.exerciseInfo}>
          <ThemedText style={[styles.exerciseName, { color: colors.text }]}>
            {exercise.exerciseName}
          </ThemedText>
          <ThemedText style={[styles.exerciseMeta, { color: colors.textSecondary }]}>
            {exercise.totalSets} sets • Last: {formatRelativeDate(exercise.lastPerformed)}
          </ThemedText>
        </View>
        {currentPR && (
          <View style={styles.prBadge}>
            <IconSymbol name="trophy.fill" size={14} color="#FFD60A" />
            <ThemedText style={[styles.prBadgeText, { color: colors.text }]}>
              {currentPR.value} lb
            </ThemedText>
          </View>
        )}
      </View>

      {/* Mini sparkline representation */}
      <View style={styles.sparklineContainer}>
        {exercise.progressData.length > 1 && (
          <View style={styles.sparkline}>
            {exercise.progressData.slice(-10).map((point, i, arr) => {
              const maxWeight = Math.max(...arr.map(p => p.maxWeight));
              const minWeight = Math.min(...arr.map(p => p.maxWeight));
              const range = maxWeight - minWeight || 1;
              const height = ((point.maxWeight - minWeight) / range) * 30 + 5;
              return (
                <View
                  key={i}
                  style={[
                    styles.sparklineBar,
                    {
                      height,
                      backgroundColor: i === arr.length - 1 ? colors.tint : colors.separator,
                    },
                  ]}
                />
              );
            })}
          </View>
        )}
        {trend !== null && (
          <View style={styles.trendBadge}>
            <IconSymbol
              name={trend >= 0 ? 'arrow.up' : 'arrow.down'}
              size={12}
              color={trend >= 0 ? '#30D158' : '#FF453A'}
            />
            <ThemedText
              style={[
                styles.trendText,
                { color: trend >= 0 ? '#30D158' : '#FF453A' },
              ]}
            >
              {Math.abs(trend)} lb
            </ThemedText>
          </View>
        )}
      </View>

      <View style={styles.exerciseArrow}>
        <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
      </View>
    </Pressable>
  );
}

// ============================================
// Helpers
// ============================================

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.subhead,
  },

  // Sections
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.headline,
    marginBottom: Spacing.xs,
  },
  highlightsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  highlightCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  highlightIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightLabel: {
    ...Typography.caption2,
  },
  highlightValue: {
    ...Typography.subhead,
    fontWeight: '600',
  },

  // Summary Cards
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  summaryCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryContent: {
    flex: 1,
  },
  summaryValue: {
    ...Typography.title2,
    fontWeight: '700',
  },
  summaryUnit: {
    ...Typography.subhead,
    fontWeight: '400',
  },
  summaryLabel: {
    ...Typography.caption1,
  },

  // PR List
  prList: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  prItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  prIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: '#FFD60A20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  prInfo: {
    flex: 1,
  },
  prExercise: {
    ...Typography.subhead,
    fontWeight: '600',
  },
  prValue: {
    ...Typography.caption1,
  },
  prDate: {
    ...Typography.caption2,
  },

  // Exercise Cards
  exerciseList: {
    gap: Spacing.sm,
  },
  exerciseCard: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    ...Typography.headline,
  },
  exerciseMeta: {
    ...Typography.caption1,
    marginTop: 2,
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFD60A20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  prBadgeText: {
    ...Typography.caption1,
    fontWeight: '600',
  },

  // Sparkline
  sparklineContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  sparkline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 40,
    gap: 3,
  },
  sparklineBar: {
    width: 6,
    borderRadius: 2,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trendText: {
    ...Typography.caption1,
    fontWeight: '600',
  },
  exerciseArrow: {
    position: 'absolute',
    right: Spacing.md,
    top: '50%',
    marginTop: -8,
  },

  // Empty State
  emptyState: {
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.headline,
    marginTop: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.subhead,
    textAlign: 'center',
  },
});
