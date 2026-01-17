/**
 * Class Template Detail / Schedule
 *
 * View template details and schedule new sessions.
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
    cancelClassSession,
    ClassSession,
    ClassTemplate,
    completeClassSession,
    createClassSession,
    deleteClassSession,
    deleteClassTemplate,
    getClassTemplate,
    getMyUpcomingSessions,
    startClassSession,
} from '@/lib/services/classes';

export default function ClassDetailScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [template, setTemplate] = useState<ClassTemplate | null>(null);
    const [sessions, setSessions] = useState<ClassSession[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        if (!id) return;

        const [templateResult, sessionsResult] = await Promise.all([
            getClassTemplate(id),
            getMyUpcomingSessions(),
        ]);

        if (templateResult.data) {
            setTemplate(templateResult.data);
        }

        if (sessionsResult.data) {
            // Filter sessions for this template
            setSessions(sessionsResult.data.items.filter((s) => s.templateId === id));
        }

        setLoading(false);
    };

    const handleEdit = () => {
        router.push(`/coach/classes/builder?id=${id}`);
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Template',
            'Are you sure you want to delete this template? This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const result = await deleteClassTemplate(id!);
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

    const handleScheduleSession = async () => {
        if (!template) return;

        // Quick schedule for tomorrow at 9 AM (in real app, show date picker)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);

        const result = await createClassSession({
            templateId: template.id,
            startAt: tomorrow,
        });

        if (result.error) {
            Alert.alert('Error', result.error);
        } else {
            Alert.alert('Scheduled!', `Class scheduled for ${tomorrow.toLocaleDateString()}`);
            loadData();
        }
    };

    const handleStartSession = async (sessionId: string) => {
        Alert.alert('Start Class', 'Mark this class as "In Progress"?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Start',
                onPress: async () => {
                    const result = await startClassSession(sessionId);
                    if (result.error) {
                        Alert.alert('Error', result.error);
                    } else {
                        loadData();
                    }
                },
            },
        ]);
    };

    const handleEndSession = async (sessionId: string) => {
        Alert.alert('End Class', 'Mark this class as "Completed"? This will create workout logs for all checked-in athletes.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'End Class',
                onPress: async () => {
                    const result = await completeClassSession(sessionId);
                    if (result.error) {
                        Alert.alert('Error', result.error);
                    } else {
                        Alert.alert('Class Ended', 'Workout logs have been created for participants.');
                        loadData();
                    }
                },
            },
        ]);
    };

    const handleCancelSession = (sessionId: string) => {
        Alert.alert('Cancel Class', 'Are you sure you want to cancel this session? Participants will be notified.', [
            { text: 'Keep', style: 'cancel' },
            {
                text: 'Cancel Class',
                style: 'destructive',
                onPress: async () => {
                    const result = await cancelClassSession(sessionId);
                    if (result.error) {
                        Alert.alert('Error', result.error);
                    } else {
                        loadData();
                    }
                },
            },
        ]);
    };

    const handleDeleteSession = (sessionId: string) => {
        Alert.alert('Delete Session', 'Permanently delete this session?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    const result = await deleteClassSession(sessionId);
                    if (result.error) {
                        Alert.alert('Error', result.error);
                    } else {
                        loadData();
                    }
                },
            },
        ]);
    };

    const handleViewRoster = (sessionId: string) => {
        router.push(`/coach/classes/roster?id=${sessionId}`);
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

    if (!template) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centered}>
                    <Text style={styles.errorText}>Template not found</Text>
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
                <Text style={styles.headerTitle} numberOfLines={1}>{template.name}</Text>
                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={handleEdit} style={styles.headerAction}>
                        <Ionicons name="pencil" size={20} color={Colors.dark.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleDelete} style={styles.headerAction}>
                        <Ionicons name="trash-outline" size={20} color={Colors.dark.error} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={styles.content}>
                {/* Template Info */}
                <View style={styles.infoCard}>
                    {template.description && (
                        <Text style={styles.description}>{template.description}</Text>
                    )}
                    <View style={styles.statsRow}>
                        <View style={styles.stat}>
                            <Ionicons name="barbell-outline" size={20} color={Colors.dark.primary} />
                            <Text style={styles.statValue}>{template.exercisesJson.length}</Text>
                            <Text style={styles.statLabel}>exercises</Text>
                        </View>
                        <View style={styles.stat}>
                            <Ionicons name="time-outline" size={20} color={Colors.dark.primary} />
                            <Text style={styles.statValue}>{template.estimatedDurationMinutes}</Text>
                            <Text style={styles.statLabel}>minutes</Text>
                        </View>
                        <View style={styles.stat}>
                            <Ionicons name="people-outline" size={20} color={Colors.dark.primary} />
                            <Text style={styles.statValue}>{template.defaultCapacity}</Text>
                            <Text style={styles.statLabel}>max</Text>
                        </View>
                    </View>
                </View>

                {/* Exercises */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Exercises</Text>
                    {template.exercisesJson.map((exercise, index) => (
                        <View key={index} style={styles.exerciseRow}>
                            <Text style={styles.exerciseIndex}>{index + 1}</Text>
                            <View style={styles.exerciseInfo}>
                                <Text style={styles.exerciseName}>{exercise.name}</Text>
                                <Text style={styles.exerciseMeta}>
                                    {exercise.sets} × {exercise.reps}
                                    {exercise.restSeconds ? ` • ${exercise.restSeconds}s rest` : ''}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Upcoming Sessions */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Upcoming Sessions</Text>
                    {sessions.length === 0 ? (
                        <View style={styles.emptySession}>
                            <Text style={styles.emptySessionText}>No sessions scheduled</Text>
                        </View>
                    ) : (
                        sessions.map((session) => {
                            const isInProgress = session.status === 'in_progress';
                            return (
                                <View key={session.id} style={styles.sessionCard}>
                                    <View style={styles.sessionHeader}>
                                        <View style={styles.sessionDateRow}>
                                            <Ionicons
                                                name={isInProgress ? "pulse" : "calendar-outline"}
                                                size={18}
                                                color={isInProgress ? Colors.dark.success : Colors.dark.primary}
                                            />
                                            <Text style={styles.sessionDate}>
                                                {new Date(session.startAt).toLocaleDateString('en-US', {
                                                    weekday: 'short',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: 'numeric',
                                                    minute: '2-digit',
                                                })}
                                            </Text>
                                        </View>
                                        <View style={[
                                            styles.statusBadge,
                                            isInProgress && styles.statusBadgeActive,
                                        ]}>
                                            <Text style={[
                                                styles.statusText,
                                                isInProgress && styles.statusTextActive,
                                            ]}>
                                                {isInProgress ? 'In Progress' : 'Scheduled'}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.sessionMeta}>
                                        <TouchableOpacity
                                            style={styles.rosterLink}
                                            onPress={() => handleViewRoster(session.id)}
                                        >
                                            <Ionicons name="people" size={16} color={Colors.dark.primary} />
                                            <Text style={styles.rosterText}>
                                                {session.currentParticipantCount}/{session.capacity} joined
                                            </Text>
                                            <Ionicons name="chevron-forward" size={14} color={Colors.dark.textSecondary} />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.sessionActions}>
                                        {!isInProgress && (
                                            <TouchableOpacity
                                                style={styles.startButton}
                                                onPress={() => handleStartSession(session.id)}
                                            >
                                                <Ionicons name="play" size={16} color="#fff" />
                                                <Text style={styles.startButtonText}>Start</Text>
                                            </TouchableOpacity>
                                        )}
                                        {isInProgress && (
                                            <TouchableOpacity
                                                style={styles.endButton}
                                                onPress={() => handleEndSession(session.id)}
                                            >
                                                <Ionicons name="stop" size={16} color="#fff" />
                                                <Text style={styles.endButtonText}>End Class</Text>
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity
                                            style={styles.cancelButton}
                                            onPress={() => handleCancelSession(session.id)}
                                        >
                                            <Ionicons name="close-circle-outline" size={16} color={Colors.dark.warning} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.deleteButton}
                                            onPress={() => handleDeleteSession(session.id)}
                                        >
                                            <Ionicons name="trash-outline" size={16} color={Colors.dark.error} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>
            </ScrollView>

            {/* Schedule Button */}
            <View style={styles.footer}>
                <TouchableOpacity style={styles.scheduleButton} onPress={handleScheduleSession}>
                    <Ionicons name="calendar" size={20} color="#fff" />
                    <Text style={styles.scheduleButtonText}>Schedule Class</Text>
                </TouchableOpacity>
            </View>
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
    headerActions: {
        flexDirection: 'row',
        gap: 12,
    },
    headerAction: {
        padding: 4,
    },
    content: {
        flex: 1,
    },
    infoCard: {
        backgroundColor: Colors.dark.card,
        margin: 16,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    description: {
        fontSize: 14,
        color: Colors.dark.textSecondary,
        marginBottom: 16,
        lineHeight: 20,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    stat: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.dark.text,
        marginTop: 4,
    },
    statLabel: {
        fontSize: 12,
        color: Colors.dark.textSecondary,
        marginTop: 2,
    },
    section: {
        padding: 16,
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
    emptySession: {
        backgroundColor: Colors.dark.card,
        padding: 16,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    emptySessionText: {
        color: Colors.dark.textSecondary,
    },
    sessionCard: {
        backgroundColor: Colors.dark.card,
        padding: 14,
        borderRadius: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    sessionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    sessionDateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sessionDate: {
        color: Colors.dark.text,
        fontSize: 14,
    },
    sessionCount: {
        color: Colors.dark.textSecondary,
        fontSize: 13,
    },
    statusBadge: {
        backgroundColor: Colors.dark.border,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
    },
    statusBadgeActive: {
        backgroundColor: Colors.dark.success + '20',
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
        color: Colors.dark.textSecondary,
    },
    statusTextActive: {
        color: Colors.dark.success,
    },
    sessionMeta: {
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
        paddingTop: 10,
        marginBottom: 10,
    },
    rosterLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    rosterText: {
        color: Colors.dark.primary,
        fontSize: 13,
        flex: 1,
    },
    sessionActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
        paddingTop: 10,
    },
    startButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.success,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        gap: 4,
    },
    startButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    endButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        gap: 4,
    },
    endButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    cancelButton: {
        padding: 6,
    },
    deleteButton: {
        padding: 6,
    },
    footer: {
        padding: 16,
        paddingBottom: 24,
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
    },
    scheduleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.dark.primary,
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    scheduleButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
