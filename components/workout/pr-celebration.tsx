/**
 * PR Celebration Component
 * 
 * Shows confetti and PR badges when users hit personal records.
 */

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { type DetectedPR, getPRDescription, getPREmoji, getPRLabel } from '@/lib/services/workout/pr-detector-local';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';

interface PRCelebrationProps {
    prs: DetectedPR[];
    onComplete?: () => void;
}

export function PRCelebration({ prs, onComplete }: PRCelebrationProps) {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const confettiRef = useRef<any>(null);

    // Animation values
    const cardScale = useRef(new Animated.Value(0)).current;
    const cardOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (prs.length === 0) return;

        // Trigger haptic feedback
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Start confetti
        if (confettiRef.current) {
            confettiRef.current.start();
        }

        // Animate cards in
        Animated.sequence([
            Animated.delay(300),
            Animated.parallel([
                Animated.spring(cardScale, {
                    toValue: 1,
                    tension: 100,
                    friction: 8,
                    useNativeDriver: true,
                }),
                Animated.timing(cardOpacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]),
        ]).start();

    }, [prs]);

    if (prs.length === 0) return null;

    return (
        <View style={styles.container}>
            {/* Confetti - only on native */}
            {Platform.OS !== 'web' && (
                <ConfettiCannon
                    ref={confettiRef}
                    count={80}
                    origin={{ x: 0, y: 0 }}
                    autoStart={false}
                    fadeOut
                    fallSpeed={3000}
                    explosionSpeed={350}
                    colors={['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']}
                />
            )}

            {/* PR Cards */}
            <Animated.View
                style={[
                    styles.cardsContainer,
                    {
                        transform: [{ scale: cardScale }],
                        opacity: cardOpacity,
                    }
                ]}
            >
                {prs.map((pr, index) => (
                    <PRCard key={`${pr.exerciseName}-${index}`} pr={pr} colors={colors} />
                ))}
            </Animated.View>
        </View>
    );
}

interface PRCardProps {
    pr: DetectedPR;
    colors: typeof Colors.light;
}

function PRCard({ pr, colors }: PRCardProps) {
    const emoji = getPREmoji(pr.prType);
    const label = getPRLabel(pr.prType);
    const description = getPRDescription(pr);

    // Color based on PR type
    const prColors = {
        weight: { bg: '#FFD70020', border: '#FFD700', accent: '#FFD700' },
        volume: { bg: '#4ECDC420', border: '#4ECDC4', accent: '#4ECDC4' },
        reps: { bg: '#FF6B6B20', border: '#FF6B6B', accent: '#FF6B6B' },
    };

    const prColor = prColors[pr.prType] || prColors.weight;

    return (
        <View
            style={[
                styles.prCard,
                {
                    backgroundColor: prColor.bg,
                    borderColor: prColor.border,
                },
                Shadows.md,
            ]}
        >
            <View style={styles.prHeader}>
                <ThemedText style={styles.prEmoji}>{emoji}</ThemedText>
                <View style={styles.prLabelContainer}>
                    <ThemedText style={[styles.prLabel, { color: prColor.accent }]}>
                        {label}
                    </ThemedText>
                    <ThemedText style={[styles.prExercise, { color: colors.text }]}>
                        {pr.exerciseName}
                    </ThemedText>
                </View>
            </View>

            <View style={styles.prStats}>
                <View style={styles.prStatItem}>
                    <ThemedText style={[styles.prStatValue, { color: prColor.accent }]}>
                        {pr.newValue}
                    </ThemedText>
                    <ThemedText style={[styles.prStatLabel, { color: colors.textSecondary }]}>
                        New
                    </ThemedText>
                </View>

                <View style={styles.prArrow}>
                    <IconSymbol name="arrow.right" size={16} color={prColor.accent} />
                </View>

                <View style={styles.prStatItem}>
                    <ThemedText style={[styles.prStatValue, { color: colors.textSecondary }]}>
                        {pr.previousValue}
                    </ThemedText>
                    <ThemedText style={[styles.prStatLabel, { color: colors.textTertiary }]}>
                        Previous
                    </ThemedText>
                </View>

                <View style={[styles.prImprovement, { backgroundColor: prColor.accent + '20' }]}>
                    <ThemedText style={[styles.prImprovementText, { color: prColor.accent }]}>
                        {description}
                    </ThemedText>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    cardsContainer: {
        gap: Spacing.md,
        marginBottom: Spacing.lg,
    },
    prCard: {
        borderRadius: Radius.lg,
        borderWidth: 2,
        padding: Spacing.md,
        gap: Spacing.sm,
    },
    prHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    prEmoji: {
        fontSize: 32,
    },
    prLabelContainer: {
        flex: 1,
        gap: 2,
    },
    prLabel: {
        ...Typography.caption1,
        fontWeight: '800',
        letterSpacing: 1,
    },
    prExercise: {
        ...Typography.headline,
        fontWeight: '600',
    },
    prStats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginTop: Spacing.xs,
    },
    prStatItem: {
        alignItems: 'center',
        gap: 2,
    },
    prStatValue: {
        ...Typography.title2,
        fontWeight: '700',
    },
    prStatLabel: {
        ...Typography.caption2,
    },
    prArrow: {
        paddingHorizontal: Spacing.xs,
    },
    prImprovement: {
        marginLeft: 'auto',
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.sm,
    },
    prImprovementText: {
        ...Typography.subhead,
        fontWeight: '700',
    },
});

export default PRCelebration;
