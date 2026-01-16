/**
 * Exercise Progress Chart Component
 *
 * Full-screen line chart showing weight progression over time
 * with PR markers and time range selector.
 */

import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  formatPR,
  getProgressInRange,
  TIME_RANGES,
  type ExerciseStats,
  type TimeRange
} from '@/lib/services/stats';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48;

interface ExerciseProgressChartProps {
  exercise: ExerciseStats;
  onClose: () => void;
}

export function ExerciseProgressChart({
  exercise,
  onClose,
}: ExerciseProgressChartProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';

  const [selectedRange, setSelectedRange] = useState<TimeRange['value']>('3M');

  // Filter progress data by selected range
  const filteredData = useMemo(() => {
    return getProgressInRange(exercise, selectedRange);
  }, [exercise, selectedRange]);

  // Transform data for chart
  const chartData = useMemo(() => {
    if (filteredData.length === 0) return [];

    return filteredData.map((point, index) => ({
      value: point.maxWeight,
      dataPointText: index === filteredData.length - 1 ? `${point.maxWeight}` : undefined,
      label: formatChartDate(point.date, filteredData.length),
      date: point.date,
      volume: point.totalVolume,
    }));
  }, [filteredData]);

  // Calculate stats for the selected range
  const rangeStats = useMemo(() => {
    if (filteredData.length < 2) return null;

    const first = filteredData[0];
    const last = filteredData[filteredData.length - 1];
    const change = last.maxWeight - first.maxWeight;
    const percentChange = ((change / first.maxWeight) * 100).toFixed(1);
    const maxInRange = Math.max(...filteredData.map(d => d.maxWeight));
    const totalVolume = filteredData.reduce((sum, d) => sum + d.totalVolume, 0);

    return {
      change,
      percentChange,
      maxInRange,
      totalVolume,
      sessions: filteredData.length,
    };
  }, [filteredData]);

  const handleRangeChange = useCallback((range: TimeRange['value']) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedRange(range);
  }, []);

  const currentPR = exercise.currentPRs.oneRepMax;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing.sm,
            backgroundColor: colors.background,
            borderBottomColor: colors.separator,
          },
        ]}
      >
        <Pressable onPress={onClose} style={styles.closeButton}>
          <IconSymbol name="chevron.left" size={24} color={colors.tint} />
          <ThemedText style={[styles.backText, { color: colors.tint }]}>
            Stats
          </ThemedText>
        </Pressable>
        <View style={styles.headerTitle}>
          <ThemedText style={[styles.exerciseTitle, { color: colors.text }]}>
            {exercise.exerciseName}
          </ThemedText>
        </View>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* PR Badge */}
        {currentPR && (
          <View style={[styles.prBanner, { backgroundColor: '#FFD60A20' }]}>
            <IconSymbol name="trophy.fill" size={24} color="#FFD60A" />
            <View style={styles.prBannerContent}>
              <ThemedText style={[styles.prBannerLabel, { color: colors.textSecondary }]}>
                Personal Best (Est. 1RM)
              </ThemedText>
              <ThemedText style={[styles.prBannerValue, { color: colors.text }]}>
                {currentPR.value} lb
              </ThemedText>
            </View>
          </View>
        )}

        {/* Time Range Selector */}
        <View style={styles.rangeSelector}>
          {TIME_RANGES.map(range => (
            <Pressable
              key={range.value}
              style={[
                styles.rangeButton,
                selectedRange === range.value && {
                  backgroundColor: colors.tint,
                },
              ]}
              onPress={() => handleRangeChange(range.value)}
            >
              <ThemedText
                style={[
                  styles.rangeButtonText,
                  {
                    color:
                      selectedRange === range.value
                        ? '#FFFFFF'
                        : colors.textSecondary,
                  },
                ]}
              >
                {range.value}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {/* Chart */}
        {chartData.length > 1 ? (
          <View style={[styles.chartContainer, { backgroundColor: colors.glassBackground }]}>
            <LineChart
              data={chartData as any}
              width={CHART_WIDTH - 40}
              height={220}
              spacing={Math.max(20, (CHART_WIDTH - 80) / chartData.length)}
              initialSpacing={20}
              endSpacing={20}
              color={colors.tint}
              thickness={2}
              startFillColor={`${colors.tint}40`}
              endFillColor={`${colors.tint}10`}
              startOpacity={0.4}
              endOpacity={0.1}
              areaChart
              curved
              hideDataPoints={chartData.length > 15}
              dataPointsColor={colors.tint}
              dataPointsRadius={4}
              xAxisColor={colors.separator}
              yAxisColor={colors.separator}
              yAxisTextStyle={{
                color: colors.textTertiary,
                fontSize: 10,
              }}
              xAxisLabelTextStyle={{
                color: colors.textTertiary,
                fontSize: 9,
              }}
              noOfSections={4}
              rulesColor={colors.separator}
              rulesType="solid"
            />
          </View>
        ) : (
          <View style={[styles.noDataContainer, { backgroundColor: colors.glassBackground }]}>
            <IconSymbol name="chart.bar.fill" size={48} color={colors.textTertiary} />
            <ThemedText style={[styles.noDataText, { color: colors.textSecondary }]}>
              Not enough data for this time range
            </ThemedText>
          </View>
        )}

        {/* Range Stats */}
        {rangeStats && (
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: colors.glassBackground }]}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                Change
              </ThemedText>
              <ThemedText
                style={[
                  styles.statValue,
                  { color: rangeStats.change >= 0 ? '#30D158' : '#FF453A' },
                ]}
              >
                {rangeStats.change >= 0 ? '+' : ''}
                {rangeStats.change} lb
              </ThemedText>
              <ThemedText style={[styles.statSubtext, { color: colors.textTertiary }]}>
                {rangeStats.percentChange}%
              </ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.glassBackground }]}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                Max Weight
              </ThemedText>
              <ThemedText style={[styles.statValue, { color: colors.text }]}>
                {rangeStats.maxInRange} lb
              </ThemedText>
              <ThemedText style={[styles.statSubtext, { color: colors.textTertiary }]}>
                in range
              </ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.glassBackground }]}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                Sessions
              </ThemedText>
              <ThemedText style={[styles.statValue, { color: colors.text }]}>
                {rangeStats.sessions}
              </ThemedText>
              <ThemedText style={[styles.statSubtext, { color: colors.textTertiary }]}>
                workouts
              </ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.glassBackground }]}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                Total Volume
              </ThemedText>
              <ThemedText style={[styles.statValue, { color: colors.text }]}>
                {(rangeStats.totalVolume / 1000).toFixed(1)}k
              </ThemedText>
              <ThemedText style={[styles.statSubtext, { color: colors.textTertiary }]}>
                lbs lifted
              </ThemedText>
            </View>
          </View>
        )}

        {/* PR History */}
        {exercise.prHistory.length > 0 && (
          <View style={styles.prHistorySection}>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
              PR History
            </ThemedText>
            <View style={[styles.prHistoryList, { backgroundColor: colors.glassBackground }]}>
              {exercise.prHistory
                .filter(pr => pr.recordType === 'ONE_REP_MAX')
                .slice(0, 5)
                .map((pr, index, arr) => (
                  <View
                    key={`${pr.id}-${index}`}
                    style={[
                      styles.prHistoryItem,
                      index < arr.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.separator,
                      },
                    ]}
                  >
                    <View style={styles.prHistoryIcon}>
                      <IconSymbol name="trophy.fill" size={16} color="#FFD60A" />
                    </View>
                    <ThemedText style={[styles.prHistoryValue, { color: colors.text }]}>
                      {formatPR(pr)}
                    </ThemedText>
                    <ThemedText style={[styles.prHistoryDate, { color: colors.textTertiary }]}>
                      {new Date(pr.achievedAt).toLocaleDateString()}
                    </ThemedText>
                  </View>
                ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ============================================
// Helpers
// ============================================

function formatChartDate(dateStr: string, totalPoints: number): string {
  const date = new Date(dateStr);
  if (totalPoints <= 7) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'short' });
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 80,
  },
  backText: {
    ...Typography.body,
  },
  headerTitle: {
    flex: 1,
    alignItems: 'center',
  },
  exerciseTitle: {
    ...Typography.headline,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.lg,
  },

  // PR Banner
  prBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    gap: Spacing.sm,
  },
  prBannerContent: {
    flex: 1,
  },
  prBannerLabel: {
    ...Typography.caption1,
  },
  prBannerValue: {
    ...Typography.title1,
    fontWeight: '700',
  },

  // Range Selector
  rangeSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  rangeButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  rangeButtonText: {
    ...Typography.caption1,
    fontWeight: '600',
  },

  // Chart
  chartContainer: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  noDataContainer: {
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  noDataText: {
    ...Typography.subhead,
    textAlign: 'center',
  },
  pointerLabel: {
    padding: Spacing.sm,
    borderRadius: Radius.md,
    ...Shadows.sm,
  },
  pointerValue: {
    ...Typography.headline,
    fontWeight: '700',
  },
  pointerDate: {
    ...Typography.caption2,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statCard: {
    width: '48%',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
    ...Shadows.sm,
  },
  statLabel: {
    ...Typography.caption1,
  },
  statValue: {
    ...Typography.title2,
    fontWeight: '700',
    marginTop: 2,
  },
  statSubtext: {
    ...Typography.caption2,
  },

  // PR History
  prHistorySection: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.headline,
  },
  prHistoryList: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  prHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  prHistoryIcon: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: '#FFD60A20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  prHistoryValue: {
    flex: 1,
    ...Typography.subhead,
    fontWeight: '600',
  },
  prHistoryDate: {
    ...Typography.caption1,
  },
});
