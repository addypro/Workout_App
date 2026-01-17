/**
 * Leagues Screen
 *
 * Displays the user's current league tier, weekly ranking, and leaderboard.
 * Part of the Wolfpack competitive gamification system.
 */

import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TierBadge } from '@/components/leagues/tier-badge';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/context/auth-context';
import { getTierById } from '@/lib/services/leagues/tier-system';
import { supabase } from '@/lib/supabase/client';

interface LeagueMembership {
    user_id: string;
    tier_id: number;
    weekly_xp: number;
    rank_in_tier: number | null;
    total_in_tier: number | null;
}

export default function LeaguesScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const { user, isGuest } = useAuth();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [membership, setMembership] = useState<LeagueMembership | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleBack = useCallback(() => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)/explore' as any);
        }
    }, [router]);

    const headerOptions = {
        title: 'Leagues',
        headerShown: true,
        headerBackTitleVisible: false,
        headerLeft: () => (
            <Pressable
                onPress={handleBack}
                hitSlop={12}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
                <IconSymbol name="chevron.left" size={18} color={colors.tint} />
                <ThemedText style={{ color: colors.tint }}>Back</ThemedText>
            </Pressable>
        ),
    } as const;

    const loadLeagueData = useCallback(async () => {
        if (isGuest || !user?.id) {
            setError('Sign in to join leagues and compete weekly!');
            setLoading(false);
            return;
        }

        try {
            // Get active league period
            const { data: activePeriod, error: periodError } = await supabase
                .from('league_periods')
                .select('id')
                .eq('status', 'active')
                .order('start_date', { ascending: false })
                .limit(1)
                .single();

            if (periodError && periodError.code !== 'PGRST116') {
                throw periodError;
            }

            if (!activePeriod) {
                setMembership(null);
                setError('Leagues are not active yet. Check back soon.');
                return;
            }

            // Fetch user's standing for the active period
            const { data: standing, error: standingError } = await supabase
                .from('league_standings')
                .select('user_id, tier_id, xp, rank')
                .eq('user_id', user.id)
                .eq('period_id', activePeriod.id)
                .single();

            if (standingError && standingError.code !== 'PGRST116') {
                throw standingError;
            }

            if (!standing) {
                setMembership(null);
                setError('You are not placed in a league yet.');
                return;
            }

            const { count, error: countError } = await supabase
                .from('league_standings')
                .select('id', { count: 'exact', head: true })
                .eq('period_id', activePeriod.id)
                .eq('tier_id', standing.tier_id);

            if (countError) {
                throw countError;
            }

            setMembership({
                user_id: standing.user_id,
                tier_id: standing.tier_id,
                weekly_xp: standing.xp || 0,
                rank_in_tier: standing.rank ?? null,
                total_in_tier: count ?? null,
            });
            setError(null);
        } catch (err: any) {
            console.error('Error loading league data:', err);
            const code = err?.code;
            if (code === 'PGRST205') {
                setError('Leagues are not configured on this server yet.');
            } else {
                setError('Unable to load league data');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?.id, isGuest]);

    useEffect(() => {
        loadLeagueData();
    }, [loadLeagueData]);

    const handleRefresh = () => {
        setRefreshing(true);
        loadLeagueData();
    };

    const tier = membership?.tier_id ? getTierById(membership.tier_id) : null;

    if (loading) {
        return (
            <>
                <Stack.Screen options={headerOptions} />
                <Screen>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.tint} />
                    </View>
                </Screen>
            </>
        );
    }

    return (
        <>
            <Stack.Screen options={headerOptions} />
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
                    {/* Error/Guest State */}
                    {error && (
                        <Card style={styles.errorCard} padding="md">
                            <View style={styles.errorContent}>
                                <IconSymbol name="person.badge.shield.checkmark.fill" size={48} color={colors.tint} />
                                <ThemedText style={styles.errorTitle}>Join the Competition</ThemedText>
                                <ThemedText style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
                                    {error}
                                </ThemedText>
                            </View>
                        </Card>
                    )}

                    {/* Current Tier Card */}
                    {membership && tier && (
                        <>
                            <Card style={styles.tierCard} padding="md">
                                <View style={styles.tierHeader}>
                                    <ThemedText style={styles.sectionLabel}>Current Tier</ThemedText>
                                </View>
                                <View style={styles.tierContent}>
                                    <TierBadge tierId={membership.tier_id} />
                                    <View style={styles.tierInfo}>
                                        <ThemedText style={styles.tierName}>{tier.name}</ThemedText>
                                        <ThemedText style={[styles.tierXp, { color: colors.textSecondary }]}>
                                            {membership.weekly_xp.toLocaleString()} XP this week
                                        </ThemedText>
                                    </View>
                                </View>
                            </Card>

                            {/* Ranking Card */}
                            <Card style={styles.rankingCard} padding="md">
                                <View style={styles.rankingHeader}>
                                    <ThemedText style={styles.sectionLabel}>Your Ranking</ThemedText>
                                </View>
                                <View style={styles.rankingContent}>
                                    <View style={styles.rankingItem}>
                                        <View style={[styles.rankingIcon, { backgroundColor: '#FFD60A20' }]}>
                                            <IconSymbol name="trophy.fill" size={24} color="#FFD60A" />
                                        </View>
                                        <View>
                                            <ThemedText style={styles.rankingValue}>
                                                #{membership.rank_in_tier || '—'}
                                            </ThemedText>
                                            <ThemedText style={[styles.rankingLabel, { color: colors.textSecondary }]}>
                                                of {membership.total_in_tier || '—'} in tier
                                            </ThemedText>
                                        </View>
                                    </View>
                                </View>
                            </Card>

                            {/* Promotion Info */}
                            <Card style={styles.infoCard} padding="sm">
                                <View style={styles.infoRow}>
                                    <IconSymbol name="arrow.up.circle.fill" size={20} color="#30D158" />
                                    <ThemedText style={[styles.infoText, { color: colors.textSecondary }]}>
                                        Top {(tier.promotionTop * 100).toFixed(0)}% promoted at week end
                                    </ThemedText>
                                </View>
                                <View style={styles.infoRow}>
                                    <IconSymbol name="arrow.down.circle" size={20} color="#FF453A" />
                                    <ThemedText style={[styles.infoText, { color: colors.textSecondary }]}>
                                        Bottom {(tier.demotionBottom * 100).toFixed(0)}% demoted at week end
                                    </ThemedText>
                                </View>
                            </Card>
                        </>
                    )}

                    {/* No Membership State */}
                    {!error && !membership && (
                        <Card style={styles.emptyCard} padding="md">
                            <View style={styles.emptyContent}>
                                <ThemedText style={styles.emptyEmoji}>🏆</ThemedText>
                                <ThemedText style={styles.emptyTitle}>Not in a League Yet</ThemedText>
                                <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                                    Complete workouts to earn XP and join weekly competition!
                                </ThemedText>
                            </View>
                        </Card>
                    )}
                </ScrollView>
            </Screen>
        </>
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
        gap: Spacing.md,
    },
    tierCard: {
        marginBottom: 0,
    },
    tierHeader: {
        marginBottom: Spacing.md,
    },
    sectionLabel: {
        ...Typography.subhead,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    tierContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.lg,
    },
    tierInfo: {
        flex: 1,
    },
    tierName: {
        ...Typography.title2,
        fontWeight: '700',
    },
    tierXp: {
        ...Typography.subhead,
        marginTop: 2,
    },
    rankingCard: {
        marginBottom: 0,
    },
    rankingHeader: {
        marginBottom: Spacing.md,
    },
    rankingContent: {
        gap: Spacing.md,
    },
    rankingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    rankingIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rankingValue: {
        ...Typography.title1,
        fontWeight: '700',
    },
    rankingLabel: {
        ...Typography.caption1,
    },
    infoCard: {
        gap: Spacing.sm,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    infoText: {
        ...Typography.footnote,
        flex: 1,
    },
    errorCard: {
        marginBottom: 0,
    },
    errorContent: {
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.lg,
    },
    errorTitle: {
        ...Typography.title3,
        fontWeight: '600',
    },
    errorSubtitle: {
        ...Typography.body,
        textAlign: 'center',
    },
    emptyCard: {
        marginBottom: 0,
    },
    emptyContent: {
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.lg,
    },
    emptyEmoji: {
        fontSize: 48,
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
});
