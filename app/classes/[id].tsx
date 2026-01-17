/**
 * Class Session Detail (Athlete)
 *
 * Shows session info, exercises, and check-in action.
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import {
    checkInToSession,
    ClassCheckin,
    ClassSession,
    getClassSession,
    getMyCheckin,
    getMyParticipation,
    leaveClassSession,
} from '@/lib/services/classes';

export default function ClassSessionDetailScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [session, setSession] = useState<ClassSession | null>(null);
    const [checkin, setCheckin] = useState<ClassCheckin | null>(null);
    const [isJoined, setIsJoined] = useState(false);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        if (!id) return;

        const [sessionResult, checkinResult, participationResult] = await Promise.all([
            getClassSession(id),
            getMyCheckin(id),
            getMyParticipation(id),
        ]);

        if (sessionResult.data) {
            setSession(sessionResult.data);
        }

        if (checkinResult.data) {
            setCheckin(checkinResult.data);
        }

        if (participationResult.data?.status === 'joined') {
            setIsJoined(true);
        }

        setLoading(false);
    };

    const handleCheckIn = async () => {
        if (!id || checkin) return;

        setActionLoading(true);
        const result = await checkInToSession(id);
        setActionLoading(false);

        if (result.error) {
            Alert.alert('Error', result.error);
        } else if (result.data) {
            setCheckin(result.data);
            Alert.alert('Checked In!', 'You\'re ready for class. Have a great workout!');
        }
    };

    const handleLeave = async () => {
        Alert.alert(
            'Leave Class',
            'Are you sure you want to leave this class?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: async () => {
                        setActionLoading(true);
                        const result = await leaveClassSession(id!);
                        setActionLoading(false);

                        if (result.error) {
                            Alert.alert('Error', result.error);
                        } else {
                            router.back();
                        }
                    },
                },
            ]
        );
    };

    const formatSessionTime = () => {
        if (!session) return '';
        const date = new Date(session.startAt);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const getTimeUntilStart = () => {
        if (!session) return '';
        const diff = new Date(session.startAt).getTime() - Date.now();

        if (diff < 0) return 'Started';
        if (diff < 60 * 1000) return 'Starting now!';
        if (diff < 60 * 60 * 1000) return `${Math.round(diff / 60000)} min`;
        if (diff < 24 * 60 * 60 * 1000) return `${Math.round(diff / 3600000)} hours`;
        return `${Math.round(diff / 86400000)} days`;
    };

    const canCheckIn = () => {
        if (!session || checkin) return false;
        // Allow check-in within 30 min before start
        const diff = new Date(session.startAt).getTime() - Date.now();
        return diff < 30 * 60 * 1000 && diff > -60 * 60 * 1000; // 30min before to 60min after
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={Colors.dark.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (!session) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centered}>
                    <Text style={styles.errorText}>Session not found</Text>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Text style={styles.backLink}>Go back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{session.name}</Text>
                <TouchableOpacity onPress={handleLeave} style={styles.leaveButton}>
                    <Ionicons name="exit-outline" size={20} color={Colors.dark.error} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {/* Status Card */}
                <View style={styles.statusCard}>
                    {checkin ? (
                        <>
                            <View style={styles.checkedInIcon}>
                                <Ionicons name="checkmark-circle" size={32} color={Colors.dark.success} />
                            </View>
                            <Text style={styles.statusTitle}>You're Checked In</Text>
                            <Text style={styles.statusSubtitle}>
                                Checked in at {new Date(checkin.checkedInAt).toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                })}
                            </Text>
                        </>
                    ) : (
                        <>
                            <View style={styles.countdownContainer}>
                                <Text style={styles.countdownValue}>{getTimeUntilStart()}</Text>
                                <Text style={styles.countdownLabel}>until class starts</Text>
                            </View>
                        </>
                    )}
                </View>

                {/* Session Info */}
                <View style={styles.infoSection}>
                    <View style={styles.infoRow}>
                        <Ionicons name="calendar-outline" size={18} color={Colors.dark.textSecondary} />
                        <Text style={styles.infoText}>{formatSessionTime()}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="people-outline" size={18} color={Colors.dark.textSecondary} />
                        <Text style={styles.infoText}>
                            {session.currentParticipantCount} of {session.capacity} athletes
                        </Text>
                    </View>
                    {session.locationName && (
                        <View style={styles.infoRow}>
                            <Ionicons name="location-outline" size={18} color={Colors.dark.textSecondary} />
                            <Text style={styles.infoText}>{session.locationName}</Text>
                        </View>
                    )}
                </View>

                {/* Exercises Preview */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Today's Workout</Text>
                    {(session.exercisesJson ?? []).map((exercise, index) => (
                        <View key={index} style={styles.exerciseRow}>
                            <Text style={styles.exerciseIndex}>{index + 1}</Text>
                            <View style={styles.exerciseInfo}>
                                <Text style={styles.exerciseName}>{exercise.name}</Text>
                                <Text style={styles.exerciseMeta}>
                                    {exercise.sets} × {exercise.reps}
                                    {exercise.weight ? ` @ ${exercise.weight}` : ''}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>
            </ScrollView>

            {/* Action Button */}
            {!checkin && (
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.checkInButton, !canCheckIn() && styles.checkInButtonDisabled]}
                        onPress={handleCheckIn}
                        disabled={!canCheckIn() || actionLoading}
                    >
                        {actionLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="checkmark-circle" size={22} color="#fff" />
                                <Text style={styles.checkInButtonText}>
                                    {canCheckIn() ? 'Check In' : 'Check-in opens 30 min before'}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        fontSize: 16,
        color: Colors.dark.textSecondary,
        marginBottom: 12,
    },
    backLink: {
        fontSize: 16,
        color: Colors.dark.primary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
    },
    backButton: {
        padding: 4,
        marginRight: 12,
    },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '600',
        color: Colors.dark.text,
    },
    leaveButton: {
        padding: 4,
    },
    content: {
        flex: 1,
    },
    statusCard: {
        backgroundColor: Colors.dark.card,
        margin: 16,
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    checkedInIcon: {
        marginBottom: 12,
    },
    statusTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.dark.success,
        marginBottom: 4,
    },
    statusSubtitle: {
        fontSize: 14,
        color: Colors.dark.textSecondary,
    },
    countdownContainer: {
        alignItems: 'center',
    },
    countdownValue: {
        fontSize: 32,
        fontWeight: '700',
        color: Colors.dark.primary,
        marginBottom: 4,
    },
    countdownLabel: {
        fontSize: 14,
        color: Colors.dark.textSecondary,
    },
    infoSection: {
        paddingHorizontal: 16,
        gap: 12,
        marginBottom: 24,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    infoText: {
        fontSize: 15,
        color: Colors.dark.text,
    },
    section: {
        padding: 16,
        paddingTop: 0,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.dark.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    exerciseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
    },
    exerciseIndex: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.dark.primary,
        width: 28,
    },
    exerciseInfo: {
        flex: 1,
    },
    exerciseName: {
        fontSize: 15,
        fontWeight: '500',
        color: Colors.dark.text,
        marginBottom: 2,
    },
    exerciseMeta: {
        fontSize: 13,
        color: Colors.dark.textSecondary,
    },
    footer: {
        padding: 16,
        paddingBottom: 24,
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
    },
    checkInButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.dark.success,
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    checkInButtonDisabled: {
        backgroundColor: Colors.dark.textSecondary,
        opacity: 0.6,
    },
    checkInButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
