/**
 * Tier Badge Component
 *
 * Displays the user's current league tier with rank.
 * Small badge for header integration.
 */

import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { TierConfig } from '@/lib/services/leagues/tier-system';
import { getTierById, isInDangerZone, isInPromotionZone } from '@/lib/services/leagues/tier-system';

// ============================================
// TYPES
// ============================================

interface TierBadgeProps {
    tierId: number;
    rank?: number;
    cohortSize?: number;
    compact?: boolean;
    onPress?: () => void;
}

interface TierDisplayProps {
    tier: TierConfig;
    size?: 'small' | 'medium' | 'large';
}

// ============================================
// TIER BADGE
// ============================================

export function TierBadge({
    tierId,
    rank,
    cohortSize = 30,
    compact = false,
    onPress,
}: TierBadgeProps) {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    const tier = getTierById(tierId);
    if (!tier) return null;

    const inDanger = rank ? isInDangerZone(rank, cohortSize) : false;
    const inPromotion = rank ? isInPromotionZone(rank, cohortSize) : false;

    const getBorderColor = () => {
        if (inDanger) return '#FF3B30';
        if (inPromotion) return '#34C759';
        return tier.color;
    };

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
    };

    if (compact) {
        return (
            <Pressable onPress={handlePress} style={styles.compactContainer}>
                <ThemedText style={styles.compactIcon}>{tier.icon}</ThemedText>
                {rank && (
                    <ThemedText style={[styles.compactRank, { color: colors.textSecondary }]}>
                        #{rank}
                    </ThemedText>
                )}
            </Pressable>
        );
    }

    return (
        <Pressable onPress={handlePress}>
            <View
                style={[
                    styles.container,
                    {
                        borderColor: getBorderColor(),
                        backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    },
                ]}
            >
                <ThemedText style={styles.icon}>{tier.icon}</ThemedText>
                <View style={styles.textContainer}>
                    <ThemedText style={[styles.tierName, { color: tier.color }]}>{tier.name}</ThemedText>
                    {rank && (
                        <ThemedText
                            style={[
                                styles.rank,
                                {
                                    color: inDanger ? '#FF3B30' : inPromotion ? '#34C759' : colors.textSecondary,
                                },
                            ]}
                        >
                            Rank #{rank}
                            {inDanger && ' ⚠️'}
                            {inPromotion && ' 🚀'}
                        </ThemedText>
                    )}
                </View>
            </View>
        </Pressable>
    );
}

// ============================================
// TIER DISPLAY (Static)
// ============================================

export function TierDisplay({ tier, size = 'medium' }: TierDisplayProps) {
    const sizeConfig = {
        small: { icon: 20, name: 12 },
        medium: { icon: 28, name: 14 },
        large: { icon: 40, name: 18 },
    };

    return (
        <View style={styles.displayContainer}>
            <ThemedText style={{ fontSize: sizeConfig[size].icon }}>{tier.icon}</ThemedText>
            <ThemedText
                style={[styles.displayName, { fontSize: sizeConfig[size].name, color: tier.color }]}
            >
                {tier.name}
            </ThemedText>
        </View>
    );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 2,
        gap: 8,
    },
    icon: {
        fontSize: 24,
    },
    textContainer: {
        gap: 2,
    },
    tierName: {
        fontSize: 14,
        fontWeight: '700',
    },
    rank: {
        fontSize: 12,
        fontWeight: '500',
    },

    // Compact styles
    compactContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    compactIcon: {
        fontSize: 18,
    },
    compactRank: {
        fontSize: 12,
        fontWeight: '600',
    },

    // Display styles
    displayContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    displayName: {
        fontWeight: '600',
    },
});
