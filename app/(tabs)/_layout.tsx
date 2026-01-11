import { Tabs } from 'expo-router';
import React, { useState, useCallback } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ProfileButton } from '@/components/auth/profile-button';
import { QuickEntryModal } from '@/components/quick-entry-modal';
import { ExpandableFAB } from '@/components/expandable-fab';
import { ContextPills } from '@/components/breadcrumb-nav';
import { Colors, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useContextPills } from '@/lib/context/tab-context';
import { useAuth } from '@/lib/context/auth-context';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [quickEntryVisible, setQuickEntryVisible] = useState(false);
  const { isCoach } = useAuth();

  // Get context pills for current tab
  const { pills, clearAll } = useContextPills();

  const handleQuickEntry = useCallback(() => {
    setQuickEntryVisible(true);
  }, []);

  return (
    <>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
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
      <Tabs.Screen
        name="index"
        options={{
          title: 'My Programs',
          headerRight: () => (
            <ProfileButton />
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
      <Tabs.Screen
        name="browse"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={focused ? 26 : 24}
              name="sparkles"
              color={color}
            />
          ),
        }}
      />
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
      <Tabs.Screen
        name="tools"
        options={{
          title: 'Import',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={focused ? 26 : 24}
              name="square.and.arrow.down"
              color={color}
            />
          ),
        }}
      />
      {/* Coach tab - only visible for coaches */}
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
      {/* Upload is accessible from Programs screen - hide from tab bar */}
      <Tabs.Screen
        name="upload"
        options={{
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>

    {/* Quick Entry Modal - Global access */}
    <QuickEntryModal
      visible={quickEntryVisible}
      onClose={() => setQuickEntryVisible(false)}
      recentWorkouts={[]}
    />
    </>
  );
}
