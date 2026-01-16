import { Tabs, useRouter, useSegments } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { ProfileButton } from '@/components/auth/profile-button';
import { QuickEntryModal } from '@/components/quick-entry-modal';
import { ResumeMiniBar } from '@/components/workout/resume-mini-bar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/context/auth-context';
import { getModeColors, ModeProvider, useMode } from '@/lib/context/mode-context';
import { usePendingWorkout } from '@/lib/hooks';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 64;
const RESUME_BAR_OFFSET = TAB_BAR_HEIGHT + 8;

function TabLayoutContent() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const [quickEntryVisible, setQuickEntryVisible] = useState(false);
  const { isCoach } = useAuth();
  const router = useRouter();
  const { pendingWorkout, discardPendingWorkout, refreshPendingWorkout } = usePendingWorkout();
  const segments = useSegments();
  const segmentKey = segments.join('/');

  // Get mode for tab bar color theming (does not hide tabs)
  const { mode } = useMode();
  const modeColors = getModeColors(mode, isDark);


  useEffect(() => {
    refreshPendingWorkout().catch(() => {});
  }, [refreshPendingWorkout, segmentKey]);

  return (
    <>
      <Tabs
      screenOptions={{
        // Mode-aware tab bar colors (blue in HOME, red in GYM, grey in JURY)
        tabBarActiveTintColor: modeColors.tabBarActive,
        tabBarInactiveTintColor: modeColors.tabBarInactive,
        headerShown: true,
        headerTitleStyle: {
          ...Typography.headline,
          color: colors.text,
        },
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: colors.groupedBackground,
        },
        tabBarStyle: {
          backgroundColor: colors.glassBackground,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          ...Typography.caption2,
          marginTop: 2,
        },
        tabBarButton: HapticTab,
      }}>
      {/* ===== TAB 1: WORKOUT / MY PROGRAMS ===== */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Workout',
          headerRight: () => (
            <View style={styles.headerActions}>
              <ProfileButton />
            </View>
          ),
          headerRightContainerStyle: { paddingRight: 16 },
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={focused ? 26 : 24}
              name="figure.strengthtraining.traditional"
              color={color}
            />
          ),
        }}
      />

      {/* ===== TAB 2: HISTORY ===== */}
      <Tabs.Screen
        name="explore"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={focused ? 26 : 24}
              name="clock.arrow.circlepath"
              color={color}
            />
          ),
        }}
      />

      {/* ===== TAB 3: PROGRESS ===== */}
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={focused ? 26 : 24}
              name="chart.line.uptrend.xyaxis"
              color={color}
            />
          ),
        }}
      />

      {/* ===== TAB 4: YOU - profile + settings + achievements ===== */}
      <Tabs.Screen
        name="you"
        options={{
          title: 'You',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={focused ? 26 : 24}
              name="person.circle"
              color={color}
            />
          ),
        }}
      />

      {/* ===== COACH: Only visible for coaches (both layouts) ===== */}
      <Tabs.Screen
        name="coach"
        options={{
          title: 'Coach',
          href: isCoach ? '/(tabs)/coach' : null, // Hide for non-coaches
          headerRight: () => <ProfileButton />,
          headerRightContainerStyle: { paddingRight: 16 },
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={focused ? 26 : 24}
              name="person.badge.shield.checkmark.fill"
              color={color}
            />
          ),
        }}
      />
      </Tabs>

    {/* Quick Entry Modal - Global access */}
      <QuickEntryModal
        visible={quickEntryVisible}
        onClose={() => setQuickEntryVisible(false)}
        recentWorkouts={[]}
      />

      {pendingWorkout && (
        <View style={styles.resumeBarWrapper} pointerEvents="box-none">
          <ResumeMiniBar
            pendingWorkout={pendingWorkout}
            onResume={() => {
              if (pendingWorkout.source === 'assigned') {
                const assignedId = pendingWorkout.assignedWorkoutId ?? pendingWorkout.workoutKey;
                router.push(`/workout/${assignedId}?source=assigned&assignedWorkoutId=${assignedId}` as any);
                return;
              }
              const programId = pendingWorkout.programId ?? pendingWorkout.workoutKey;
              router.push(`/workout/${programId}?source=self` as any);
            }}
            onDiscard={discardPendingWorkout}
          />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  resumeBarWrapper: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    bottom: RESUME_BAR_OFFSET,
    zIndex: 20,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
});

// Wrap with ModeProvider to enable mode-aware theming
export default function TabLayout() {
  return (
    <ModeProvider>
      <TabLayoutContent />
    </ModeProvider>
  );
}
