/**
 * Challenge Screener Screen
 *
 * Onboarding flow to recommend the user's first challenge.
 * Uses Ghost Scan (automatic) or Wizard (interactive).
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ChallengeTemplateCard } from '@/components/challenges';
import { ScreenerWizard } from '@/components/onboarding';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/context/auth-context';
import { getTemplate, joinChallenge, type ChallengeRecommendation } from '@/lib/services/challenges';
import { analyzeHistory } from '@/lib/services/recommendations';

// ============================================
// COMPONENT
// ============================================

export default function ScreenerScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const { user } = useAuth();

    const [stage, setStage] = useState<'loading' | 'recommendation' | 'wizard'>('loading');
    const [recommendation, setRecommendation] = useState<ChallengeRecommendation | null>(null);
    const [joining, setJoining] = useState(false);

    useEffect(() => {
        runGhostScan();
    }, []);

    const runGhostScan = async () => {
        if (!user?.id) {
            setStage('wizard');
            return;
        }

        const result = await analyzeHistory(user.id);

        if (result.needsWizard || result.confidence === 'low') {
            setStage('wizard');
        } else {
            setRecommendation(result);
            setStage('recommendation');
        }
    };

    const handleWizardComplete = (result: ChallengeRecommendation) => {
        setRecommendation(result);
        setStage('recommendation');
    };

    const handleWizardCancel = () => {
        router.back();
    };

    const handleJoinChallenge = async () => {
        if (!recommendation?.templateId || !user?.id) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setJoining(true);

        try {
            const challenge = await joinChallenge(user.id, recommendation.templateId);
            if (challenge) {
                router.replace(`/paths/${challenge.pathId}` as any);
            }
        } catch (error) {
            console.error('Error joining challenge:', error);
            setJoining(false);
        }
    };

    const handleSkip = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.back();
    };

    // Loading state
    if (stage === 'loading') {
        return (
            <Screen>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.tint} />
                    <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
                        Analyzing your history...
                    </ThemedText>
                </View>
            </Screen>
        );
    }

    // Wizard state
    if (stage === 'wizard') {
        return (
            <Screen>
                <ScreenerWizard onComplete={handleWizardComplete} onCancel={handleWizardCancel} />
            </Screen>
        );
    }

    // Recommendation state
    const template = recommendation?.templateId ? getTemplate(recommendation.templateId) : null;

    return (
        <Screen>
            <Animated.View entering={FadeIn.duration(400)} style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <IconSymbol name="sparkles" size={48} color={colors.tint} />
                    <ThemedText style={styles.title}>Perfect Match</ThemedText>
                    <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
                        {recommendation?.reason}
                    </ThemedText>
                </View>

                {/* Template Card */}
                {template && (
                    <View style={styles.cardContainer}>
                        <ChallengeTemplateCard template={template} onJoin={handleJoinChallenge} />
                    </View>
                )}

                {/* Loading for join */}
                {joining && (
                    <View style={styles.joiningOverlay}>
                        <ActivityIndicator size="large" color="#FFFFFF" />
                        <ThemedText style={styles.joiningText}>Starting Challenge...</ThemedText>
                    </View>
                )}

                {/* Skip option */}
                <Pressable onPress={handleSkip} style={styles.skipButton}>
                    <ThemedText style={[styles.skipText, { color: colors.textSecondary }]}>
                        Maybe later
                    </ThemedText>
                </Pressable>
            </Animated.View>
        </Screen>
    );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.lg,
    },
    loadingText: {
        fontSize: 16,
    },
    container: {
        flex: 1,
        paddingHorizontal: Spacing.lg,
    },
    header: {
        alignItems: 'center',
        paddingTop: Spacing.xxl,
        paddingBottom: Spacing.xl,
        gap: Spacing.sm,
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        marginTop: Spacing.md,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        paddingHorizontal: Spacing.lg,
    },
    cardContainer: {
        flex: 1,
    },
    joiningOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.md,
    },
    joiningText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
    },
    skipButton: {
        alignItems: 'center',
        paddingVertical: Spacing.lg,
    },
    skipText: {
        fontSize: 15,
    },
});
