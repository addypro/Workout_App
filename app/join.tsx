/**
 * Join Coach Screen
 *
 * Handles athlete joining a coach via invite link/code.
 * Deep link: workoutapp://join?code=ABC123 or workoutapp://join?token=xxx
 */

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/context/auth-context';
import {
    acceptInvite,
    lookupInvite,
    lookupInviteByToken,
} from '@/lib/services/coach';
import type { CoachInvite } from '@/lib/services/coach/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    StyleSheet,
    Switch,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PENDING_INVITE_KEY = '@pending_coach_invite';

type InviteLookup = {
    invite: CoachInvite;
    coachName: string;
    coachBio?: string;
};

export default function JoinCoachScreen() {
    const { code, token } = useLocalSearchParams<{ code?: string; token?: string }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const { user, isLoading: authLoading } = useAuth();

    const [inviteData, setInviteData] = useState<InviteLookup | null>(null);
    const [loading, setLoading] = useState(true);
    const [accepting, setAccepting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Privacy toggles
    const [shareHistory, setShareHistory] = useState(true);
    const [shareMetrics, setShareMetrics] = useState(false);

    // Store invite params for after auth
    useEffect(() => {
        if (code || token) {
            AsyncStorage.setItem(PENDING_INVITE_KEY, JSON.stringify({ code, token }));
        }
    }, [code, token]);

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!authLoading && !user && (code || token)) {
            // Save params and redirect to login
            const returnPath = token ? `/join?token=${token}` : `/join?code=${code}`;
            router.replace(`/(auth)/login?returnUrl=${encodeURIComponent(returnPath)}`);
        }
    }, [authLoading, user, code, token, router]);

    // Look up invite
    useEffect(() => {
        if (!user) return;

        const lookup = async () => {
            setLoading(true);
            setError(null);

            try {
                let result;
                if (token) {
                    result = await lookupInviteByToken(token);
                } else if (code) {
                    result = await lookupInvite(code);
                } else {
                    // Check for pending invite from auth flow
                    const pending = await AsyncStorage.getItem(PENDING_INVITE_KEY);
                    if (pending) {
                        const { code: pendingCode, token: pendingToken } = JSON.parse(pending);
                        await AsyncStorage.removeItem(PENDING_INVITE_KEY);
                        if (pendingToken) {
                            result = await lookupInviteByToken(pendingToken);
                        } else if (pendingCode) {
                            result = await lookupInvite(pendingCode);
                        }
                    }
                }

                if (!result) {
                    setError('No invite code or link provided');
                    return;
                }

                if (!result.success || !result.data) {
                    setError(result.error || 'Invalid or expired invite');
                    return;
                }

                setInviteData(result.data);
            } catch (err) {
                console.error('[Join] Lookup error:', err);
                setError('Failed to look up invite');
            } finally {
                setLoading(false);
            }
        };

        lookup();
    }, [user, code, token]);

    const handleAccept = async () => {
        if (!inviteData?.invite.inviteCode) return;

        setAccepting(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const result = await acceptInvite({
                inviteCode: inviteData.invite.inviteCode,
                shareWorkoutHistory: shareHistory,
                shareBodyMetrics: shareMetrics,
            });

            if (!result.success) {
                const msg = result.error || 'Failed to join';
                Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
                setAccepting(false);
                return;
            }

            // Clear pending invite
            await AsyncStorage.removeItem(PENDING_INVITE_KEY);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Navigate to home - the NavigationGuard will handle athlete routing
            router.replace('/(tabs)');
        } catch (err) {
            console.error('[Join] Accept error:', err);
            const msg = 'Something went wrong. Please try again.';
            Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
            setAccepting(false);
        }
    };

    const handleCancel = async () => {
        await AsyncStorage.removeItem(PENDING_INVITE_KEY);
        router.replace('/(tabs)');
    };

    // Loading state
    if (authLoading || loading) {
        return (
            <Screen contentStyle={styles.centered}>
                <Stack.Screen options={{ headerShown: false }} />
                <ActivityIndicator size="large" color={colors.tint} />
                <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
                    Looking up invite...
                </ThemedText>
            </Screen>
        );
    }

    // Error state
    if (error) {
        return (
            <Screen contentStyle={styles.centered}>
                <Stack.Screen options={{ headerShown: false }} />
                <View style={[styles.errorIcon, { backgroundColor: colors.error + '20' }]}>
                    <IconSymbol name="xmark.circle" size={48} color={colors.error} />
                </View>
                <ThemedText style={[styles.errorTitle, { color: colors.text }]}>
                    Invalid Invite
                </ThemedText>
                <ThemedText style={[styles.errorMessage, { color: colors.textSecondary }]}>
                    {error}
                </ThemedText>
                <Pressable
                    style={[styles.button, { backgroundColor: colors.tint }]}
                    onPress={() => router.replace('/(tabs)')}
                >
                    <ThemedText style={styles.buttonText}>Go Home</ThemedText>
                </Pressable>
            </Screen>
        );
    }

    // Success - show invite details
    return (
        <Screen edges={['top', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={[styles.coachAvatar, { backgroundColor: colors.tint + '20' }]}>
                        <IconSymbol name="person.fill" size={40} color={colors.tint} />
                    </View>
                    <ThemedText style={[styles.title, { color: colors.text }]}>
                        Join {inviteData?.coachName || 'Coach'}
                    </ThemedText>
                    <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
                        {inviteData?.coachBio || 'You\'ve been invited to train with this coach'}
                    </ThemedText>
                </View>

                {/* Benefits */}
                <View style={[styles.benefitsCard, { backgroundColor: colors.card, borderColor: colors.separator }, Shadows.sm]}>
                    <ThemedText style={[styles.benefitsTitle, { color: colors.text }]}>
                        What you'll get
                    </ThemedText>
                    <BenefitRow
                        icon="figure.run"
                        text="Personalized workout programs"
                        colors={colors}
                    />
                    <BenefitRow
                        icon="calendar"
                        text="Scheduled training sessions"
                        colors={colors}
                    />
                    <BenefitRow
                        icon="chart.line.uptrend.xyaxis"
                        text="Progress tracking & feedback"
                        colors={colors}
                    />
                </View>

                {/* Privacy Settings */}
                <View style={[styles.privacyCard, { backgroundColor: colors.card, borderColor: colors.separator }, Shadows.sm]}>
                    <ThemedText style={[styles.privacyTitle, { color: colors.text }]}>
                        Share with coach
                    </ThemedText>

                    <View style={styles.toggleRow}>
                        <View style={styles.toggleInfo}>
                            <IconSymbol name="clock.arrow.circlepath" size={20} color={colors.tint} />
                            <View>
                                <ThemedText style={[styles.toggleLabel, { color: colors.text }]}>
                                    Workout History
                                </ThemedText>
                                <ThemedText style={[styles.toggleDesc, { color: colors.textTertiary }]}>
                                    Past workouts and performance
                                </ThemedText>
                            </View>
                        </View>
                        <Switch
                            value={shareHistory}
                            onValueChange={setShareHistory}
                            trackColor={{ true: colors.tint, false: colors.separator }}
                        />
                    </View>

                    <View style={[styles.divider, { backgroundColor: colors.separator }]} />

                    <View style={styles.toggleRow}>
                        <View style={styles.toggleInfo}>
                            <IconSymbol name="scalemass" size={20} color={colors.tint} />
                            <View>
                                <ThemedText style={[styles.toggleLabel, { color: colors.text }]}>
                                    Body Metrics
                                </ThemedText>
                                <ThemedText style={[styles.toggleDesc, { color: colors.textTertiary }]}>
                                    Weight, measurements, etc.
                                </ThemedText>
                            </View>
                        </View>
                        <Switch
                            value={shareMetrics}
                            onValueChange={setShareMetrics}
                            trackColor={{ true: colors.tint, false: colors.separator }}
                        />
                    </View>
                </View>
            </View>

            {/* Footer */}
            <View style={[styles.footer, { backgroundColor: colors.glassBackground, borderTopColor: colors.separator, paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
                <Pressable
                    style={[styles.cancelButton, { borderColor: colors.separator }]}
                    onPress={handleCancel}
                >
                    <ThemedText style={[styles.cancelText, { color: colors.textSecondary }]}>
                        Cancel
                    </ThemedText>
                </Pressable>
                <Pressable
                    style={[styles.joinButton, { backgroundColor: colors.tint }, accepting && styles.buttonDisabled]}
                    onPress={handleAccept}
                    disabled={accepting}
                >
                    {accepting ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <>
                            <IconSymbol name="checkmark" size={18} color="#fff" />
                            <ThemedText style={styles.joinText}>Join Coach</ThemedText>
                        </>
                    )}
                </Pressable>
            </View>
        </Screen>
    );
}

function BenefitRow({ icon, text, colors }: { icon: 'figure.run' | 'calendar' | 'chart.line.uptrend.xyaxis'; text: string; colors: typeof Colors.light }) {
    return (
        <View style={styles.benefitRow}>
            <View style={[styles.benefitIcon, { backgroundColor: colors.tint + '15' }]}>
                <IconSymbol name={icon} size={16} color={colors.tint} />
            </View>
            <ThemedText style={[styles.benefitText, { color: colors.text }]}>{text}</ThemedText>
        </View>
    );
}

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.xl,
        gap: Spacing.md,
    },
    loadingText: {
        ...Typography.body,
        marginTop: Spacing.md,
    },
    errorIcon: {
        width: 88,
        height: 88,
        borderRadius: 44,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.md,
    },
    errorTitle: {
        ...Typography.title2,
        marginBottom: Spacing.xs,
    },
    errorMessage: {
        ...Typography.body,
        textAlign: 'center',
        marginBottom: Spacing.xl,
    },
    button: {
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        borderRadius: Radius.lg,
    },
    buttonText: {
        ...Typography.headline,
        color: '#fff',
    },
    content: {
        flex: 1,
        padding: Spacing.lg,
        gap: Spacing.lg,
    },
    header: {
        alignItems: 'center',
        paddingTop: Spacing.xl,
        gap: Spacing.sm,
    },
    coachAvatar: {
        width: 88,
        height: 88,
        borderRadius: 44,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.sm,
    },
    title: {
        ...Typography.title1,
    },
    subtitle: {
        ...Typography.body,
        textAlign: 'center',
        paddingHorizontal: Spacing.lg,
    },
    benefitsCard: {
        padding: Spacing.md,
        borderRadius: Radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        gap: Spacing.sm,
    },
    benefitsTitle: {
        ...Typography.subhead,
        fontWeight: '600',
        marginBottom: Spacing.xs,
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    benefitIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    benefitText: {
        ...Typography.body,
    },
    privacyCard: {
        padding: Spacing.md,
        borderRadius: Radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        gap: Spacing.sm,
    },
    privacyTitle: {
        ...Typography.subhead,
        fontWeight: '600',
        marginBottom: Spacing.xs,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    toggleInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        flex: 1,
    },
    toggleLabel: {
        ...Typography.subhead,
        fontWeight: '500',
    },
    toggleDesc: {
        ...Typography.caption1,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        marginVertical: Spacing.xs,
    },
    footer: {
        flexDirection: 'row',
        gap: Spacing.sm,
        padding: Spacing.md,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    cancelButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: Radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
    },
    cancelText: {
        ...Typography.headline,
    },
    joinButton: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: Radius.lg,
    },
    joinText: {
        ...Typography.headline,
        color: '#fff',
    },
    buttonDisabled: {
        opacity: 0.7,
    },
});
