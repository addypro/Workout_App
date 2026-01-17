/**
 * Path Progress Card
 *
 * Displays XP gained and nodes completed after a workout.
 * Reads from cache for instant feedback.
 */

import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Shadows, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// ============================================
// TYPES
// ============================================

export interface PathProgressCardProps {
    xpGained: number;
    nodesCompleted: string[];
    totalXp?: number;
    pathName?: string;
    onViewPath?: () => void;
}

// ============================================
// COMPONENT
// ============================================

export function PathProgressCard({
    xpGained,
    nodesCompleted,
    totalXp,
    pathName,
    onViewPath,
}: PathProgressCardProps) {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    const handleViewPath = () => {
        if (onViewPath) {
            onViewPath();
        } else {
            router.push('/challenges' as any);
        }
    };

    // Don't render if no progress was made
    if (xpGained === 0 && nodesCompleted.length === 0) {
        return null;
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.card }]}>
            {/* Header with XP */}
            <View style={styles.header}>
                <View style={styles.xpBadge}>
                    <IconSymbol name="star.fill" size={16} color="#FFD700" />
                    <ThemedText style={styles.xpText}>+{xpGained} XP</ThemedText>
                </View>
                {totalXp !== undefined && (
                    <ThemedText style={[styles.totalXp, { color: colors.textSecondary }]}>
                        Total: {totalXp} XP
                    </ThemedText>
                )}
            </View>

            {/* Nodes completed */}
            {nodesCompleted.length > 0 && (
                <View style={styles.nodesSection}>
                    <View style={styles.nodesBadge}>
                        <IconSymbol name="checkmark.circle.fill" size={14} color="#30D158" />
                        <ThemedText style={[styles.nodesText, { color: colors.textSecondary }]}>
                            {nodesCompleted.length} milestone{nodesCompleted.length > 1 ? 's' : ''} completed
                        </ThemedText>
                    </View>
                </View>
            )}

            {/* Path name and view button */}
            <View style={styles.footer}>
                {pathName && (
                    <ThemedText style={[styles.pathName, { color: colors.textSecondary }]} numberOfLines={1}>
                        {pathName}
                    </ThemedText>
                )}
                <Pressable
                    onPress={handleViewPath}
                    style={({ pressed }) => [
                        styles.viewButton,
                        { backgroundColor: colors.tint, opacity: pressed ? 0.8 : 1 },
                    ]}
                >
                    <ThemedText style={styles.viewButtonText}>View Path</ThemedText>
                    <IconSymbol name="chevron.right" size={12} color="#FFFFFF" />
                </Pressable>
            </View>
        </View>
    );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
    container: {
        borderRadius: Radius.lg,
        padding: Spacing.md,
        marginVertical: Spacing.sm,
        ...Shadows.md,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    xpBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        backgroundColor: 'rgba(255, 215, 0, 0.15)',
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.full,
    },
    xpText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFD700',
    },
    totalXp: {
        fontSize: 13,
    },
    nodesSection: {
        marginBottom: Spacing.sm,
    },
    nodesBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    nodesText: {
        fontSize: 14,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: Spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(128, 128, 128, 0.2)',
    },
    pathName: {
        fontSize: 13,
        flex: 1,
        marginRight: Spacing.sm,
    },
    viewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.full,
    },
    viewButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});
