/**
 * Program Builder Screen
 *
 * Calendar-based program builder with:
 * - Week-by-week calendar grid
 * - Rest day toggle
 * - Multiple workouts per day (AM/PM)
 * - Auto-increment workout days
 * - Start/end date calculation
 */

import { ProgramCalendar } from '@/components/coach';
import { useAppTheme } from '@/lib/context/theme-context';
import {
    createProgram,
    getProgram,
    ProgramCategory,
    ProgramWorkout,
    updateProgram
} from '@/lib/services/coach';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

// ============================================
// Types
// ============================================

interface ProgramFormData {
    name: string;
    description: string;
    category: ProgramCategory | undefined;
    difficulty: 'beginner' | 'intermediate' | 'advanced' | 'elite';
    durationWeeks: number;
    daysPerWeek: number;
    workouts: ProgramWorkout[];
    isTemplate: boolean;
}

const CATEGORIES: { key: ProgramCategory; label: string; icon: string }[] = [
    { key: 'strength', label: 'Strength', icon: 'barbell' },
    { key: 'hypertrophy', label: 'Hypertrophy', icon: 'fitness' },
    { key: 'powerlifting', label: 'Powerlifting', icon: 'trophy' },
    { key: 'bodybuilding', label: 'Bodybuilding', icon: 'body' },
    { key: 'sport_specific', label: 'Sport', icon: 'football' },
    { key: 'general_fitness', label: 'General', icon: 'heart' },
];

const DIFFICULTIES: { key: string; label: string }[] = [
    { key: 'beginner', label: 'Beginner' },
    { key: 'intermediate', label: 'Intermediate' },
    { key: 'advanced', label: 'Advanced' },
    { key: 'elite', label: 'Elite' },
];

// ============================================
// Component
// ============================================

export default function ProgramBuilderScreen() {
    const { colors } = useAppTheme();
    const router = useRouter();
    const { id: programId } = useLocalSearchParams<{ id?: string }>();

    const isEditing = !!programId;

    // Form state
    const [formData, setFormData] = useState<ProgramFormData>({
        name: '',
        description: '',
        category: undefined,
        difficulty: 'intermediate',
        durationWeeks: 4,
        daysPerWeek: 4,
        workouts: [],
        isTemplate: false,
    });

    const [startDate, setStartDate] = useState<Date>(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [saving, setSaving] = useState(false);
    const [step, setStep] = useState<'details' | 'calendar'>('details');

    // Load existing program if editing
    useEffect(() => {
        if (programId) {
            loadProgram(programId);
        }
    }, [programId]);

    const loadProgram = async (id: string) => {
        const result = await getProgram(id);
        if (result.success && result.data) {
            const program = result.data;
            setFormData({
                name: program.name,
                description: program.description || '',
                category: program.category,
                difficulty: program.difficulty || 'intermediate',
                durationWeeks: program.durationWeeks || 4,
                daysPerWeek: program.daysPerWeek || 4,
                workouts: program.workouts || [],
                isTemplate: program.isTemplate,
            });
        }
    };

    // Calculate end date
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + formData.durationWeeks * 7 - 1);

    // Handlers
    const handleUpdateField = <K extends keyof ProgramFormData>(
        field: K,
        value: ProgramFormData[K]
    ) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleAddWeek = useCallback(() => {
        setFormData(prev => ({ ...prev, durationWeeks: prev.durationWeeks + 1 }));
    }, []);

    const handleRemoveWeek = useCallback((week: number) => {
        setFormData(prev => ({
            ...prev,
            durationWeeks: Math.max(1, prev.durationWeeks - 1),
            workouts: prev.workouts.filter(w => w.week !== week).map(w => ({
                ...w,
                week: w.week > week ? w.week - 1 : w.week,
            })),
        }));
    }, []);

    const handleToggleRestDay = useCallback((week: number, day: number) => {
        setFormData(prev => {
            const existingWorkout = prev.workouts.find(
                w => w.week === week && w.day === day && (!w.slot || w.slot === 'primary')
            );

            if (existingWorkout?.isRestDay) {
                // Remove rest day
                return {
                    ...prev,
                    workouts: prev.workouts.filter(
                        w => !(w.week === week && w.day === day && w.isRestDay)
                    ),
                };
            } else {
                // Add rest day (remove existing workouts for that day)
                const filteredWorkouts = prev.workouts.filter(
                    w => !(w.week === week && w.day === day)
                );
                return {
                    ...prev,
                    workouts: [
                        ...filteredWorkouts,
                        {
                            week,
                            day,
                            slot: 'primary' as const,
                            name: 'Rest',
                            isRestDay: true,
                            exercises: [],
                        },
                    ],
                };
            }
        });
    }, []);

    const handleDayPress = useCallback(
        (week: number, day: number, slot?: 'primary' | 'secondary') => {
            // Navigate to workout editor
            router.push({
                pathname: '/coach/programs/workout-editor',
                params: {
                    programId: programId || 'new',
                    week: week.toString(),
                    day: day.toString(),
                    slot: slot || 'primary',
                    workoutsJson: JSON.stringify(formData.workouts),
                },
            });
        },
        [programId, formData.workouts, router]
    );

    const handleSave = async () => {
        if (!formData.name.trim()) {
            Alert.alert('Error', 'Please enter a program name');
            return;
        }

        setSaving(true);
        try {
            if (isEditing && programId) {
                await updateProgram(programId, {
                    name: formData.name,
                    description: formData.description,
                    category: formData.category,
                    difficulty: formData.difficulty,
                    durationWeeks: formData.durationWeeks,
                    daysPerWeek: formData.daysPerWeek,
                    workouts: formData.workouts,
                    isTemplate: formData.isTemplate,
                });
            } else {
                await createProgram({
                    name: formData.name,
                    description: formData.description,
                    category: formData.category,
                    difficulty: formData.difficulty,
                    durationWeeks: formData.durationWeeks,
                    daysPerWeek: formData.daysPerWeek,
                    workouts: formData.workouts,
                    isTemplate: formData.isTemplate,
                });
            }
            router.back();
        } catch (error) {
            console.error('Error saving program:', error);
            Alert.alert('Error', 'Failed to save program');
        } finally {
            setSaving(false);
        }
    };

    // Count workouts
    const workoutCount = formData.workouts.filter(w => !w.isRestDay).length;
    const restDayCount = formData.workouts.filter(w => w.isRestDay).length;

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                    {isEditing ? 'Edit Program' : 'New Program'}
                </Text>
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving}
                    style={[styles.saveButton, { backgroundColor: colors.primary }]}
                >
                    <Text style={styles.saveButtonText}>
                        {saving ? 'Saving...' : 'Save'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Step Tabs */}
            <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
                <TouchableOpacity
                    style={[styles.tab, step === 'details' && styles.activeTab]}
                    onPress={() => setStep('details')}
                >
                    <Text
                        style={[
                            styles.tabText,
                            { color: step === 'details' ? colors.primary : colors.textSecondary },
                        ]}
                    >
                        Details
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, step === 'calendar' && styles.activeTab]}
                    onPress={() => setStep('calendar')}
                >
                    <Text
                        style={[
                            styles.tabText,
                            { color: step === 'calendar' ? colors.primary : colors.textSecondary },
                        ]}
                    >
                        Calendar
                    </Text>
                    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.badgeText}>{workoutCount}</Text>
                    </View>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {step === 'details' ? (
                    <>
                        {/* Program Name */}
                        <View style={styles.section}>
                            <Text style={[styles.label, { color: colors.text }]}>
                                Program Name *
                            </Text>
                            <TextInput
                                style={[
                                    styles.input,
                                    { backgroundColor: colors.cardBackground, color: colors.text, borderColor: colors.border },
                                ]}
                                value={formData.name}
                                onChangeText={text => handleUpdateField('name', text)}
                                placeholder="e.g., 12 Week Strength Builder"
                                placeholderTextColor={colors.textMuted}
                            />
                        </View>

                        {/* Description */}
                        <View style={styles.section}>
                            <Text style={[styles.label, { color: colors.text }]}>
                                Description
                            </Text>
                            <TextInput
                                style={[
                                    styles.input,
                                    styles.textArea,
                                    { backgroundColor: colors.cardBackground, color: colors.text, borderColor: colors.border },
                                ]}
                                value={formData.description}
                                onChangeText={text => handleUpdateField('description', text)}
                                placeholder="What makes this program special?"
                                placeholderTextColor={colors.textMuted}
                                multiline
                                numberOfLines={3}
                            />
                        </View>

                        {/* Category */}
                        <View style={styles.section}>
                            <Text style={[styles.label, { color: colors.text }]}>Category</Text>
                            <View style={styles.optionGrid}>
                                {CATEGORIES.map(cat => (
                                    <TouchableOpacity
                                        key={cat.key}
                                        style={[
                                            styles.optionButton,
                                            {
                                                backgroundColor:
                                                    formData.category === cat.key
                                                        ? colors.primary + '20'
                                                        : colors.cardBackground,
                                                borderColor:
                                                    formData.category === cat.key
                                                        ? colors.primary
                                                        : colors.border,
                                            },
                                        ]}
                                        onPress={() => handleUpdateField('category', cat.key)}
                                    >
                                        <Ionicons
                                            name={cat.icon as any}
                                            size={20}
                                            color={
                                                formData.category === cat.key
                                                    ? colors.primary
                                                    : colors.textSecondary
                                            }
                                        />
                                        <Text
                                            style={[
                                                styles.optionText,
                                                {
                                                    color:
                                                        formData.category === cat.key
                                                            ? colors.primary
                                                            : colors.text,
                                                },
                                            ]}
                                        >
                                            {cat.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Difficulty */}
                        <View style={styles.section}>
                            <Text style={[styles.label, { color: colors.text }]}>Difficulty</Text>
                            <View style={styles.difficultyRow}>
                                {DIFFICULTIES.map(diff => (
                                    <TouchableOpacity
                                        key={diff.key}
                                        style={[
                                            styles.difficultyButton,
                                            {
                                                backgroundColor:
                                                    formData.difficulty === diff.key
                                                        ? colors.primary
                                                        : colors.cardBackground,
                                                borderColor:
                                                    formData.difficulty === diff.key
                                                        ? colors.primary
                                                        : colors.border,
                                            },
                                        ]}
                                        onPress={() => handleUpdateField('difficulty', diff.key as any)}
                                    >
                                        <Text
                                            style={[
                                                styles.difficultyText,
                                                {
                                                    color:
                                                        formData.difficulty === diff.key
                                                            ? '#fff'
                                                            : colors.text,
                                                },
                                            ]}
                                        >
                                            {diff.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Duration & Days */}
                        <View style={styles.rowSection}>
                            <View style={styles.halfSection}>
                                <Text style={[styles.label, { color: colors.text }]}>
                                    Duration (weeks)
                                </Text>
                                <View style={styles.stepper}>
                                    <TouchableOpacity
                                        style={[styles.stepperButton, { backgroundColor: colors.cardBackground }]}
                                        onPress={() =>
                                            handleUpdateField('durationWeeks', Math.max(1, formData.durationWeeks - 1))
                                        }
                                    >
                                        <Ionicons name="remove" size={20} color={colors.text} />
                                    </TouchableOpacity>
                                    <Text style={[styles.stepperValue, { color: colors.text }]}>
                                        {formData.durationWeeks}
                                    </Text>
                                    <TouchableOpacity
                                        style={[styles.stepperButton, { backgroundColor: colors.cardBackground }]}
                                        onPress={() => handleUpdateField('durationWeeks', formData.durationWeeks + 1)}
                                    >
                                        <Ionicons name="add" size={20} color={colors.text} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.halfSection}>
                                <Text style={[styles.label, { color: colors.text }]}>
                                    Days per week
                                </Text>
                                <View style={styles.stepper}>
                                    <TouchableOpacity
                                        style={[styles.stepperButton, { backgroundColor: colors.cardBackground }]}
                                        onPress={() =>
                                            handleUpdateField('daysPerWeek', Math.max(1, formData.daysPerWeek - 1))
                                        }
                                    >
                                        <Ionicons name="remove" size={20} color={colors.text} />
                                    </TouchableOpacity>
                                    <Text style={[styles.stepperValue, { color: colors.text }]}>
                                        {formData.daysPerWeek}
                                    </Text>
                                    <TouchableOpacity
                                        style={[styles.stepperButton, { backgroundColor: colors.cardBackground }]}
                                        onPress={() =>
                                            handleUpdateField('daysPerWeek', Math.min(7, formData.daysPerWeek + 1))
                                        }
                                    >
                                        <Ionicons name="add" size={20} color={colors.text} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>

                        {/* Template Toggle */}
                        <TouchableOpacity
                            style={[styles.toggleRow, { borderColor: colors.border }]}
                            onPress={() => handleUpdateField('isTemplate', !formData.isTemplate)}
                        >
                            <View>
                                <Text style={[styles.toggleLabel, { color: colors.text }]}>
                                    Save as Template
                                </Text>
                                <Text style={[styles.toggleHint, { color: colors.textSecondary }]}>
                                    Reuse this program for multiple athletes
                                </Text>
                            </View>
                            <Ionicons
                                name={formData.isTemplate ? 'checkbox' : 'square-outline'}
                                size={24}
                                color={formData.isTemplate ? colors.primary : colors.textMuted}
                            />
                        </TouchableOpacity>

                        {/* Continue Button */}
                        <TouchableOpacity
                            style={[styles.continueButton, { backgroundColor: colors.primary }]}
                            onPress={() => setStep('calendar')}
                        >
                            <Text style={styles.continueText}>Continue to Calendar</Text>
                            <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        {/* Calendar Stats */}
                        <View style={[styles.statsRow, { backgroundColor: colors.cardBackground }]}>
                            <View style={styles.stat}>
                                <Text style={[styles.statValue, { color: colors.text }]}>
                                    {formData.durationWeeks}
                                </Text>
                                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                                    Weeks
                                </Text>
                            </View>
                            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                            <View style={styles.stat}>
                                <Text style={[styles.statValue, { color: colors.primary }]}>
                                    {workoutCount}
                                </Text>
                                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                                    Workouts
                                </Text>
                            </View>
                            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                            <View style={styles.stat}>
                                <Text style={[styles.statValue, { color: colors.warning }]}>
                                    {restDayCount}
                                </Text>
                                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                                    Rest Days
                                </Text>
                            </View>
                            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                            <View style={styles.stat}>
                                <Text style={[styles.statValue, { color: colors.textSecondary, fontSize: 16 }]}>
                                    {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </Text>
                                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                                    Ends
                                </Text>
                            </View>
                        </View>

                        {/* Calendar */}
                        <View style={styles.calendarContainer}>
                            <ProgramCalendar
                                workouts={formData.workouts}
                                durationWeeks={formData.durationWeeks}
                                onDayPress={handleDayPress}
                                onAddWeek={handleAddWeek}
                                onRemoveWeek={handleRemoveWeek}
                                onToggleRestDay={handleToggleRestDay}
                                editable={true}
                                startDate={startDate}
                            />
                        </View>
                    </>
                )}
            </ScrollView>

            {/* Date Picker Modal */}
            {showDatePicker && (
                <DateTimePicker
                    value={startDate}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                        setShowDatePicker(false);
                        if (date) setStartDate(date);
                    }}
                    minimumDate={new Date()}
                />
            )}
        </KeyboardAvoidingView>
    );
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
    },
    saveButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#007AFF',
    },
    tabText: {
        fontSize: 15,
        fontWeight: '500',
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    badgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    section: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    optionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
    },
    optionText: {
        fontSize: 14,
        fontWeight: '500',
    },
    difficultyRow: {
        flexDirection: 'row',
        gap: 8,
    },
    difficultyButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
    },
    difficultyText: {
        fontSize: 13,
        fontWeight: '500',
    },
    rowSection: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 24,
    },
    halfSection: {
        flex: 1,
    },
    stepper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    stepperButton: {
        width: 44,
        height: 44,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepperValue: {
        fontSize: 24,
        fontWeight: '600',
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderWidth: 1,
        borderRadius: 12,
        marginBottom: 24,
    },
    toggleLabel: {
        fontSize: 15,
        fontWeight: '500',
    },
    toggleHint: {
        fontSize: 13,
        marginTop: 2,
    },
    continueButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        borderRadius: 12,
        marginTop: 8,
        marginBottom: 24,
    },
    continueText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    statsRow: {
        flexDirection: 'row',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    stat: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
    },
    statLabel: {
        fontSize: 12,
        marginTop: 4,
    },
    statDivider: {
        width: 1,
        marginVertical: 4,
    },
    calendarContainer: {
        flex: 1,
    },
});
