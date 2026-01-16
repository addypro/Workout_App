/**
 * Settings Content
 *
 * Reusable settings UI for both the Settings screen and the You tab.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { PDFImportModal, StrongImportModal } from '@/components/import';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { isFeatureEnabled } from '@/lib/config/feature-flags';
import { useAuth, useUserId } from '@/lib/context/auth-context';
import { usePreferences } from '@/lib/context/preferences-context';
import { getWorkoutStats } from '@/lib/db/storage';
import { calculateStats } from '@/lib/services/stats';

type AchievementStats = {
  totalWorkouts: number;
  thisWeek: number;
  thisMonth: number;
  currentStreak: number;
  longestStreak: number;
  totalDurationMinutes: number;
  prsThisMonth: number;
};

export function SettingsContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, isGuest, isCoach, signOut } = useAuth();
  const userId = useUserId();
  const { weightUnit, setWeightUnit } = usePreferences();
  const [showImportModal, setShowImportModal] = useState(false);
  const [showPDFImportModal, setShowPDFImportModal] = useState(false);
  const [achievementStats, setAchievementStats] = useState<AchievementStats | null>(null);
  const [achievementLoading, setAchievementLoading] = useState(false);

  const showAchievements = isFeatureEnabled('new_tab_bar');

  const isMetric = weightUnit === 'kg';

  const handleUnitToggle = (value: boolean) => {
    setWeightUnit(value ? 'kg' : 'lbs');
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]
    );
  };

  useEffect(() => {
    if (!showAchievements) return;
    let cancelled = false;

    const loadAchievements = async () => {
      setAchievementLoading(true);
      try {
        const [workoutStats, snapshot] = await Promise.all([
          getWorkoutStats(userId),
          calculateStats(userId).catch((error) => {
            console.error('[Settings] Failed to load PR stats:', error);
            return null;
          }),
        ]);
        if (!cancelled) {
          setAchievementStats({
            ...workoutStats,
            currentStreak: snapshot?.currentStreak ?? workoutStats.currentStreak,
            longestStreak: snapshot?.longestStreak ?? workoutStats.currentStreak,
            prsThisMonth: snapshot?.prsThisMonth ?? 0,
          });
        }
      } catch (error) {
        console.error('[Settings] Failed to load achievements:', error);
        if (!cancelled) {
          setAchievementStats(null);
        }
      } finally {
        if (!cancelled) {
          setAchievementLoading(false);
        }
      }
    };

    loadAchievements();
    return () => {
      cancelled = true;
    };
  }, [userId, showAchievements]);

  return (
    <>
      <Screen>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Account Section */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Account
            </ThemedText>
            <Card padding="sm">
              <View style={[styles.row, { borderBottomColor: colors.separator }]}>
                <View style={styles.rowContent}>
                  <IconSymbol name="person.fill" size={20} color={colors.tint} />
                  <View style={styles.rowText}>
                    <ThemedText style={styles.rowLabel}>Email</ThemedText>
                    <ThemedText style={[styles.rowValue, { color: colors.textSecondary }]}>
                      {isGuest ? 'Guest Mode' : user?.email || 'Not signed in'}
                    </ThemedText>
                  </View>
                </View>
              </View>
              {isCoach && (
                <Pressable
                  style={({ pressed }) => [
                    styles.row,
                    { borderBottomWidth: 0, opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={() => router.push('/(tabs)/coach')}
                >
                  <View style={styles.rowContent}>
                    <IconSymbol name="person.badge.shield.checkmark.fill" size={20} color={colors.tint} />
                    <View style={styles.rowText}>
                      <ThemedText style={styles.rowLabel}>Coach Dashboard</ThemedText>
                      <ThemedText style={[styles.rowValue, { color: colors.textSecondary }]}>
                        Manage athletes and assignments
                      </ThemedText>
                    </View>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
                </Pressable>
              )}
            </Card>
          </View>

          {/* Preferences Section */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Preferences
            </ThemedText>
            <Card padding="sm">
              <View style={[styles.row, { borderBottomColor: colors.separator }]}>
                <View style={styles.rowContent}>
                  <IconSymbol name="scalemass.fill" size={20} color="#FF9500" />
                  <View style={styles.rowText}>
                    <ThemedText style={styles.rowLabel}>Use Metric (kg)</ThemedText>
                    <ThemedText style={[styles.rowValue, { color: colors.textSecondary }]}>
                      Currently using {weightUnit}
                    </ThemedText>
                  </View>
                </View>
                <Switch
                  value={isMetric}
                  onValueChange={handleUnitToggle}
                  trackColor={{ false: colors.separator, true: colors.tint }}
                />
              </View>

              {/* Voice Processing */}
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: colors.separator, opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={() => router.push('/settings/voice')}
              >
                <View style={styles.rowContent}>
                  <IconSymbol name="mic.fill" size={20} color="#5DADE2" />
                  <View style={styles.rowText}>
                    <ThemedText style={styles.rowLabel}>Voice Processing</ThemedText>
                    <ThemedText style={[styles.rowValue, { color: colors.textSecondary }]}>
                      Cloud speech recognition
                    </ThemedText>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
              </Pressable>
            </Card>
          </View>

          {/* Data Section */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Data
            </ThemedText>
            <Card padding="sm">
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: colors.separator, opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={() => setShowImportModal(true)}
              >
                <View style={styles.rowContent}>
                  <IconSymbol name="doc.text" size={20} color="#34C759" />
                  <View style={styles.rowText}>
                    <ThemedText style={styles.rowLabel}>Import Workout History</ThemedText>
                    <ThemedText style={[styles.rowValue, { color: colors.textSecondary }]}>
                      From Strong or Hevy App
                    </ThemedText>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
              </Pressable>

              {/* Program Import */}
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: colors.separator, opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={() => router.push('/(tabs)/tools')}
              >
                <View style={styles.rowContent}>
                  <IconSymbol name="square.and.arrow.down" size={20} color="#0A84FF" />
                  <View style={styles.rowText}>
                    <ThemedText style={styles.rowLabel}>Import Programs</ThemedText>
                    <ThemedText style={[styles.rowValue, { color: colors.textSecondary }]}>
                      CSV, Excel, or PDF templates
                    </ThemedText>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
              </Pressable>

              {/* PDF Import */}
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: colors.separator, opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={() => setShowPDFImportModal(true)}
              >
                <View style={styles.rowContent}>
                  <IconSymbol name="doc.text" size={20} color="#FF9500" />
                  <View style={styles.rowText}>
                    <ThemedText style={styles.rowLabel}>Import Program PDF</ThemedText>
                    <ThemedText style={[styles.rowValue, { color: colors.textSecondary }]}>
                      Extract from fitness program PDFs
                    </ThemedText>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
              </Pressable>
            </Card>
          </View>

          {showAchievements && (
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                Achievements
              </ThemedText>
              {achievementLoading ? (
                <Card padding="sm">
                  <View style={styles.achievementLoading}>
                    <ActivityIndicator size="small" color={colors.tint} />
                    <ThemedText style={[styles.achievementLoadingText, { color: colors.textSecondary }]}>
                      Loading achievements...
                    </ThemedText>
                  </View>
                </Card>
              ) : achievementStats && achievementStats.totalWorkouts > 0 ? (
                <View style={styles.achievementGrid}>
                  <Card style={styles.achievementCard} padding="sm">
                    <View style={styles.achievementHeader}>
                      <View style={[styles.achievementIcon, { backgroundColor: '#FF9500' + '20' }]}>
                        <IconSymbol name="flame.fill" size={16} color="#FF9500" />
                      </View>
                      <ThemedText style={styles.achievementValue}>
                        {achievementStats.currentStreak}
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.achievementLabel, { color: colors.textSecondary }]}>
                      Day Streak
                    </ThemedText>
                  </Card>

                  <Card style={styles.achievementCard} padding="sm">
                    <View style={styles.achievementHeader}>
                      <View style={[styles.achievementIcon, { backgroundColor: '#FFD60A' + '20' }]}>
                        <IconSymbol name="star.fill" size={16} color="#FFD60A" />
                      </View>
                      <ThemedText style={styles.achievementValue}>
                        {achievementStats.longestStreak}
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.achievementLabel, { color: colors.textSecondary }]}>
                      Longest Streak
                    </ThemedText>
                  </Card>

                  <Card style={styles.achievementCard} padding="sm">
                    <View style={styles.achievementHeader}>
                      <View style={[styles.achievementIcon, { backgroundColor: colors.tint + '20' }]}>
                        <IconSymbol name="calendar" size={16} color={colors.tint} />
                      </View>
                      <ThemedText style={styles.achievementValue}>
                        {achievementStats.thisMonth}
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.achievementLabel, { color: colors.textSecondary }]}>
                      This Month
                    </ThemedText>
                  </Card>

                  <Card style={styles.achievementCard} padding="sm">
                    <View style={styles.achievementHeader}>
                      <View style={[styles.achievementIcon, { backgroundColor: '#FFD60A' + '20' }]}>
                        <IconSymbol name="trophy.fill" size={16} color="#FFD60A" />
                      </View>
                      <ThemedText style={styles.achievementValue}>
                        {achievementStats.prsThisMonth}
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.achievementLabel, { color: colors.textSecondary }]}>
                      PRs This Month
                    </ThemedText>
                  </Card>

                  <Card style={styles.achievementCard} padding="sm">
                    <View style={styles.achievementHeader}>
                      <View style={[styles.achievementIcon, { backgroundColor: '#30D158' + '20' }]}>
                        <IconSymbol name="bolt.fill" size={16} color="#30D158" />
                      </View>
                      <ThemedText style={styles.achievementValue}>
                        {achievementStats.totalWorkouts}
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.achievementLabel, { color: colors.textSecondary }]}>
                      Total Workouts
                    </ThemedText>
                  </Card>

                  <Card style={styles.achievementCard} padding="sm">
                    <View style={styles.achievementHeader}>
                      <View style={[styles.achievementIcon, { backgroundColor: '#5856D6' + '20' }]}>
                        <IconSymbol name="clock.fill" size={16} color="#5856D6" />
                      </View>
                      <ThemedText style={styles.achievementValue}>
                        {Math.round(achievementStats.totalDurationMinutes / 60)}
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.achievementLabel, { color: colors.textSecondary }]}>
                      Total Hours
                    </ThemedText>
                  </Card>
                </View>
              ) : (
                <Card padding="sm">
                  <View style={styles.achievementEmpty}>
                    <IconSymbol name="trophy.fill" size={18} color={colors.textTertiary} />
                    <ThemedText style={[styles.achievementEmptyText, { color: colors.textSecondary }]}>
                      Complete a workout to unlock achievements.
                    </ThemedText>
                  </View>
                </Card>
              )}
            </View>
          )}

          {/* About Section */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              About
            </ThemedText>
            <Card padding="sm">
              <View style={[styles.row, { borderBottomColor: colors.separator }]}>
                <View style={styles.rowContent}>
                  <IconSymbol name="info.circle.fill" size={20} color="#5856D6" />
                  <View style={styles.rowText}>
                    <ThemedText style={styles.rowLabel}>Version</ThemedText>
                    <ThemedText style={[styles.rowValue, { color: colors.textSecondary }]}>
                      1.0.0
                    </ThemedText>
                  </View>
                </View>
              </View>
            </Card>
          </View>

          {/* Guest Actions - Single entry point to auth */}
          {isGuest && (
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                Account
              </ThemedText>
              <Card padding="sm">
                <Pressable
                  style={({ pressed }) => [
                    styles.row,
                    { borderBottomWidth: 0, opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={() => router.push('/(auth)/landing')}
                >
                  <View style={styles.rowContent}>
                    <IconSymbol name="person.badge.plus" size={20} color="#34C759" />
                    <View style={styles.rowText}>
                      <ThemedText style={styles.rowLabel}>Sign In or Create Account</ThemedText>
                      <ThemedText style={[styles.rowValue, { color: colors.textSecondary }]}>
                        Sync your data across devices
                      </ThemedText>
                    </View>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
                </Pressable>
              </Card>
            </View>
          )}

          {/* Sign Out Button - Only for authenticated users */}
          {!isGuest && user && (
            <View style={styles.section}>
              <Pressable
                style={({ pressed }) => [
                  styles.signOutButton,
                  { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={handleSignOut}
              >
                <ThemedText style={[styles.signOutText, { color: '#FF453A' }]}>
                  Sign Out
                </ThemedText>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </Screen>

      {/* Unified Import Modal - Handles both Strong and Hevy CSV */}
      <StrongImportModal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => {
          setShowImportModal(false);
          router.replace('/(tabs)/explore');
        }}
      />

      {/* PDF Import Modal */}
      <PDFImportModal
        visible={showPDFImportModal}
        onClose={() => setShowPDFImportModal(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.subhead,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    ...Typography.body,
  },
  rowValue: {
    ...Typography.caption1,
    marginTop: 2,
  },
  signOutButton: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  signOutText: {
    ...Typography.headline,
    fontWeight: '600',
  },
  achievementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  achievementCard: {
    flexGrow: 1,
    flexBasis: '48%',
  },
  achievementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  achievementIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementValue: {
    ...Typography.title3,
    fontWeight: '700',
  },
  achievementLabel: {
    ...Typography.caption1,
  },
  achievementEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  achievementEmptyText: {
    ...Typography.caption1,
  },
  achievementLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  achievementLoadingText: {
    ...Typography.caption1,
  },
});
