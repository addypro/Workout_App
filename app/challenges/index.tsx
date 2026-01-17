/**
 * Challenges Browser Screen
 *
 * Browse all available challenge templates and join them.
 * Shows active path progress if user has one.
 */

import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ChallengeTemplateCard } from '@/components/challenges';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Shadows, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/context/auth-context';
import { getAllTemplates, joinChallenge } from '@/lib/services/challenges';
import {
    getPathProgressCache,
    type CachedPathProgress,
} from '@/lib/services/offline/paths-cache';
import { getAllPaths, getPath, type Path } from '@/lib/services/paths/catalog';

export default function ChallengesScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const { user } = useAuth();

    const [joining, setJoining] = useState<string | null>(null);
    const [activeProgress, setActiveProgress] = useState<CachedPathProgress | null>(null);
    const [activePath, setActivePath] = useState<Path | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const templates = getAllTemplates();
    const paths = getAllPaths();

    // Load active path progress from cache
    useEffect(() => {
        loadActiveProgress();
    }, [user?.id]);

    const loadActiveProgress = async () => {
        if (!user?.id) return;
        try {
            const progress = await getPathProgressCache(user.id);
            setActiveProgress(progress);
            if (progress?.pathInstance?.pathId) {
                const path = getPath(progress.pathInstance.pathId);
                setActivePath(path ?? null);
            }
        } catch (error) {
            console.log('[Challenges] Failed to load progress:', error);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadActiveProgress();
        setRefreshing(false);
    };

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)/explore' as any);
        }
    };

    const handleJoin = async (templateId: string) => {
        if (!user?.id) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setJoining(templateId);

        try {
            const challenge = await joinChallenge(user.id, templateId);
            if (challenge) {
                router.replace('/(tabs)' as any);
            }
        } catch (error) {
            console.error('Error joining challenge:', error);
        } finally {
            setJoining(null);
        }
    };

    const getNodeStatus = (nodeId: string): 'locked' | 'available' | 'completed' => {
        if (!activeProgress?.nodeProgress) return 'locked';
        const status = activeProgress.nodeProgress[nodeId];
        if (status === 'completed') return 'completed';
        if (status === 'available') return 'available';
        return 'locked';
    };

    return (
        <>
            <Stack.Screen
                options={{
                    title: 'Challenges',
                    headerShown: true,
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
                }}
            />
            <Screen>
                <ScrollView
                    contentContainerStyle={styles.container}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />
                    }
                >
                    {/* Active Path Progress Section */}
                    {activeProgress && activePath && (
                        <View style={[styles.activePathSection, { backgroundColor: colors.card }]}>
                            <View style={styles.activePathHeader}>
                                <View style={styles.xpBadge}>
                                    <IconSymbol name="star.fill" size={14} color="#FFD700" />
                                    <ThemedText style={styles.xpText}>{activeProgress.totalXp} XP</ThemedText>
                                </View>
                                <View style={[styles.tierBadge, { backgroundColor: colors.tint + '20' }]}>
                                    <ThemedText style={[styles.tierText, { color: colors.tint }]}>
                                        {activeProgress.pathInstance?.tier?.toUpperCase() || 'BASE'}
                                    </ThemedText>
                                </View>
                            </View>

                            <ThemedText style={styles.activePathTitle}>{activePath.name}</ThemedText>
                            <ThemedText style={[styles.activePathDesc, { color: colors.textSecondary }]}>
                                {activePath.description}
                            </ThemedText>

                            {/* Milestone Timeline */}
                            <View style={styles.timeline}>
                                {activePath.nodes.map((node, index) => {
                                    const status = getNodeStatus(node.id);
                                    const isLast = index === activePath.nodes.length - 1;

                                    return (
                                        <View key={node.id} style={styles.timelineItem}>
                                            <View style={styles.timelineLeft}>
                                                <View
                                                    style={[
                                                        styles.timelineDot,
                                                        status === 'completed' && styles.timelineDotCompleted,
                                                        status === 'available' && [styles.timelineDotAvailable, { borderColor: colors.tint }],
                                                        status === 'locked' && [styles.timelineDotLocked, { backgroundColor: colors.separator }],
                                                    ]}
                                                >
                                                    {status === 'completed' && (
                                                        <IconSymbol name="checkmark" size={12} color="#FFFFFF" />
                                                    )}
                                                    {status === 'available' && (
                                                        <View style={[styles.availablePulse, { backgroundColor: colors.tint }]} />
                                                    )}
                                                </View>
                                                {!isLast && (
                                                    <View
                                                        style={[
                                                            styles.timelineLine,
                                                            { backgroundColor: status === 'completed' ? '#30D158' : colors.separator },
                                                        ]}
                                                    />
                                                )}
                                            </View>
                                            <View style={styles.timelineContent}>
                                                <ThemedText
                                                    style={[
                                                        styles.nodeName,
                                                        status === 'locked' && { color: colors.textTertiary },
                                                    ]}
                                                >
                                                    {node.title}
                                                </ThemedText>
                                                {node.meta?.xpReward && (
                                                    <ThemedText style={[styles.nodeXp, { color: colors.textSecondary }]}>
                                                        +{node.meta.xpReward} XP
                                                    </ThemedText>
                                                )}
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {/* Challenge Templates Header */}
                    <View style={styles.header}>
                        <ThemedText style={styles.title}>
                            {activeProgress ? 'More Challenges' : 'Choose Your Challenge'}
                        </ThemedText>
                        <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
                            Pick a challenge that matches your goals
                        </ThemedText>
                    </View>

                    {templates.map((template) => (
                        <View key={template.id} style={styles.cardWrapper}>
                            <ChallengeTemplateCard
                                template={template}
                                onJoin={() => handleJoin(template.id)}
                            />
                            {joining === template.id && (
                                <View style={styles.joiningOverlay}>
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                </View>
                            )}
                        </View>
                    ))}
                </ScrollView>
            </Screen>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: Spacing.lg,
    },
    activePathSection: {
        borderRadius: Radius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.xl,
        ...Shadows.md,
    },
    activePathHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    xpBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255, 215, 0, 0.15)',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radius.full,
    },
    xpText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFD700',
    },
    tierBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radius.full,
    },
    tierText: {
        fontSize: 11,
        fontWeight: '600',
    },
    activePathTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 4,
    },
    activePathDesc: {
        fontSize: 14,
        marginBottom: Spacing.md,
    },
    timeline: {
        marginTop: Spacing.sm,
    },
    timelineItem: {
        flexDirection: 'row',
        minHeight: 48,
    },
    timelineLeft: {
        width: 24,
        alignItems: 'center',
    },
    timelineDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    timelineDotCompleted: {
        backgroundColor: '#30D158',
    },
    timelineDotAvailable: {
        backgroundColor: 'transparent',
        borderWidth: 2,
    },
    timelineDotLocked: {
        backgroundColor: '#E5E5EA',
    },
    availablePulse: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    timelineLine: {
        width: 2,
        flex: 1,
        marginVertical: 4,
    },
    timelineContent: {
        flex: 1,
        marginLeft: Spacing.sm,
        paddingBottom: Spacing.sm,
    },
    nodeName: {
        fontSize: 15,
        fontWeight: '500',
    },
    nodeXp: {
        fontSize: 12,
        marginTop: 2,
    },
    header: {
        marginBottom: Spacing.xl,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
    },
    subtitle: {
        fontSize: 15,
        marginTop: Spacing.xs,
    },
    cardWrapper: {
        position: 'relative',
        marginBottom: Spacing.md,
    },
    joiningOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
