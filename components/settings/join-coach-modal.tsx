/**
 * Join Coach Modal
 *
 * Modal for athletes to manually enter an invite code from their coach.
 */

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
    acceptInvite,
    lookupInvite,
} from '@/lib/services/coach';
import type { CoachInvite } from '@/lib/services/coach/types';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Switch,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface JoinCoachModalProps {
    visible: boolean;
    onClose: () => void;
}

type InviteLookup = {
    invite: CoachInvite;
    coachName: string;
    coachBio?: string;
};

export function JoinCoachModal({ visible, onClose }: JoinCoachModalProps) {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    const [code, setCode] = useState('');
    const [step, setStep] = useState<'enter' | 'preview'>('enter');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [inviteData, setInviteData] = useState<InviteLookup | null>(null);
    const [shareHistory, setShareHistory] = useState(true);
    const [shareMetrics, setShareMetrics] = useState(false);

    const handleLookup = async () => {
        if (!code.trim()) {
            setError('Please enter an invite code');
            return;
        }

        setLoading(true);
        setError(null);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            const result = await lookupInvite(code.trim().toUpperCase());

            if (!result.success || !result.data) {
                setError(result.error || 'Invalid or expired code');
                setLoading(false);
                return;
            }

            setInviteData(result.data);
            setStep('preview');
        } catch (err) {
            console.error('[JoinCoachModal] Lookup error:', err);
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async () => {
        if (!inviteData?.invite.inviteCode) return;

        setLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const result = await acceptInvite({
                inviteCode: inviteData.invite.inviteCode,
                shareWorkoutHistory: shareHistory,
                shareBodyMetrics: shareMetrics,
            });

            if (!result.success) {
                Alert.alert('Error', result.error || 'Failed to join');
                setLoading(false);
                return;
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            handleClose();

            // Navigate to home - NavigationGuard handles athlete routing
            router.replace('/(tabs)');
        } catch (err) {
            console.error('[JoinCoachModal] Accept error:', err);
            Alert.alert('Error', 'Something went wrong. Please try again.');
            setLoading(false);
        }
    };

    const handleClose = () => {
        setCode('');
        setStep('enter');
        setError(null);
        setInviteData(null);
        setShareHistory(true);
        setShareMetrics(false);
        setLoading(false);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleClose}
        >
            <KeyboardAvoidingView
                style={[styles.container, { backgroundColor: colors.background }]}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.separator }]}>
                    <Pressable onPress={handleClose} hitSlop={8}>
                        <ThemedText style={[styles.cancelText, { color: colors.tint }]}>Cancel</ThemedText>
                    </Pressable>
                    <ThemedText style={[styles.headerTitle, { color: colors.text }]}>
                        Join Coach
                    </ThemedText>
                    <View style={{ width: 50 }} />
                </View>

                {step === 'enter' ? (
                    <View style={styles.content}>
                        {/* Icon */}
                        <View style={[styles.iconContainer, { backgroundColor: colors.tint + '15' }]}>
                            <IconSymbol name="person.badge.plus" size={40} color={colors.tint} />
                        </View>

                        <ThemedText style={[styles.title, { color: colors.text }]}>
                            Enter Invite Code
                        </ThemedText>
                        <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
                            Your coach can share this code with you via text, email, or in person
                        </ThemedText>

                        {/* Code Input */}
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    backgroundColor: colors.card,
                                    color: colors.text,
                                    borderColor: error ? colors.error : colors.separator,
                                },
                            ]}
                            value={code}
                            onChangeText={(text) => {
                                setCode(text.toUpperCase());
                                setError(null);
                            }}
                            placeholder="Enter 8-character code"
                            placeholderTextColor={colors.textTertiary}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            maxLength={10}
                            returnKeyType="done"
                            onSubmitEditing={handleLookup}
                        />

                        {error && (
                            <View style={styles.errorRow}>
                                <IconSymbol name="exclamationmark.circle" size={16} color={colors.error} />
                                <ThemedText style={[styles.errorText, { color: colors.error }]}>{error}</ThemedText>
                            </View>
                        )}

                        {/* Continue Button */}
                        <Pressable
                            style={[
                                styles.button,
                                { backgroundColor: colors.tint },
                                loading && styles.buttonDisabled,
                            ]}
                            onPress={handleLookup}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <ThemedText style={styles.buttonText}>Continue</ThemedText>
                            )}
                        </Pressable>
                    </View>
                ) : (
                    <View style={styles.content}>
                        {/* Coach Preview */}
                        <View style={[styles.coachCard, { backgroundColor: colors.card, borderColor: colors.separator }, Shadows.sm]}>
                            <View style={[styles.coachAvatar, { backgroundColor: colors.tint + '20' }]}>
                                <IconSymbol name="person.fill" size={32} color={colors.tint} />
                            </View>
                            <ThemedText style={[styles.coachName, { color: colors.text }]}>
                                {inviteData?.coachName || 'Coach'}
                            </ThemedText>
                            {inviteData?.coachBio && (
                                <ThemedText style={[styles.coachBio, { color: colors.textSecondary }]}>
                                    {inviteData.coachBio}
                                </ThemedText>
                            )}
                        </View>

                        {/* Privacy Toggles */}
                        <View style={[styles.privacyCard, { backgroundColor: colors.card, borderColor: colors.separator }]}>
                            <ThemedText style={[styles.privacyTitle, { color: colors.text }]}>
                                Share with coach
                            </ThemedText>

                            <View style={styles.toggleRow}>
                                <View style={styles.toggleInfo}>
                                    <IconSymbol name="clock.arrow.circlepath" size={18} color={colors.tint} />
                                    <ThemedText style={[styles.toggleLabel, { color: colors.text }]}>
                                        Workout History
                                    </ThemedText>
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
                                    <IconSymbol name="scalemass" size={18} color={colors.tint} />
                                    <ThemedText style={[styles.toggleLabel, { color: colors.text }]}>
                                        Body Metrics
                                    </ThemedText>
                                </View>
                                <Switch
                                    value={shareMetrics}
                                    onValueChange={setShareMetrics}
                                    trackColor={{ true: colors.tint, false: colors.separator }}
                                />
                            </View>
                        </View>

                        {/* Actions */}
                        <View style={styles.actions}>
                            <Pressable
                                style={[styles.backButton, { borderColor: colors.separator }]}
                                onPress={() => setStep('enter')}
                            >
                                <ThemedText style={[styles.backText, { color: colors.textSecondary }]}>Back</ThemedText>
                            </Pressable>
                            <Pressable
                                style={[
                                    styles.joinButton,
                                    { backgroundColor: colors.tint },
                                    loading && styles.buttonDisabled,
                                ]}
                                onPress={handleAccept}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <IconSymbol name="checkmark" size={18} color="#fff" />
                                        <ThemedText style={styles.buttonText}>Join Coach</ThemedText>
                                    </>
                                )}
                            </Pressable>
                        </View>
                    </View>
                )}
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerTitle: {
        ...Typography.headline,
    },
    cancelText: {
        ...Typography.body,
    },
    content: {
        flex: 1,
        padding: Spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.md,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.sm,
    },
    title: {
        ...Typography.title2,
        textAlign: 'center',
    },
    subtitle: {
        ...Typography.body,
        textAlign: 'center',
        paddingHorizontal: Spacing.lg,
    },
    input: {
        width: '100%',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        borderRadius: Radius.md,
        borderWidth: 1,
        fontSize: 20,
        fontWeight: '600',
        textAlign: 'center',
        letterSpacing: 2,
        marginTop: Spacing.md,
    },
    errorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    errorText: {
        ...Typography.caption1,
    },
    button: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: Radius.lg,
        alignItems: 'center',
        marginTop: Spacing.md,
    },
    buttonText: {
        ...Typography.headline,
        color: '#fff',
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    coachCard: {
        width: '100%',
        padding: Spacing.lg,
        borderRadius: Radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        gap: Spacing.sm,
    },
    coachAvatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    coachName: {
        ...Typography.title3,
    },
    coachBio: {
        ...Typography.body,
        textAlign: 'center',
    },
    privacyCard: {
        width: '100%',
        padding: Spacing.md,
        borderRadius: Radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        gap: Spacing.sm,
    },
    privacyTitle: {
        ...Typography.subhead,
        fontWeight: '600',
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
    },
    toggleLabel: {
        ...Typography.body,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
    },
    actions: {
        flexDirection: 'row',
        gap: Spacing.sm,
        width: '100%',
        marginTop: Spacing.md,
    },
    backButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: Radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
    },
    backText: {
        ...Typography.headline,
    },
    joinButton: {
        flex: 2,
        flexDirection: 'row',
        paddingVertical: 14,
        borderRadius: Radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
});
