/**
 * Wolfpack Leaderboard Component
 *
 * Displays the weekly league standings with:
 * - Tier badge and week indicator
 * - Ranked list of members with scores
 * - Promotion/demotion zones highlighted
 * - User's current position emphasized
 */

import * as Haptics from 'expo-haptics';
import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { League, LeagueMember, LeagueTier } from '@/lib/services/wolfpack/types';
import { formatScore, getLeagueThresholds, getMovementFromRank, getTierInfo } from '@/lib/services/wolfpack/scoring';

// ============================================
// TYPES
// ============================================

interface LeaderboardProps {
  league: League;
  currentUserId: string;
  onMemberPress?: (member: LeagueMember) => void;
}

interface MemberRowProps {
  member: LeagueMember;
  isCurrentUser: boolean;
  zone: 'promotion' | 'demotion' | 'safe';
  index: number;
  onPress?: () => void;
}

// ============================================
// TIER HEADER
// ============================================

function TierHeader({ tier, week, year }: { tier: LeagueTier; week: number; year: number }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const tierInfo = getTierInfo(tier);

  return (
    <Animated.View entering={FadeInUp.springify()} style={styles.tierHeader}>
      <View style={[styles.tierBadge, { backgroundColor: tierInfo.color }]}>
        <IconSymbol name={tierInfo.icon as any} size={20} color="#FFFFFF" />
        <ThemedText style={styles.tierName}>{tierInfo.name}</ThemedText>
      </View>
      <ThemedText style={[styles.weekLabel, { color: colors.textSecondary }]}>
        Week {week}, {year}
      </ThemedText>
    </Animated.View>
  );
}

// ============================================
// MEMBER ROW
// ============================================

function MemberRow({ member, isCurrentUser, zone, index, onPress }: MemberRowProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const getZoneColor = () => {
    switch (zone) {
      case 'promotion':
        return colorScheme === 'dark' ? 'rgba(52, 199, 89, 0.15)' : 'rgba(52, 199, 89, 0.1)';
      case 'demotion':
        return colorScheme === 'dark' ? 'rgba(255, 59, 48, 0.15)' : 'rgba(255, 59, 48, 0.1)';
      default:
        return 'transparent';
    }
  };

  const getRankChange = () => {
    if (!member.previousRank) return null;
    const change = member.previousRank - member.rank;
    if (change > 0) return { icon: 'arrow.up', color: '#34C759', text: `+${change}` };
    if (change < 0) return { icon: 'arrow.down', color: '#FF3B30', text: `${change}` };
    return { icon: 'minus', color: '#8E8E93', text: '–' };
  };

  const rankChange = getRankChange();

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  }, [onPress]);

  return (
    <Animated.View entering={FadeInDown.delay(index * 30).springify()}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.memberRow,
          {
            backgroundColor: isCurrentUser
              ? colorScheme === 'dark'
                ? 'rgba(0, 122, 255, 0.2)'
                : 'rgba(0, 122, 255, 0.1)'
              : getZoneColor(),
            borderColor: isCurrentUser ? colors.tint : 'transparent',
            borderWidth: isCurrentUser ? 2 : 0,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        {/* Rank */}
        <View style={styles.rankContainer}>
          <ThemedText style={[styles.rank, { color: member.rank <= 3 ? '#FFD700' : colors.text }]}>
            {member.rank}
          </ThemedText>
          {rankChange && (
            <View style={styles.rankChange}>
              <IconSymbol name={rankChange.icon as any} size={10} color={rankChange.color} />
            </View>
          )}
        </View>

        {/* Avatar & Name */}
        <View style={styles.memberInfo}>
          <View style={[styles.avatar, { backgroundColor: colors.card }]}>
            <ThemedText style={styles.avatarText}>
              {member.username.charAt(0).toUpperCase()}
            </ThemedText>
          </View>
          <View style={styles.nameContainer}>
            <ThemedText
              style={[styles.username, { color: colors.text, fontWeight: isCurrentUser ? '700' : '500' }]}
              numberOfLines={1}
            >
              {member.username}
              {isCurrentUser && ' (You)'}
            </ThemedText>
            <ThemedText style={[styles.streak, { color: colors.textSecondary }]}>
              {member.streak} day streak
            </ThemedText>
          </View>
        </View>

        {/* Score */}
        <View style={styles.scoreContainer}>
          <ThemedText style={[styles.score, { color: colors.tint }]}>
            {formatScore(member.weekScore)}
          </ThemedText>
          <ThemedText style={[styles.workouts, { color: colors.textSecondary }]}>
            {member.workoutsThisWeek} workouts
          </ThemedText>
        </View>

        {/* Zone indicator */}
        {zone !== 'safe' && (
          <View
            style={[
              styles.zoneIndicator,
              { backgroundColor: zone === 'promotion' ? '#34C759' : '#FF3B30' },
            ]}
          />
        )}
      </Pressable>
    </Animated.View>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function Leaderboard({ league, currentUserId, onMemberPress }: LeaderboardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const { promotionTop, demotionBottom } = useMemo(
    () => getLeagueThresholds(league.members.length),
    [league.members.length]
  );

  const sortedMembers = useMemo(
    () => [...league.members].sort((a, b) => a.rank - b.rank),
    [league.members]
  );

  const getZone = useCallback(
    (rank: number): 'promotion' | 'demotion' | 'safe' => {
      const movement = getMovementFromRank(rank, league.members.length);
      return movement === 'stay' ? 'safe' : movement;
    },
    [league.members.length]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.groupedBackground }]}>
      {/* Header */}
      <TierHeader tier={league.tier} week={league.week} year={league.year} />

      {/* Zone Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#34C759' }]} />
          <ThemedText style={[styles.legendText, { color: colors.textSecondary }]}>
            Top {promotionTop} promote
          </ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FF3B30' }]} />
          <ThemedText style={[styles.legendText, { color: colors.textSecondary }]}>
            Bottom {demotionBottom} demote
          </ThemedText>
        </View>
      </View>

      {/* Members List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {sortedMembers.map((member, index) => (
          <MemberRow
            key={member.userId}
            member={member}
            isCurrentUser={member.userId === currentUserId}
            zone={getZone(member.rank)}
            index={index}
            onPress={() => onMemberPress?.(member)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.md,
    gap: 6,
  },
  tierName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  weekLabel: {
    fontSize: 13,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    position: 'relative',
    overflow: 'hidden',
  },
  rankContainer: {
    width: 36,
    alignItems: 'center',
  },
  rank: {
    fontSize: 16,
    fontWeight: '700',
  },
  rankChange: {
    position: 'absolute',
    bottom: -2,
    right: 4,
  },
  memberInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  nameContainer: {
    flex: 1,
  },
  username: {
    fontSize: 14,
  },
  streak: {
    fontSize: 11,
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  score: {
    fontSize: 16,
    fontWeight: '700',
  },
  workouts: {
    fontSize: 11,
  },
  zoneIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: Radius.md,
    borderBottomLeftRadius: Radius.md,
  },
});
