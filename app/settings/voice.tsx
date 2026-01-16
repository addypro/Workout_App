/**
 * Voice Settings Screen
 *
 * Cloud-only voice processing configuration.
 */

import { Stack, useRouter } from 'expo-router';
import React from 'react';
import {
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function VoiceSettingsScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
            <Stack.Screen
                options={{
                    title: 'Voice Processing',
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.text,
                    headerLeft: Platform.OS === 'ios' ? () => (
                        <Pressable
                            onPress={() => router.back()}
                            hitSlop={20}
                            style={({ pressed }) => ({
                                opacity: pressed ? 0.6 : 1,
                                paddingRight: 16,
                            })}
                        >
                            <IconSymbol name="chevron.left" size={20} color={colors.text} />
                        </Pressable>
                    ) : undefined,
                }}
            />

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                    <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
                        Processing Mode
                    </ThemedText>

                    <View style={[styles.modeCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <View style={styles.modeHeader}>
                            <View style={[styles.modeIcon, { backgroundColor: colors.primary }]}>
                                <IconSymbol name="waveform" size={20} color={colors.textInverse} />
                            </View>
                            <View style={styles.modeInfo}>
                                <ThemedText style={[styles.modeTitle, { color: colors.text }]}>
                                    Cloud Processing
                                </ThemedText>
                                <ThemedText style={[styles.modeDescription, { color: colors.textSecondary }]}>
                                    Voice audio is processed in the cloud for fast, accurate extraction.
                                </ThemedText>
                            </View>
                            <IconSymbol name="checkmark.circle.fill" size={22} color={colors.success} />
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
                        Notes
                    </ThemedText>
                    <View style={[styles.infoCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <IconSymbol name="info.circle" size={20} color={colors.primary} />
                        <ThemedText style={[styles.infoText, { color: colors.textSecondary }]}>
                            Requires an internet connection. Audio is processed securely by our Edge Function pipeline.
                        </ThemedText>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        padding: Spacing.md,
    },
    section: {
        marginBottom: Spacing.xl,
    },
    sectionTitle: {
        ...Typography.footnote,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: Spacing.sm,
    },
    modeCard: {
        borderRadius: Radius.lg,
        borderWidth: 1,
        padding: Spacing.md,
    },
    modeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    modeIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modeInfo: {
        flex: 1,
    },
    modeTitle: {
        ...Typography.headline,
        marginBottom: 2,
    },
    modeDescription: {
        ...Typography.footnote,
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: Spacing.md,
        borderRadius: Radius.lg,
        borderWidth: 1,
        gap: Spacing.sm,
    },
    infoText: {
        flex: 1,
        ...Typography.footnote,
        lineHeight: 20,
    },
});
