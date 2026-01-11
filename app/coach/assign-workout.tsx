/**
 * Assign Workout Screen
 *
 * Allows coaches to assign a quick workout or single program workout to athletes:
 * - Multi-athlete selection with select all
 * - Date picker for scheduled date
 * - Optional time picker
 * - Coach notes
 */

import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/screen';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
    AthleteStatus,
    CoachAthlete,
    getMyAthletes,
    ProgramExercise,
} from '@/lib/services/coach';

export default function AssignWorkoutScreen() {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ workoutName?: string; exercises?: string }>();

    // Parse workout data from params
    const workoutName = params.workoutName || 'Quick Workout';
    const exercises: ProgramExercise[] = params.exercises
        ? JSON.parse(params.exercises)
        : [];

    const [athletes, setAthletes] = useState<CoachAthlete[]>([]);
    const [selectedAthletes, setSelectedAthletes] = useState<Set<string>>(new Set());
    const [scheduledDate, setScheduledDate] = useState(new Date());
    const [scheduledTime, setScheduledTime] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isAssigning, setIsAssigning] = useState(false);

    // Load athletes
    useEffect(() => {
        loadAthletes();
    }, []);

    const loadAthletes = async () => {
        setIsLoading(true);
        try {
            const result = await getMyAthletes(AthleteStatus.ACTIVE, 1, 100);
            if (result.success && result.data) {
                setAthletes(result.data.data);
            }
        } catch (error) {
            console.error('Error loading athletes:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Toggle athlete selection
    const toggleAthlete = (athleteId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const newSelection = new Set(selectedAthletes);
        if (newSelection.has(athleteId)) {
            newSelection.delete(athleteId);
        } else {
            newSelection.add(athleteId);
        }
        setSelectedAthletes(newSelection);
    };

    // Select all athletes
    const selectAll = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (selectedAthletes.size === athletes.length) {
            setSelectedAthletes(new Set());
        } else {
            setSelectedAthletes(new Set(athletes.map(a => a.athleteUserId)));
        }
    };

    // Handle assignment
    const handleAssign = async () => {
        if (selectedAthletes.size === 0) {
            const msg = 'Select at least one athlete';
            Platform.OS === 'web' ? window.alert(msg) : Alert.alert('No Athletes', msg);
            return;
        }

        setIsAssigning(true);
        try {
            const { assignExercisesAsWorkout } = await import('@/lib/services/coach');
            const result = await assignExercisesAsWorkout(
                workoutName,
                exercises,
                Array.from(selectedAthletes),
                scheduledDate,
                scheduledTime || undefined
            );

            if (result.success && result.data) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                // Show success and go back
                const athleteCount = result.data.assignedCount;
                const msg = `Workout assigned to ${athleteCount} athlete${athleteCount > 1 ? 's' : ''}`;
                Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Success', msg);

                router.dismissAll();
                router.push('/(tabs)/coach');
            } else {
                const msg = result.error || 'Failed to assign workout';
                Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
            }
        } catch (error) {
            console.error('Error assigning workout:', error);
            const msg = 'Failed to assign workout';
            Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
        } finally {
            setIsAssigning(false);
        }
    };

    // Format date for display
    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });
    };

    // Format time for display
    const formatTime = (time: Date | null) => {
        if (!time) return 'Not set';
        return time.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const styles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: Spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.separator,
        },
        headerButton: {
            paddingVertical: Spacing.xs,
            paddingHorizontal: Spacing.md,
        },
        headerButtonText: {
            ...Typography.body,
            color: colors.tint,
            fontWeight: '600',
        },
        headerTitle: {
            ...Typography.headline,
            color: colors.text,
        },
        scrollContent: {
            padding: Spacing.lg,
            paddingBottom: 180,
        },
        // Workout Summary
        summaryCard: {
            backgroundColor: colors.groupedBackground,
            borderRadius: Radius.lg,
            padding: Spacing.lg,
            marginBottom: Spacing.lg,
        },
        summaryTitle: {
            ...Typography.title3,
            color: colors.text,
            fontWeight: '600',
        },
        summarySubtitle: {
            ...Typography.subhead,
            color: colors.textSecondary,
            marginTop: Spacing.xs,
        },
        // Date/Time Section
        sectionTitle: {
            ...Typography.headline,
            color: colors.text,
            marginBottom: Spacing.md,
        },
        dateTimeCard: {
            backgroundColor: colors.groupedBackground,
            borderRadius: Radius.lg,
            overflow: 'hidden',
            marginBottom: Spacing.lg,
        },
        dateTimeRow: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: Spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.separator,
        },
        dateTimeLabel: {
            ...Typography.body,
            color: colors.text,
            flex: 1,
        },
        dateTimeValue: {
            ...Typography.body,
            color: colors.tint,
            fontWeight: '600',
        },
        // Athletes Section
        athleteHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: Spacing.md,
        },
        selectAllButton: {
            paddingVertical: Spacing.xs,
            paddingHorizontal: Spacing.md,
        },
        selectAllText: {
            ...Typography.subhead,
            color: colors.tint,
            fontWeight: '600',
        },
        athletesList: {
            backgroundColor: colors.groupedBackground,
            borderRadius: Radius.lg,
            overflow: 'hidden',
        },
        athleteRow: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: Spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.separator,
        },
        athleteCheckbox: {
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: colors.separator,
            marginRight: Spacing.md,
            alignItems: 'center',
            justifyContent: 'center',
        },
        athleteCheckboxSelected: {
            backgroundColor: colors.tint,
            borderColor: colors.tint,
        },
        athleteInfo: {
            flex: 1,
        },
        athleteName: {
            ...Typography.subhead,
            color: colors.text,
            fontWeight: '600',
        },
        athleteEmail: {
            ...Typography.caption1,
            color: colors.textSecondary,
        },
        emptyState: {
            padding: Spacing.xl,
            alignItems: 'center',
        },
        emptyText: {
            ...Typography.body,
            color: colors.textSecondary,
            textAlign: 'center',
        },
        // Bottom Actions
        bottomActions: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.separator,
            padding: Spacing.lg,
            paddingBottom: Spacing.lg + insets.bottom,
        },
        assignButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: Spacing.sm,
            padding: Spacing.md,
            backgroundColor: selectedAthletes.size > 0 ? colors.tint : colors.groupedBackground,
            borderRadius: Radius.md,
        },
        assignButtonText: {
            ...Typography.body,
            color: selectedAthletes.size > 0 ? '#FFFFFF' : colors.textSecondary,
            fontWeight: '600',
        },
        assignCount: {
            ...Typography.subhead,
            color: colors.textSecondary,
            textAlign: 'center',
            marginBottom: Spacing.md,
        },
    });

    return (
        <Screen>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
                        <Text style={styles.headerButtonText}>Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Assign Workout</Text>
                    <View style={styles.headerButton} />
                </View>

                <ScrollView
                    style={styles.container}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Workout Summary */}
                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryTitle}>{workoutName}</Text>
                        <Text style={styles.summarySubtitle}>
                            {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
                        </Text>
                    </View>

                    {/* Date/Time Selection */}
                    <Text style={styles.sectionTitle}>Schedule</Text>
                    <View style={styles.dateTimeCard}>
                        <TouchableOpacity
                            style={styles.dateTimeRow}
                            onPress={() => setShowDatePicker(true)}
                        >
                            <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
                            <Text style={[styles.dateTimeLabel, { marginLeft: Spacing.md }]}>Date</Text>
                            <Text style={styles.dateTimeValue}>{formatDate(scheduledDate)}</Text>
                            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.dateTimeRow, { borderBottomWidth: 0 }]}
                            onPress={() => setShowTimePicker(true)}
                        >
                            <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
                            <Text style={[styles.dateTimeLabel, { marginLeft: Spacing.md }]}>Time (optional)</Text>
                            <Text style={styles.dateTimeValue}>{formatTime(scheduledTime)}</Text>
                            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                        </TouchableOpacity>
                    </View>

                    {/* Athletes Selection */}
                    <View style={styles.athleteHeader}>
                        <Text style={styles.sectionTitle}>Athletes</Text>
                        <TouchableOpacity style={styles.selectAllButton} onPress={selectAll}>
                            <Text style={styles.selectAllText}>
                                {selectedAthletes.size === athletes.length ? 'Deselect All' : 'Select All'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {isLoading ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>Loading athletes...</Text>
                        </View>
                    ) : athletes.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
                            <Text style={styles.emptyText}>No athletes yet</Text>
                        </View>
                    ) : (
                        <View style={styles.athletesList}>
                            {athletes.map((athlete, index) => {
                                const isSelected = selectedAthletes.has(athlete.athleteUserId);
                                return (
                                    <TouchableOpacity
                                        key={athlete.id}
                                        style={[
                                            styles.athleteRow,
                                            index === athletes.length - 1 && { borderBottomWidth: 0 },
                                        ]}
                                        onPress={() => toggleAthlete(athlete.athleteUserId)}
                                    >
                                        <View
                                            style={[
                                                styles.athleteCheckbox,
                                                isSelected && styles.athleteCheckboxSelected,
                                            ]}
                                        >
                                            {isSelected && (
                                                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                                            )}
                                        </View>
                                        <View style={styles.athleteInfo}>
                                            <Text style={styles.athleteName}>
                                                {athlete.athleteName || 'Athlete'}
                                            </Text>
                                            <Text style={styles.athleteEmail}>
                                                {athlete.athleteEmail || 'No email'}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </ScrollView>

                {/* Bottom Actions */}
                <View style={styles.bottomActions}>
                    <Text style={styles.assignCount}>
                        {selectedAthletes.size} athlete{selectedAthletes.size !== 1 ? 's' : ''} selected
                    </Text>
                    <TouchableOpacity
                        style={styles.assignButton}
                        onPress={handleAssign}
                        disabled={isAssigning || selectedAthletes.size === 0}
                    >
                        <Ionicons
                            name="send"
                            size={20}
                            color={selectedAthletes.size > 0 ? '#FFFFFF' : colors.textSecondary}
                        />
                        <Text style={styles.assignButtonText}>
                            {isAssigning ? 'Assigning...' : 'Assign Workout'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Date Picker */}
                {showDatePicker && (
                    <DateTimePicker
                        value={scheduledDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        minimumDate={new Date()}
                        onChange={(event, date) => {
                            setShowDatePicker(Platform.OS === 'ios');
                            if (date) setScheduledDate(date);
                        }}
                    />
                )}

                {/* Time Picker */}
                {showTimePicker && (
                    <DateTimePicker
                        value={scheduledTime || new Date()}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, time) => {
                            setShowTimePicker(Platform.OS === 'ios');
                            if (time) setScheduledTime(time);
                        }}
                    />
                )}
            </View>
        </Screen>
    );
}
