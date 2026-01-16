/**
 * Athlete Calendar Screen
 *
 * Per-athlete calendar view showing:
 * - Scheduled workouts color-coded by status
 * - Tap on a day to assign new workout
 * - View workout details on tap
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/screen';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
    AssignedWorkout,
    getAssignedWorkouts,
    getMyAssignments,
} from '@/lib/services/coach';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DAY_WIDTH = (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.sm * 6) / 7;

// Status colors
const STATUS_COLORS = {
    pending: '#FF9F0A',      // Orange
    in_progress: '#007AFF',  // Blue
    completed: '#30D158',    // Green
    skipped: '#FF453A',      // Red
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AthleteCalendarScreen() {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ id: string }>();
    const athleteId = params.id;

    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [workouts, setWorkouts] = useState<AssignedWorkout[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load workouts for the month
    const loadWorkouts = useCallback(async () => {
        if (!athleteId) return;
        setIsLoading(true);
        try {
            const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
            const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

            // Get all assignments for this athlete and load their workouts
            const assignmentsResult = await getMyAssignments();
            if (assignmentsResult.success && assignmentsResult.data) {
                // Filter assignments for this athlete
                const athleteAssignments = assignmentsResult.data.data.filter(
                    a => a.athleteUserId === athleteId
                );

                // Load all workouts for these assignments
                const allWorkouts: AssignedWorkout[] = [];
                for (const assignment of athleteAssignments) {
                    const workoutsResult = await getAssignedWorkouts(assignment.id);
                    if (workoutsResult.success && workoutsResult.data) {
                        // Filter to current month
                        const monthWorkouts = workoutsResult.data.filter(w => {
                            const date = new Date(w.scheduledDate);
                            return date >= startOfMonth && date <= endOfMonth;
                        });
                        allWorkouts.push(...monthWorkouts);
                    }
                }
                setWorkouts(allWorkouts);
            }
        } catch (error) {
            console.error('Error loading workouts:', error);
        } finally {
            setIsLoading(false);
        }
    }, [athleteId, currentMonth]);

    useFocusEffect(
        useCallback(() => {
            loadWorkouts();
        }, [loadWorkouts])
    );

    // Navigate months
    const goToPreviousMonth = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
        setSelectedDate(null);
    };

    const goToNextMonth = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
        setSelectedDate(null);
    };

    // Generate calendar days
    const calendarDays = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const days: { date: Date; isCurrentMonth: boolean }[] = [];

        // Add days from previous month to fill the first week
        const startDayOfWeek = firstDay.getDay();
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            const date = new Date(year, month, -i);
            days.push({ date, isCurrentMonth: false });
        }

        // Add days of current month
        for (let day = 1; day <= lastDay.getDate(); day++) {
            days.push({ date: new Date(year, month, day), isCurrentMonth: true });
        }

        // Add days from next month to complete the grid (6 rows)
        const remainingDays = 42 - days.length;
        for (let i = 1; i <= remainingDays; i++) {
            const date = new Date(year, month + 1, i);
            days.push({ date, isCurrentMonth: false });
        }

        return days;
    }, [currentMonth]);

    // Get workouts for a specific date
    const getWorkoutsForDate = (date: Date) => {
        const dateStr = date.toISOString().split('T')[0];
        return workouts.filter(w => {
            const workoutDate = new Date(w.scheduledDate).toISOString().split('T')[0];
            return workoutDate === dateStr;
        });
    };

    // Handle date selection
    const handleDateSelect = (date: Date) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedDate(date);
    };

    // Handle assign workout to date
    const handleAssignToDate = (date: Date) => {
        router.push({
            pathname: '/coach/assign-workout' as any,
            params: {
                athleteId,
                preselectedDate: date.toISOString(),
            },
        });
    };

    // Format month header
    const monthHeader = currentMonth.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
    });

    // Selected date workouts
    const selectedDateWorkouts = selectedDate ? getWorkoutsForDate(selectedDate) : [];

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
            padding: Spacing.sm,
        },
        headerTitle: {
            ...Typography.headline,
            color: colors.text,
        },
        monthNavigation: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: Spacing.md,
        },
        navButton: {
            padding: Spacing.sm,
        },
        monthTitle: {
            ...Typography.title3,
            color: colors.text,
            fontWeight: '600',
        },
        weekdayRow: {
            flexDirection: 'row',
            paddingHorizontal: Spacing.lg,
            paddingBottom: Spacing.sm,
        },
        weekdayLabel: {
            width: DAY_WIDTH,
            textAlign: 'center',
            ...Typography.caption1,
            color: colors.textSecondary,
        },
        calendarGrid: {
            paddingHorizontal: Spacing.lg,
        },
        weekRow: {
            flexDirection: 'row',
            marginBottom: Spacing.sm,
        },
        dayCell: {
            width: DAY_WIDTH,
            height: DAY_WIDTH + 8,
            alignItems: 'center',
            padding: 2,
        },
        dayNumber: {
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
        },
        dayNumberText: {
            ...Typography.footnote,
            fontWeight: '500',
        },
        dayDots: {
            flexDirection: 'row',
            marginTop: 2,
            gap: 2,
        },
        dot: {
            width: 6,
            height: 6,
            borderRadius: 3,
        },
        today: {
            backgroundColor: colors.tint + '20',
        },
        selected: {
            backgroundColor: colors.tint,
        },
        otherMonth: {
            opacity: 0.3,
        },
        // Selected Date Detail
        detailSection: {
            flex: 1,
            padding: Spacing.lg,
            backgroundColor: colors.groupedBackground,
            borderTopLeftRadius: Radius.xl,
            borderTopRightRadius: Radius.xl,
            marginTop: Spacing.md,
        },
        detailHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: Spacing.md,
        },
        detailTitle: {
            ...Typography.headline,
            color: colors.text,
        },
        addButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.xs,
            paddingVertical: Spacing.xs,
            paddingHorizontal: Spacing.md,
            backgroundColor: colors.tint,
            borderRadius: Radius.full,
        },
        addButtonText: {
            ...Typography.footnote,
            color: '#FFFFFF',
            fontWeight: '600',
        },
        workoutCard: {
            backgroundColor: colors.background,
            borderRadius: Radius.md,
            padding: Spacing.md,
            marginBottom: Spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
        },
        statusIndicator: {
            width: 4,
            height: '100%',
            borderRadius: 2,
            marginRight: Spacing.md,
        },
        workoutInfo: {
            flex: 1,
        },
        workoutName: {
            ...Typography.subhead,
            color: colors.text,
            fontWeight: '600',
        },
        workoutMeta: {
            ...Typography.caption1,
            color: colors.textSecondary,
            marginTop: 2,
        },
        emptyDay: {
            alignItems: 'center',
            padding: Spacing.xl,
        },
        emptyText: {
            ...Typography.body,
            color: colors.textSecondary,
            marginTop: Spacing.sm,
        },
        noSelection: {
            alignItems: 'center',
            justifyContent: 'center',
            padding: Spacing.xl,
        },
        noSelectionText: {
            ...Typography.body,
            color: colors.textSecondary,
            textAlign: 'center',
        },
    });

    const isToday = (date: Date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const isSelected = (date: Date) => {
        return selectedDate && date.toDateString() === selectedDate.toDateString();
    };

    return (
        <Screen>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
                        <Ionicons name="chevron-back" size={24} color={colors.tint} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Athlete Calendar</Text>
                    <TouchableOpacity style={styles.headerButton} onPress={() => setCurrentMonth(new Date())}>
                        <Text style={{ color: colors.tint }}>Today</Text>
                    </TouchableOpacity>
                </View>

                {/* Month Navigation */}
                <View style={styles.monthNavigation}>
                    <TouchableOpacity style={styles.navButton} onPress={goToPreviousMonth}>
                        <Ionicons name="chevron-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.monthTitle}>{monthHeader}</Text>
                    <TouchableOpacity style={styles.navButton} onPress={goToNextMonth}>
                        <Ionicons name="chevron-forward" size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {/* Weekday Labels */}
                <View style={styles.weekdayRow}>
                    {WEEKDAYS.map(day => (
                        <Text key={day} style={styles.weekdayLabel}>{day}</Text>
                    ))}
                </View>

                {/* Calendar Grid */}
                <View style={styles.calendarGrid}>
                    {Array.from({ length: 6 }, (_, weekIndex) => (
                        <View key={weekIndex} style={styles.weekRow}>
                            {calendarDays.slice(weekIndex * 7, (weekIndex + 1) * 7).map((day, dayIndex) => {
                                const dayWorkouts = getWorkoutsForDate(day.date);
                                const hasWorkouts = dayWorkouts.length > 0;

                                return (
                                    <TouchableOpacity
                                        key={dayIndex}
                                        style={[styles.dayCell, !day.isCurrentMonth && styles.otherMonth]}
                                        onPress={() => handleDateSelect(day.date)}
                                        disabled={!day.isCurrentMonth}
                                    >
                                        <View
                                            style={[
                                                styles.dayNumber,
                                                isToday(day.date) && styles.today,
                                                isSelected(day.date) && styles.selected,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.dayNumberText,
                                                    { color: isSelected(day.date) ? '#FFFFFF' : colors.text },
                                                ]}
                                            >
                                                {day.date.getDate()}
                                            </Text>
                                        </View>
                                        {hasWorkouts && (
                                            <View style={styles.dayDots}>
                                                {dayWorkouts.slice(0, 3).map((w, i) => (
                                                    <View
                                                        key={i}
                                                        style={[
                                                            styles.dot,
                                                            { backgroundColor: STATUS_COLORS[w.status as keyof typeof STATUS_COLORS] || colors.textSecondary },
                                                        ]}
                                                    />
                                                ))}
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ))}
                </View>

                {/* Selected Date Detail */}
                <View style={styles.detailSection}>
                    {selectedDate ? (
                        <>
                            <View style={styles.detailHeader}>
                                <Text style={styles.detailTitle}>
                                    {selectedDate.toLocaleDateString('en-US', {
                                        weekday: 'long',
                                        month: 'short',
                                        day: 'numeric',
                                    })}
                                </Text>
                                <TouchableOpacity
                                    style={styles.addButton}
                                    onPress={() => handleAssignToDate(selectedDate)}
                                >
                                    <Ionicons name="add" size={16} color="#FFFFFF" />
                                    <Text style={styles.addButtonText}>Assign</Text>
                                </TouchableOpacity>
                            </View>

                            {selectedDateWorkouts.length > 0 ? (
                                <ScrollView showsVerticalScrollIndicator={false}>
                                    {selectedDateWorkouts.map(workout => (
                                        <View key={workout.id} style={styles.workoutCard}>
                                            <View
                                                style={[
                                                    styles.statusIndicator,
                                                    { backgroundColor: STATUS_COLORS[workout.status as keyof typeof STATUS_COLORS] || colors.textSecondary },
                                                ]}
                                            />
                                            <View style={styles.workoutInfo}>
                                                <Text style={styles.workoutName}>{workout.workoutName}</Text>
                                                <Text style={styles.workoutMeta}>
                                                    {workout.exercises?.length || 0} exercises • {workout.status}
                                                </Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                                        </View>
                                    ))}
                                </ScrollView>
                            ) : (
                                <View style={styles.emptyDay}>
                                    <Ionicons name="calendar-outline" size={48} color={colors.textTertiary} />
                                    <Text style={styles.emptyText}>No workouts scheduled</Text>
                                    <TouchableOpacity
                                        style={[styles.addButton, { marginTop: Spacing.md }]}
                                        onPress={() => handleAssignToDate(selectedDate)}
                                    >
                                        <Ionicons name="add" size={16} color="#FFFFFF" />
                                        <Text style={styles.addButtonText}>Assign Workout</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </>
                    ) : (
                        <View style={styles.noSelection}>
                            <Ionicons name="hand-left-outline" size={48} color={colors.textTertiary} />
                            <Text style={styles.noSelectionText}>
                                Tap a date to view{'\n'}or assign workouts
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </Screen>
    );
}
