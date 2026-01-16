/**
 * Challenges Browser Screen
 *
 * Browse all available challenge templates and join them.
 */

import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ChallengeTemplateCard } from '@/components/challenges';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/context/auth-context';
import { getAllTemplates, joinChallenge } from '@/lib/services/challenges';

export default function ChallengesScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const { user } = useAuth();

    const [joining, setJoining] = useState<string | null>(null);

    const templates = getAllTemplates();
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
                // Navigate back to home to see the active challenge
                router.replace('/(tabs)' as any);
            }
        } catch (error) {
            console.error('Error joining challenge:', error);
        } finally {
            setJoining(null);
        }
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
                >
                    <View style={styles.header}>
                        <ThemedText style={styles.title}>Choose Your Challenge</ThemedText>
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
