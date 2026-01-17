/**
 * Schedule Session Modal
 *
 * Modal component for scheduling class sessions with date/time picker.
 * Follows existing patterns from assign-workout.tsx.
 */

import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import type { ClassTemplate, CreateClassSessionInput } from '@/lib/services/classes';

interface ScheduleSessionModalProps {
    visible: boolean;
    template: ClassTemplate | null;
    onSchedule: (input: CreateClassSessionInput) => Promise<void>;
    onClose: () => void;
}

/**
 * Get default date (tomorrow)
 */
function getDefaultDate(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
}

/**
 * Get default time (9:00 AM)
 */
function getDefaultTime(): Date {
    const time = new Date();
    time.setHours(9, 0, 0, 0);
    return time;
}

export function ScheduleSessionModal({
    visible,
    template,
    onSchedule,
    onClose,
}: ScheduleSessionModalProps) {
    const insets = useSafeAreaInsets();

    // Form state
    const [date, setDate] = useState(getDefaultDate());
    const [time, setTime] = useState(getDefaultTime());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [capacity, setCapacity] = useState('');
    const [location, setLocation] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset form when modal opens
    useEffect(() => {
        if (visible && template) {
            setDate(getDefaultDate());
            setTime(getDefaultTime());
            setCapacity(template.defaultCapacity.toString());
            setLocation('');
            setIsSubmitting(false);
        }
    }, [visible, template]);

    // Combine date + time into single datetime
    const getScheduledAt = (): Date => {
        const combined = new Date(date);
        combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
        return combined;
    };

    // Format date for display
    const formatDate = (d: Date): string => {
        return d.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });
    };

    // Format time for display
    const formatTime = (t: Date): string => {
        return t.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const handleSchedule = async () => {
        if (!template) return;

        setIsSubmitting(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            await onSchedule({
                templateId: template.id,
                startAt: getScheduledAt(),
                capacity: parseInt(capacity, 10) || template.defaultCapacity,
                locationName: location.trim() || undefined,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onClose();
    };

    if (!template) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleClose}
        >
            <View style={[styles.container, { paddingTop: insets.top }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Schedule Session</Text>
                    <TouchableOpacity
                        onPress={handleSchedule}
                        style={styles.headerButton}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator size="small" color={Colors.dark.primary} />
                        ) : (
                            <Text style={styles.scheduleText}>Schedule</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Template Info */}
                <View style={styles.templateCard}>
                    <View style={styles.templateIcon}>
                        <Ionicons name="people" size={24} color={Colors.dark.primary} />
                    </View>
                    <View style={styles.templateInfo}>
                        <Text style={styles.templateName}>{template.name}</Text>
                        <Text style={styles.templateMeta}>
                            {template.exercisesJson.length} exercises · {template.estimatedDurationMinutes} min
                        </Text>
                    </View>
                </View>

                {/* Date/Time Selection */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Date & Time</Text>
                    <View style={styles.card}>
                        {/* Date Row */}
                        <TouchableOpacity
                            style={styles.row}
                            onPress={() => setShowDatePicker(true)}
                        >
                            <Ionicons name="calendar-outline" size={20} color={Colors.dark.textSecondary} />
                            <Text style={styles.rowLabel}>Date</Text>
                            <Text style={styles.rowValue}>{formatDate(date)}</Text>
                            <Ionicons name="chevron-forward" size={16} color={Colors.dark.textSecondary} />
                        </TouchableOpacity>

                        {/* Time Row */}
                        <TouchableOpacity
                            style={[styles.row, styles.rowLast]}
                            onPress={() => setShowTimePicker(true)}
                        >
                            <Ionicons name="time-outline" size={20} color={Colors.dark.textSecondary} />
                            <Text style={styles.rowLabel}>Time</Text>
                            <Text style={styles.rowValue}>{formatTime(time)}</Text>
                            <Ionicons name="chevron-forward" size={16} color={Colors.dark.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Capacity & Location */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Details</Text>
                    <View style={styles.card}>
                        {/* Capacity Row */}
                        <View style={styles.row}>
                            <Ionicons name="people-outline" size={20} color={Colors.dark.textSecondary} />
                            <Text style={styles.rowLabel}>Max Capacity</Text>
                            <TextInput
                                style={styles.input}
                                value={capacity}
                                onChangeText={setCapacity}
                                keyboardType="number-pad"
                                placeholder={template.defaultCapacity.toString()}
                                placeholderTextColor={Colors.dark.textSecondary}
                            />
                        </View>

                        {/* Location Row */}
                        <View style={[styles.row, styles.rowLast]}>
                            <Ionicons name="location-outline" size={20} color={Colors.dark.textSecondary} />
                            <Text style={styles.rowLabel}>Location</Text>
                            <TextInput
                                style={[styles.input, styles.inputWide]}
                                value={location}
                                onChangeText={setLocation}
                                placeholder="Optional"
                                placeholderTextColor={Colors.dark.textSecondary}
                            />
                        </View>
                    </View>
                </View>

                {/* Date Picker */}
                {showDatePicker && (
                    <DateTimePicker
                        value={date}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        minimumDate={new Date()}
                        onChange={(event, selectedDate) => {
                            setShowDatePicker(Platform.OS === 'ios');
                            if (selectedDate) setDate(selectedDate);
                        }}
                    />
                )}

                {/* Time Picker */}
                {showTimePicker && (
                    <DateTimePicker
                        value={time}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedTime) => {
                            setShowTimePicker(Platform.OS === 'ios');
                            if (selectedTime) setTime(selectedTime);
                        }}
                    />
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
    },
    headerButton: {
        minWidth: 70,
    },
    headerTitle: {
        ...Typography.headline,
        color: Colors.dark.text,
        fontWeight: '600',
    },
    cancelText: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
    },
    scheduleText: {
        ...Typography.body,
        color: Colors.dark.primary,
        fontWeight: '600',
        textAlign: 'right',
    },
    templateCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.card,
        margin: Spacing.lg,
        padding: Spacing.md,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    templateIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.dark.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    templateInfo: {
        flex: 1,
    },
    templateName: {
        ...Typography.headline,
        color: Colors.dark.text,
        fontWeight: '600',
    },
    templateMeta: {
        ...Typography.subhead,
        color: Colors.dark.textSecondary,
        marginTop: 2,
    },
    section: {
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    sectionTitle: {
        ...Typography.subhead,
        color: Colors.dark.textSecondary,
        marginBottom: Spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    card: {
        backgroundColor: Colors.dark.card,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
        gap: Spacing.md,
    },
    rowLast: {
        borderBottomWidth: 0,
    },
    rowLabel: {
        ...Typography.body,
        color: Colors.dark.text,
        flex: 1,
    },
    rowValue: {
        ...Typography.body,
        color: Colors.dark.primary,
        fontWeight: '600',
    },
    input: {
        ...Typography.body,
        color: Colors.dark.text,
        textAlign: 'right',
        minWidth: 60,
    },
    inputWide: {
        flex: 1,
        textAlign: 'left',
    },
});
