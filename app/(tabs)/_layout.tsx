import { Tabs, useRouter, useSegments } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ProfileButton } from '@/components/auth/profile-button';
import { QuickEntryModal } from '@/components/quick-entry-modal';
import { ExpandableFAB } from '@/components/expandable-fab';
import { ContextPills } from '@/components/breadcrumb-nav';
import { ResumeMiniBar } from '@/components/workout/resume-mini-bar';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useContextPills } from '@/lib/context/tab-context';
import { useAuth } from '@/lib/context/auth-context';
import { getModeColors, ModeProvider, useMode } from '@/lib/context/mode-context';
import { isFeatureEnabled } from '@/lib/config/feature-flags';
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

  // P0 UX Redesign: 4-tab layout
  const useNewTabBar = isFeatureEnabled('new_tab_bar');

  // Get mode for tab bar color theming (does not hide tabs)
  const { mode } = useMode();
  const modeColors = getModeColors(mode, isDark);

  // Get context pills for current tab
  const { pills, clearAll } = useContextPills();

  const handleQuickEntry = useCallback(() => {
    setQuickEntryVisible(true);
  }, []);

  const handleBrowsePrograms = useCallback(() => {
    router.push('/(tabs)/browse');
  }, [router]);

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
          title: useNewTabBar ? 'Workout' : 'My Programs',
          headerRight: () => (
            useNewTabBar ? (
              <View style={styles.headerRight}>
                <Pressable
                  style={({ pressed }) => [
                    styles.browseButton,
                    {
                      backgroundColor: colors.tint + '12',
                      borderColor: colors.tint + '40',
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                  hitSlop={10}
                  onPress={handleBrowsePrograms}
                >
                  <IconSymbol name="magnifyingglass" size={14} color={colors.tint} />
                  <ThemedText style={[styles.browseButtonText, { color: colors.tint }]}>
                    Browse Programs
                  </ThemedText>
                </Pressable>
                <ProfileButton />
              </View>
            ) : (
              <ProfileButton />
            )
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

      {/* ===== TAB 2: BROWSE / DISCOVER ===== */}
      <Tabs.Screen
        name="browse"
        options={{
          title: useNewTabBar ? 'Browse' : 'Discover',
          href: useNewTabBar ? null : '/(tabs)/browse',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={focused ? 26 : 24}
              name={useNewTabBar ? 'magnifyingglass' : 'sparkles'}
              color={color}
            />
          ),
        }}
      />

      {/* ===== TAB 3 (NEW): PROGRESS - combines history + stats ===== */}
      {/* In new layout, "explore" becomes Progress with chart icon */}
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

      {/* ===== TAB 3 (NEW): PROGRESS (Stats) ===== */}
      <Tabs.Screen
        name="stats"
        options={{
          title: useNewTabBar ? 'Progress' : 'Stats',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={focused ? 26 : 24}
              name={useNewTabBar ? 'chart.line.uptrend.xyaxis' : 'chart.bar.fill'}
              color={color}
            />
          ),
        }}
      />

      {/* ===== LEGACY: Tools/Import tab - hidden in new layout ===== */}
      <Tabs.Screen
        name="tools"
        options={{
          title: 'Import',
          href: useNewTabBar ? null : '/(tabs)/tools', // Hide in new layout (moved to Settings)
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={focused ? 26 : 24}
              name="square.and.arrow.down"
              color={color}
            />
          ),
        }}
      />

      {/* ===== TAB 4 (NEW): YOU - profile + settings + achievements ===== */}
      <Tabs.Screen
        name="you"
        options={{
          title: 'You',
          href: useNewTabBar ? '/(tabs)/you' : null, // Only show in new layout
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

      {/* ===== HIDDEN: Upload (accessible via Settings in new layout) ===== */}
      <Tabs.Screen
        name="upload"
        options={{
          href: null, // Always hidden from tab bar
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
          onResume={() => router.push(`/workout/${pendingWorkout.programId}` as any)}
          onDiscard={discardPendingWorkout}
        />
      </View>
    )}
    </>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  browseButtonText: {
    ...Typography.caption2,
    fontWeight: '600',
  },
  resumeBarWrapper: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    bottom: RESUME_BAR_OFFSET,
    zIndex: 20,
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
