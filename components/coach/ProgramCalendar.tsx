/**
 * Program Calendar Component
 *
 * A reusable calendar grid for visualizing and editing program schedules.
 * Supports rest days, multiple workouts per day, and drag-to-reorder.
 */

import { useAppTheme } from '@/lib/context/theme-context';
import type { ProgramWorkout } from '@/lib/services/coach/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

// ============================================
// Types
// ============================================

interface ProgramCalendarProps {
    workouts: ProgramWorkout[];
    durationWeeks: number;
    onDayPress: (week: number, day: number, slot?: 'primary' | 'secondary') => void;
    onAddWeek?: () => void;
    onRemoveWeek?: (week: number) => void;
    onToggleRestDay?: (week: number, day: number) => void;
    editable?: boolean;
    startDate?: Date;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ============================================
// Component
// ============================================

export function ProgramCalendar({
    workouts,
    durationWeeks,
    onDayPress,
    onAddWeek,
    onRemoveWeek,
    onToggleRestDay,
    editable = true,
    startDate,
}: ProgramCalendarProps) {
    const { colors } = useAppTheme();

    // Get workouts for a specific day
    const getWorkoutsForDay = useCallback(
        (week: number, day: number): ProgramWorkout[] => {
            return workouts.filter(w => w.week === week && w.day === day);
        },
        [workouts]
    );

    // Check if day is a rest day
    const isRestDay = useCallback(
        (week: number, day: number): boolean => {
            const dayWorkouts = getWorkoutsForDay(week, day);
            return dayWorkouts.length === 1 && dayWorkouts[0].isRestDay === true;
        },
        [getWorkoutsForDay]
    );

    // Get formatted date for a day
    const getDateForDay = useCallback(
        (week: number, day: number): string | null => {
            if (!startDate) return null;
            const date = new Date(startDate);
            date.setDate(date.getDate() + (week - 1) * 7 + (day - 1));
            return `${date.getMonth() + 1}/${date.getDate()}`;
        },
        [startDate]
    );

    // Render a single day cell
    const renderDayCell = (week: number, day: number) => {
        const dayWorkouts = getWorkoutsForDay(week, day);
        const isRest = isRestDay(week, day);
        const primaryWorkout = dayWorkouts.find(w => !w.slot || w.slot === 'primary');
        const secondaryWorkout = dayWorkouts.find(w => w.slot === 'secondary');
        const hasWorkout = dayWorkouts.length > 0 && !isRest;
        const dateStr = getDateForDay(week, day);

        return (
            <View key={`${week}-${day}`} style={styles.dayCell}>
                <View style={styles.dayHeader}>
                    <Text style={[styles.dayName, { color: colors.textSecondary }]}>
                        {DAY_NAMES[day - 1]}
                    </Text>
                    {dateStr && (
                        <Text style={[styles.dateText, { color: colors.textMuted }]}>
                            {dateStr}
                        </Text>
                    )}
                </View>

                <TouchableOpacity
                    style={[
                        styles.workoutSlot,
                        {
                            backgroundColor: isRest
                                ? colors.warning + '20'
                                : hasWorkout
                                    ? colors.primary + '20'
                                    : colors.cardBackground,
                            borderColor: isRest
                                ? colors.warning
                                : hasWorkout
                                    ? colors.primary
                                    : colors.border,
                        },
                    ]}
                    onPress={() => onDayPress(week, day, 'primary')}
                    onLongPress={editable && onToggleRestDay ? () => onToggleRestDay(week, day) : undefined}
                >
                    {isRest ? (
                        <View style={styles.restDayContent}>
                            <Ionicons name="bed-outline" size={16} color={colors.warning} />
                            <Text style={[styles.restText, { color: colors.warning }]}>REST</Text>
                        </View>
                    ) : primaryWorkout ? (
                        <Text
                            style={[styles.workoutName, { color: colors.text }]}
                            numberOfLines={2}
                        >
                            {primaryWorkout.name}
                        </Text>
                    ) : (
                        <View style={styles.emptySlot}>
                            <Ionicons name="add" size={20} color={colors.textMuted} />
                        </View>
                    )}
                </TouchableOpacity>

                {/* Secondary slot (PM workout) */}
                {(secondaryWorkout || (hasWorkout && editable)) && (
                    <TouchableOpacity
                        style={[
                            styles.secondarySlot,
                            {
                                backgroundColor: secondaryWorkout
                                    ? colors.success + '20'
                                    : colors.cardBackground,
                                borderColor: secondaryWorkout ? colors.success : colors.border,
                            },
                        ]}
                        onPress={() => onDayPress(week, day, 'secondary')}
                    >
                        {secondaryWorkout ? (
                            <Text
                                style={[styles.workoutNameSmall, { color: colors.text }]}
                                numberOfLines={1}
                            >
                                {secondaryWorkout.name}
                            </Text>
                        ) : (
                            <Text style={[styles.pmLabel, { color: colors.textMuted }]}>
                                + PM
                            </Text>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    // Render a week row
    const renderWeek = (week: number) => (
        <View key={week} style={styles.weekRow}>
            <View style={styles.weekHeader}>
                <Text style={[styles.weekLabel, { color: colors.text }]}>
                    Week {week}
                </Text>
                {editable && onRemoveWeek && durationWeeks > 1 && (
                    <TouchableOpacity onPress={() => onRemoveWeek(week)}>
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                )}
            </View>
            <View style={styles.daysRow}>
                {[1, 2, 3, 4, 5, 6, 7].map(day => renderDayCell(week, day))}
            </View>
        </View>
    );

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {Array.from({ length: durationWeeks }, (_, i) => i + 1).map(week =>
                renderWeek(week)
            )}

            {editable && onAddWeek && (
                <TouchableOpacity
                    style={[styles.addWeekButton, { borderColor: colors.border }]}
                    onPress={onAddWeek}
                >
                    <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                    <Text style={[styles.addWeekText, { color: colors.primary }]}>
                        Add Week
                    </Text>
                </TouchableOpacity>
            )}

            {editable && (
                <Text style={[styles.hint, { color: colors.textMuted }]}>
                    Tap a day to add/edit workout • Long press to toggle rest day
                </Text>
            )}
        </ScrollView>
    );
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    weekRow: {
        marginBottom: 24,
    },
    weekHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    weekLabel: {
        fontSize: 16,
        fontWeight: '600',
    },
    daysRow: {
        flexDirection: 'row',
        gap: 8,
    },
    dayCell: {
        flex: 1,
        minWidth: 44,
    },
    dayHeader: {
        alignItems: 'center',
        marginBottom: 4,
    },
    dayName: {
        fontSize: 11,
        fontWeight: '500',
    },
    dateText: {
        fontSize: 9,
    },
    workoutSlot: {
        minHeight: 56,
        borderRadius: 8,
        borderWidth: 1,
        padding: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    workoutName: {
        fontSize: 10,
        fontWeight: '500',
        textAlign: 'center',
    },
    restDayContent: {
        alignItems: 'center',
        gap: 2,
    },
    restText: {
        fontSize: 9,
        fontWeight: '600',
    },
    emptySlot: {
        opacity: 0.4,
    },
    secondarySlot: {
        marginTop: 4,
        minHeight: 28,
        borderRadius: 6,
        borderWidth: 1,
        padding: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    workoutNameSmall: {
        fontSize: 9,
        fontWeight: '500',
        textAlign: 'center',
    },
    pmLabel: {
        fontSize: 9,
    },
    addWeekButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderRadius: 12,
        marginBottom: 16,
    },
    addWeekText: {
        fontSize: 14,
        fontWeight: '500',
    },
    hint: {
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 24,
    },
});
