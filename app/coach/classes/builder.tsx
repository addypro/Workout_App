/**
 * Class Template Builder
 *
 * Create/edit class templates with exercises.
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import {
    ClassExercise,
    createClassTemplate,
    updateClassTemplate,
} from '@/lib/services/classes';

export default function ClassBuilderScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string }>();
    const isEditing = !!params.id;

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [duration, setDuration] = useState('60');
    const [capacity, setCapacity] = useState('20');
    const [exercises, setExercises] = useState<ClassExercise[]>([]);
    const [saving, setSaving] = useState(false);

    const handleAddExercise = () => {
        setExercises([
            ...exercises,
            {
                name: '',
                sets: 3,
                reps: '10',
                restSeconds: 90,
            },
        ]);
    };

    const handleUpdateExercise = (index: number, field: keyof ClassExercise, value: any) => {
        const updated = [...exercises];
        updated[index] = { ...updated[index], [field]: value };
        setExercises(updated);
    };

    const handleRemoveExercise = (index: number) => {
        setExercises(exercises.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Required', 'Please enter a template name');
            return;
        }

        if (exercises.length === 0) {
            Alert.alert('Required', 'Please add at least one exercise');
            return;
        }

        const validExercises = exercises.filter((e) => e.name.trim());
        if (validExercises.length === 0) {
            Alert.alert('Required', 'Please name your exercises');
            return;
        }

        setSaving(true);

        try {
            const input = {
                name: name.trim(),
                description: description.trim() || undefined,
                exercisesJson: validExercises,
                estimatedDurationMinutes: parseInt(duration) || 60,
                defaultCapacity: parseInt(capacity) || 20,
            };

            const result = isEditing
                ? await updateClassTemplate(params.id!, input)
                : await createClassTemplate(input);

            if (result.error) {
                Alert.alert('Error', result.error);
            } else {
                router.back();
            }
        } finally {
            setSaving(false);
        }
    };

    const renderExercise = (exercise: ClassExercise, index: number) => (
        <View key={index} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
                <Text style={styles.exerciseNumber}>#{index + 1}</Text>
                <TouchableOpacity
                    onPress={() => handleRemoveExercise(index)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="trash-outline" size={18} color={Colors.dark.error} />
                </TouchableOpacity>
            </View>

            <TextInput
                style={styles.exerciseNameInput}
                placeholder="Exercise name"
                placeholderTextColor={Colors.dark.textSecondary}
                value={exercise.name}
                onChangeText={(v) => handleUpdateExercise(index, 'name', v)}
            />

            <View style={styles.exerciseRow}>
                <View style={styles.exerciseField}>
                    <Text style={styles.fieldLabel}>Sets</Text>
                    <TextInput
                        style={styles.fieldInput}
                        keyboardType="number-pad"
                        value={String(exercise.sets)}
                        onChangeText={(v) => handleUpdateExercise(index, 'sets', parseInt(v) || 0)}
                    />
                </View>
                <View style={styles.exerciseField}>
                    <Text style={styles.fieldLabel}>Reps</Text>
                    <TextInput
                        style={styles.fieldInput}
                        placeholder="8-12"
                        placeholderTextColor={Colors.dark.textSecondary}
                        value={exercise.reps}
                        onChangeText={(v) => handleUpdateExercise(index, 'reps', v)}
                    />
                </View>
                <View style={styles.exerciseField}>
                    <Text style={styles.fieldLabel}>Rest (s)</Text>
                    <TextInput
                        style={styles.fieldInput}
                        keyboardType="number-pad"
                        value={String(exercise.restSeconds ?? '')}
                        onChangeText={(v) => handleUpdateExercise(index, 'restSeconds', parseInt(v) || 0)}
                    />
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                        <Ionicons name="close" size={24} color={Colors.dark.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>
                        {isEditing ? 'Edit Template' : 'New Template'}
                    </Text>
                    <TouchableOpacity onPress={handleSave} style={styles.headerButton} disabled={saving}>
                        <Text style={[styles.saveText, saving && styles.saveTextDisabled]}>
                            {saving ? 'Saving...' : 'Save'}
                        </Text>
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
                    {/* Template Info */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Template Info</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Template name *"
                            placeholderTextColor={Colors.dark.textSecondary}
                            value={name}
                            onChangeText={setName}
                        />
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="Description (optional)"
                            placeholderTextColor={Colors.dark.textSecondary}
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            numberOfLines={3}
                        />
                        <View style={styles.row}>
                            <View style={styles.halfField}>
                                <Text style={styles.fieldLabel}>Duration (min)</Text>
                                <TextInput
                                    style={styles.input}
                                    keyboardType="number-pad"
                                    value={duration}
                                    onChangeText={setDuration}
                                />
                            </View>
                            <View style={styles.halfField}>
                                <Text style={styles.fieldLabel}>Max Capacity</Text>
                                <TextInput
                                    style={styles.input}
                                    keyboardType="number-pad"
                                    value={capacity}
                                    onChangeText={setCapacity}
                                />
                            </View>
                        </View>
                    </View>

                    {/* Exercises */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Exercises</Text>
                            <TouchableOpacity onPress={handleAddExercise} style={styles.addExerciseButton}>
                                <Ionicons name="add-circle" size={24} color={Colors.dark.primary} />
                            </TouchableOpacity>
                        </View>

                        {exercises.length === 0 ? (
                            <TouchableOpacity style={styles.emptyExercises} onPress={handleAddExercise}>
                                <Ionicons name="barbell-outline" size={32} color={Colors.dark.textSecondary} />
                                <Text style={styles.emptyExercisesText}>Tap to add exercises</Text>
                            </TouchableOpacity>
                        ) : (
                            exercises.map(renderExercise)
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    flex: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
    },
    headerButton: {
        padding: 4,
        minWidth: 60,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: Colors.dark.text,
    },
    saveText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.dark.primary,
        textAlign: 'right',
    },
    saveTextDisabled: {
        color: Colors.dark.textSecondary,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.dark.textSecondary,
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: {
        backgroundColor: Colors.dark.card,
        borderRadius: 10,
        padding: 14,
        fontSize: 16,
        color: Colors.dark.text,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    textArea: {
        height: 80,
        textAlignVertical: 'top',
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    halfField: {
        flex: 1,
    },
    fieldLabel: {
        fontSize: 12,
        color: Colors.dark.textSecondary,
        marginBottom: 6,
    },
    addExerciseButton: {
        padding: 4,
    },
    emptyExercises: {
        backgroundColor: Colors.dark.card,
        borderRadius: 12,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderStyle: 'dashed',
    },
    emptyExercisesText: {
        marginTop: 8,
        color: Colors.dark.textSecondary,
        fontSize: 14,
    },
    exerciseCard: {
        backgroundColor: Colors.dark.card,
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    exerciseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    exerciseNumber: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.dark.primary,
    },
    exerciseNameInput: {
        fontSize: 16,
        fontWeight: '500',
        color: Colors.dark.text,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
        marginBottom: 12,
    },
    exerciseRow: {
        flexDirection: 'row',
        gap: 12,
    },
    exerciseField: {
        flex: 1,
    },
    fieldInput: {
        backgroundColor: Colors.dark.background,
        borderRadius: 8,
        padding: 10,
        fontSize: 14,
        color: Colors.dark.text,
        textAlign: 'center',
    },
});
