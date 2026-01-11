/**
 * Coach Tab
 *
 * Dashboard for coaches showing stats, quick actions, and athlete management.
 * This tab is only visible to users with the 'coach' role.
 *
 * Navigation uses unified routes:
 * - Quick Workout → /workout/quick (shared)
 * - Create Program → /(tabs) to access program creation (shared)
 * - Assign Program → /coach/assign-program (coach-specific)
 * - Invite Athletes → /coach/invite (coach-specific)
 * - My Athletes → /coach/athletes (coach-specific)
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Screen } from '@/components/screen';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { createProgram } from '@/lib/db/storage';
import {
  AthleteStatus,
  CoachAthlete,
  CoachDashboard,
  CoachProgram,
  getCoachDashboard,
  getMyAthletes
} from '@/lib/services/coach';

export default function CoachTabScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [dashboard, setDashboard] = useState<CoachDashboard | null>(null);
  const [recentAthletes, setRecentAthletes] = useState<CoachAthlete[]>([]);
  const [savedPrograms, setSavedPrograms] = useState<CoachProgram[]>([]);
  const [libraryTab, setLibraryTab] = useState<'programs' | 'quick'>('programs');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [dashResult, athletesResult, programsResult] = await Promise.all([
        getCoachDashboard(),
        getMyAthletes(AthleteStatus.ACTIVE, 1, 5),
        getMyPrograms(1, 10),
      ]);

      if (dashResult.success && dashResult.data) {
        setDashboard(dashResult.data);
      }

      if (athletesResult.success && athletesResult.data) {
        setRecentAthletes(athletesResult.data.data);
      }

      if (programsResult.success && programsResult.data) {
        setSavedPrograms(programsResult.data.data);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // Handler for creating a new program
  const handleCreateProgram = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const newProgram = await createProgram('New Program');
      router.push(`/program/${newProgram.id}/edit`);
    } catch (e) {
      console.error(e);
      const msg = 'Failed to create program';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    }
  };

  // Quick actions with unified navigation
  const quickActions = [
    {
      title: 'Quick Workout',
      subtitle: 'Start training now',
      icon: 'flash-outline',
      color: '#FF453A',
      onPress: () => router.push('/workout/quick'),
    },
    {
      title: 'Create Program',
      subtitle: 'Build a workout plan',
      icon: 'document-text-outline',
      color: '#FF9F0A',
      onPress: handleCreateProgram,
    },
    {
      title: 'Assign Program',
      subtitle: 'To athletes',
      icon: 'send-outline',
      color: colors.tint,
      onPress: () => router.push('/coach/assign-program' as any),
    },
    {
      title: 'Invite Athletes',
      subtitle: 'Share invite code',
      icon: 'person-add-outline',
      color: '#30D158',
      onPress: () => router.push('/coach/invite' as any),
    },
    {
      title: 'My Athletes',
      subtitle: 'View & manage',
      icon: 'people-outline',
      color: '#64D2FF',
      onPress: () => router.push('/coach/athletes' as any),
    },
    {
      title: 'Browse Programs',
      subtitle: 'Discover & adapt',
      icon: 'sparkles-outline',
      color: '#BF5AF2',
      onPress: () => router.push('/(tabs)/browse'),
    },
  ];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: Spacing.lg,
      paddingBottom: 100,
    },
    // Trial Banner
    trialBanner: {
      backgroundColor: colors.tint,
      padding: Spacing.lg,
      borderRadius: Radius.lg,
      marginBottom: Spacing.lg,
    },
    trialHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    trialTitle: {
      ...Typography.headline,
      color: '#FFFFFF',
      marginLeft: Spacing.sm,
    },
    trialText: {
      ...Typography.body,
      color: 'rgba(255,255,255,0.9)',
    },
    trialDays: {
      ...Typography.title2,
      color: '#FFFFFF',
      fontWeight: '700',
    },
    upgradeButton: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.md,
      marginTop: Spacing.md,
      alignSelf: 'flex-start',
    },
    upgradeButtonText: {
      ...Typography.subhead,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    // Stats Grid
    statsGrid: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginBottom: Spacing.lg,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.groupedBackground,
      padding: Spacing.lg,
      borderRadius: Radius.lg,
      alignItems: 'center',
    },
    statValue: {
      ...Typography.title1,
      color: colors.text,
      fontWeight: '700',
    },
    statLabel: {
      ...Typography.caption1,
      color: colors.textSecondary,
      marginTop: Spacing.xs,
    },
    statLimit: {
      ...Typography.caption2,
      color: colors.textTertiary,
    },
    // Quick Actions
    sectionTitle: {
      ...Typography.headline,
      color: colors.text,
      marginBottom: Spacing.md,
    },
    actionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
      marginBottom: Spacing.xl,
    },
    actionCard: {
      width: '47%',
      backgroundColor: colors.groupedBackground,
      padding: Spacing.lg,
      borderRadius: Radius.lg,
    },
    actionIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.sm,
    },
    actionTitle: {
      ...Typography.subhead,
      color: colors.text,
      fontWeight: '600',
    },
    actionSubtitle: {
      ...Typography.caption1,
      color: colors.textSecondary,
      marginTop: 2,
    },
    // Athletes Section
    athletesList: {
      backgroundColor: colors.groupedBackground,
      borderRadius: Radius.lg,
      overflow: 'hidden',
      marginBottom: Spacing.xl,
    },
    athleteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
    },
    athleteAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.tintMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
    },
    athleteInfo: {
      flex: 1,
    },
    athleteName: {
      ...Typography.subhead,
      color: colors.text,
      fontWeight: '600',
    },
    athleteStatus: {
      ...Typography.caption1,
      color: colors.textSecondary,
    },
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
    viewAllButton: {
      padding: Spacing.md,
      alignItems: 'center',
    },
    viewAllText: {
      ...Typography.subhead,
      color: colors.tint,
      fontWeight: '600',
    },
    // Library Section
    libraryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    libraryTabs: {
      flexDirection: 'row',
      backgroundColor: colors.groupedBackground,
      borderRadius: Radius.md,
      padding: 4,
      marginBottom: Spacing.md,
    },
    libraryTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.sm,
    },
    libraryTabActive: {
      backgroundColor: colors.background,
    },
    libraryTabText: {
      ...Typography.footnote,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    programsList: {
      backgroundColor: colors.groupedBackground,
      borderRadius: Radius.lg,
      overflow: 'hidden',
      marginBottom: Spacing.xl,
    },
    programCard: {
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
    },
    programCardContent: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
    },
    programIcon: {
      width: 40,
      height: 40,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
    },
    programInfo: {
      flex: 1,
    },
    programName: {
      ...Typography.subhead,
      color: colors.text,
      fontWeight: '600',
    },
    programMeta: {
      ...Typography.caption1,
      color: colors.textSecondary,
      marginTop: 2,
    },
    assignButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.tint + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyLibrary: {
      padding: Spacing.xl,
      alignItems: 'center',
    },
    emptyLibraryText: {
      ...Typography.subhead,
      color: colors.textSecondary,
      marginTop: Spacing.sm,
    },
    createLibraryButton: {
      marginTop: Spacing.md,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      backgroundColor: colors.tint,
      borderRadius: Radius.md,
    },
    createLibraryButtonText: {
      ...Typography.subhead,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    // Loading
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  if (isLoading && !dashboard) {
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
        {/* Trial Banner */}
        {dashboard?.subscriptionTier === 'trial' && dashboard.trialDaysRemaining !== undefined && (
          <View style={styles.trialBanner}>
            <View style={styles.trialHeader}>
              <Ionicons name="time-outline" size={24} color="#FFFFFF" />
              <Text style={styles.trialTitle}>Free Trial</Text>
            </View>
            <Text style={styles.trialText}>
              <Text style={styles.trialDays}>{dashboard.trialDaysRemaining} days</Text> remaining
            </Text>
            <TouchableOpacity style={styles.upgradeButton}>
              <Text style={styles.upgradeButtonText}>View Plans</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{dashboard?.currentAthleteCount || 0}</Text>
            <Text style={styles.statLabel}>Athletes</Text>
            <Text style={styles.statLimit}>of {dashboard?.maxAthletes || 50}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{dashboard?.totalPrograms || 0}</Text>
            <Text style={styles.statLabel}>Programs</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{dashboard?.activeAssignments || 0}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={styles.actionCard}
              onPress={action.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: action.color + '20' }]}>
                <Ionicons name={action.icon as any} size={24} color={action.color} />
              </View>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Saved Library Section */}
        <View style={styles.libraryHeader}>
          <Text style={styles.sectionTitle}>My Library</Text>
          <TouchableOpacity onPress={() => router.push('/coach/programs' as any)}>
            <Text style={[styles.viewAllText, { marginTop: 0 }]}>View All</Text>
          </TouchableOpacity>
        </View>

        {/* Library Tabs */}
        <View style={styles.libraryTabs}>
          <TouchableOpacity
            style={[styles.libraryTab, libraryTab === 'programs' && styles.libraryTabActive]}
            onPress={() => setLibraryTab('programs')}
          >
            <Ionicons
              name="document-text"
              size={16}
              color={libraryTab === 'programs' ? colors.tint : colors.textSecondary}
            />
            <Text style={[
              styles.libraryTabText,
              libraryTab === 'programs' && { color: colors.tint }
            ]}>Programs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.libraryTab, libraryTab === 'quick' && styles.libraryTabActive]}
            onPress={() => setLibraryTab('quick')}
          >
            <Ionicons
              name="flash"
              size={16}
              color={libraryTab === 'quick' ? colors.tint : colors.textSecondary}
            />
            <Text style={[
              styles.libraryTabText,
              libraryTab === 'quick' && { color: colors.tint }
            ]}>Quick Workouts</Text>
          </TouchableOpacity>
        </View>

        {/* Programs List */}
        {libraryTab === 'programs' ? (
          <View style={styles.programsList}>
            {savedPrograms.length > 0 ? (
              savedPrograms.slice(0, 3).map((program) => (
                <TouchableOpacity
                  key={program.id}
                  style={styles.programCard}
                  onPress={() => router.push(`/coach/programs/builder?id=${program.id}` as any)}
                >
                  <View style={styles.programCardContent}>
                    <View style={[styles.programIcon, { backgroundColor: colors.tint + '15' }]}>
                      <Ionicons name="barbell" size={20} color={colors.tint} />
                    </View>
                    <View style={styles.programInfo}>
                      <Text style={styles.programName} numberOfLines={1}>{program.name}</Text>
                      <Text style={styles.programMeta}>
                        {program.durationWeeks ? `${program.durationWeeks} weeks` : 'Custom'} • {program.daysPerWeek || 3}x/week
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.assignButton}
                      onPress={() => router.push(`/coach/assign-program?programId=${program.id}` as any)}
                    >
                      <Ionicons name="send" size={16} color={colors.tint} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyLibrary}>
                <Ionicons name="folder-open-outline" size={40} color={colors.textTertiary} />
                <Text style={styles.emptyLibraryText}>No saved programs yet</Text>
                <TouchableOpacity
                  style={styles.createLibraryButton}
                  onPress={handleCreateProgram}
                >
                  <Text style={styles.createLibraryButtonText}>Create Program</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.programsList}>
            <View style={styles.emptyLibrary}>
              <Ionicons name="flash-outline" size={40} color={colors.textTertiary} />
              <Text style={styles.emptyLibraryText}>No quick workouts yet</Text>
              <TouchableOpacity
                style={styles.createLibraryButton}
                onPress={() => router.push('/coach/quick-workout' as any)}
              >
                <Text style={styles.createLibraryButtonText}>Create Quick Workout</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Recent Athletes */}
        <Text style={styles.sectionTitle}>Recent Athletes</Text>
        <View style={styles.athletesList}>
          {recentAthletes.length > 0 ? (
            <>
              {recentAthletes.map((athlete, index) => (
                <TouchableOpacity
                  key={athlete.id}
                  style={[
                    styles.athleteRow,
                    index === recentAthletes.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => router.push(`/coach/athlete/${athlete.athleteUserId}` as any)}
                >
                  <View style={styles.athleteAvatar}>
                    <Ionicons name="person" size={20} color={colors.tint} />
                  </View>
                  <View style={styles.athleteInfo}>
                    <Text style={styles.athleteName}>
                      {athlete.athleteName || 'Athlete'}
                    </Text>
                    <Text style={styles.athleteStatus}>
                      Joined {athlete.joinedAt?.toLocaleDateString() || 'recently'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={() => router.push('/coach/athletes' as any)}
              >
                <Text style={styles.viewAllText}>View All Athletes</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>
                No athletes yet.{'\n'}Invite your first athlete to get started!
              </Text>
              <TouchableOpacity
                style={[styles.upgradeButton, { backgroundColor: colors.tint, marginTop: Spacing.md }]}
                onPress={() => router.push('/coach/invite' as any)}
              >
                <Text style={styles.upgradeButtonText}>Invite Athletes</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
