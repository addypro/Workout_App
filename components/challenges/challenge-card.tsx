/**
 * Challenge Card Component
 *
 * Displays a challenge preview with progress info.
 * Uses compact NodeMap for visual path representation.
 * Brilliant.org aesthetic.
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ChallengeProgress, ChallengeTemplate } from '@/lib/services/challenges';
import { getChallengeProgress, getTemplate } from '@/lib/services/challenges';

// ============================================
// TYPES
// ============================================

interface ChallengeCardProps {
    challengeId: string;
    userId: string;
    compact?: boolean;
    onPress?: () => void;
}

interface ChallengeTemplateCardProps {
    template: ChallengeTemplate;
    onJoin?: () => void;
}

// ============================================
// ACTIVE CHALLENGE CARD
// ============================================

export function ChallengeCard({ challengeId, userId, compact = false, onPress }: ChallengeCardProps) {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    const [progress, setProgress] = useState<ChallengeProgress | null>(null);
    const [template, setTemplate] = useState<ChallengeTemplate | undefined>(undefined);

    useEffect(() => {
        loadProgress();
    }, [challengeId, userId]);

    const loadProgress = async () => {
        const prog = await getChallengeProgress(userId, challengeId);
        setProgress(prog);
        if (prog) {
            setTemplate(getTemplate(prog.templateName));
        }
    };

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (onPress) {
            onPress();
        } else if (progress) {
            router.push(`/paths/${progress.pathId}` as any);
        }
    };

    if (!progress) {
        return null;
    }

    const getCategoryIcon = () => {
        switch (template?.category) {
            case 'strength':
                return 'dumbbell.fill';
            case 'volume':
                return 'flame.fill';
            case 'endurance':
                return 'figure.run';
            case 'hybrid':
                return 'sparkles';
            default:
                return 'star.fill';
        }
    };

    const getStatusColor = () => {
        if (progress.status === 'completed') return '#34C759';
        if (progress.status === 'failed') return '#FF3B30';
        return colors.tint;
    };

    return (
        <Pressable onPress={handlePress}>
            <Card style={[styles.card, compact && styles.cardCompact]}>
                <View style={styles.header}>
                    <View style={[styles.iconContainer, { backgroundColor: getStatusColor() + '20' }]}>
                        <IconSymbol name={getCategoryIcon()} size={20} color={getStatusColor()} />
                    </View>
                    <View style={styles.headerText}>
                        <ThemedText style={styles.title}>{progress.templateName}</ThemedText>
                        <ThemedText style={[styles.status, { color: colors.textSecondary }]}>
                            Day {progress.currentDay}
                            {progress.totalDays ? ` of ${progress.totalDays}` : ''}
                        </ThemedText>
                    </View>
                    <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
                </View>

                {!compact && (
                    <View style={styles.progressContainer}>
                        <View style={[styles.progressBar, { backgroundColor: colors.tintMuted }]}>
                            <View
                                style={[
                                    styles.progressFill,
                                    {
                                        backgroundColor: getStatusColor(),
                                        width: `${progress.percentComplete}%`,
                                    },
                                ]}
                            />
                        </View>
                        <ThemedText style={[styles.progressText, { color: colors.textSecondary }]}>
                            {progress.nodesCompleted}/{progress.totalNodes} nodes • {progress.percentComplete}%
                        </ThemedText>
                    </View>
                )}
            </Card>
        </Pressable>
    );
}

// ============================================
// TEMPLATE CARD (FOR BROWSING)
// ============================================

export function ChallengeTemplateCard({ template, onJoin }: ChallengeTemplateCardProps) {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    const handleJoin = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onJoin?.();
    };

    const getCategoryIcon = () => {
        switch (template.category) {
            case 'strength':
                return 'dumbbell.fill';
            case 'volume':
                return 'flame.fill';
            case 'endurance':
                return 'figure.run';
            case 'hybrid':
                return 'sparkles';
            default:
                return 'star.fill';
        }
    };

    const getCategoryColor = () => {
        switch (template.category) {
            case 'strength':
                return '#FF3B30';
            case 'volume':
                return '#FF9500';
            case 'endurance':
                return '#34C759';
            case 'hybrid':
                return '#5856D6';
            default:
                return colors.tint;
        }
    };

    return (
        <Card style={styles.templateCard}>
            <View style={styles.templateHeader}>
                <View style={[styles.iconContainer, { backgroundColor: getCategoryColor() + '20' }]}>
                    <IconSymbol name={getCategoryIcon()} size={24} color={getCategoryColor()} />
                </View>
                <View style={styles.templateHeaderText}>
                    <ThemedText style={styles.templateTitle}>{template.name}</ThemedText>
                    <View style={styles.templateMeta}>
                        <ThemedText style={[styles.templateDuration, { color: colors.textSecondary }]}>
                            {template.durationDays ? `${template.durationDays} days` : 'Unlimited'}
                        </ThemedText>
                        <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor() + '20' }]}>
                            <ThemedText style={[styles.categoryText, { color: getCategoryColor() }]}>
                                {template.category}
                            </ThemedText>
                        </View>
                    </View>
                </View>
            </View>

            {template.description && (
                <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
                    {template.description}
                </ThemedText>
            )}

            <Pressable
                style={[styles.joinButton, { backgroundColor: colors.tint }]}
                onPress={handleJoin}
            >
                <ThemedText style={styles.joinButtonText}>Start Challenge</ThemedText>
            </Pressable>
        </Card>
    );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
    card: {
        marginVertical: 8,
        padding: 16,
    },
    cardCompact: {
        padding: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: {
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
    },
    status: {
        fontSize: 13,
        marginTop: 2,
    },
    progressContainer: {
        marginTop: 16,
    },
    progressBar: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    progressText: {
        fontSize: 12,
        marginTop: 8,
        textAlign: 'right',
    },

    // Template card styles
    templateCard: {
        marginVertical: 8,
        padding: 16,
    },
    templateHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    templateHeaderText: {
        flex: 1,
    },
    templateTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    templateMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
    },
    templateDuration: {
        fontSize: 13,
    },
    categoryBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    categoryText: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    description: {
        fontSize: 14,
        marginTop: 12,
        lineHeight: 20,
    },
    joinButton: {
        marginTop: 16,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    joinButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
});
