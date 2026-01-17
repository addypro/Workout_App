/**
 * Workout Review (Athlete)
 *
 * Review and confirm auto-logged class workout.
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
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import {
    ClassExercise,
    ClassWorkoutLog,
    getClassWorkoutLog,
    reviewWorkoutLog,
} from '@/lib/services/classes';

export default function ClassWorkoutReviewScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [log, setLog] = useState<ClassWorkoutLog | null>(null);
    const [exercises, setExercises] = useState<ClassExercise[]>([]);
    const [feedback, setFeedback] = useState('');
    const [rating, setRating] = useState(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadLog();
    }, [id]);

    const loadLog = async () => {
        if (!id) return;

        const result = await getClassWorkoutLog(id);
        if (result.data) {
            setLog(result.data);
            setExercises(result.data.exercisesJson ?? []);
        }
        setLoading(false);
    };

    const handleUpdateExercise = (index: number, field: keyof ClassExercise, value: any) => {
        const updated = [...exercises];
        updated[index] = { ...updated[index], [field]: value };
        setExercises(updated);
    };

    const handleSave = async () => {
        if (!id || !log) return;

        setSaving(true);
        const result = await reviewWorkoutLog(
            id,
            exercises,
            feedback || undefined,
            rating > 0 ? rating : undefined
        );
        setSaving(false);

        if (result.error) {
            Alert.alert('Error', result.error);
        } else {
            Alert.alert('Saved!', 'Your workout has been logged.', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        }
    };

    const renderRatingStars = () => (
        <View style={styles.ratingContainer}>
            <Text style={styles.ratingLabel}>Rate this class</Text>
            <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                        key={star}
                        onPress={() => setRating(star)}
                        hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                    >
                        <Ionicons
                            name={star <= rating ? 'star' : 'star-outline'}
                            size={28}
                            color={star <= rating ? Colors.dark.warning : Colors.dark.textSecondary}
                        />
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={Colors.dark.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (!log) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centered}>
                    <Text style={styles.errorText}>Workout log not found</Text>
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
                    <Ionicons name="close" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Review Workout</Text>
                <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={saving}>
                    <Text style={[styles.saveText, saving && styles.saveTextDisabled]}>
                        {saving ? 'Saving...' : 'Save'}
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
                {/* Info Banner */}
                <View style={styles.infoBanner}>
                    <Ionicons name="information-circle" size={20} color={Colors.dark.primary} />
                    <Text style={styles.infoBannerText}>
                        Your coach pre-filled this workout. Review and adjust as needed.
                    </Text>
                </View>

                {/* Exercises */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Exercises</Text>
                    {exercises.map((exercise, index) => (
                        <View key={index} style={styles.exerciseCard}>
                            <Text style={styles.exerciseName}>{exercise.name}</Text>
                            <View style={styles.exerciseInputs}>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Sets</Text>
                                    <TextInput
                                        style={styles.input}
                                        keyboardType="number-pad"
                                        value={String(exercise.sets)}
                                        onChangeText={(v) => handleUpdateExercise(index, 'sets', parseInt(v) || 0)}
                                    />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Reps</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={exercise.reps}
                                        onChangeText={(v) => handleUpdateExercise(index, 'reps', v)}
                                    />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Weight</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={exercise.weight ?? ''}
                                        onChangeText={(v) => handleUpdateExercise(index, 'weight', v)}
                                        placeholder="—"
                                        placeholderTextColor={Colors.dark.textSecondary}
                                    />
                                </View>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Rating */}
                {renderRatingStars()}

                {/* Feedback */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Notes (Optional)</Text>
                    <TextInput
                        style={styles.feedbackInput}
                        placeholder="How was this class? Any feedback for your coach?"
                        placeholderTextColor={Colors.dark.textSecondary}
                        value={feedback}
                        onChangeText={setFeedback}
                        multiline
                        numberOfLines={3}
                    />
                </View>

                <View style={styles.bottomPadding} />
            </ScrollView>
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
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: Colors.dark.text,
    },
    saveButton: {
        padding: 4,
        minWidth: 60,
        alignItems: 'flex-end',
    },
    saveText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.dark.primary,
    },
    saveTextDisabled: {
        color: Colors.dark.textSecondary,
    },
    content: {
        flex: 1,
    },
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.primary + '15',
        margin: 16,
        padding: 14,
        borderRadius: 12,
        gap: 10,
    },
    infoBannerText: {
        flex: 1,
        fontSize: 13,
        color: Colors.dark.text,
        lineHeight: 18,
    },
    section: {
        paddingHorizontal: 16,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.dark.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    exerciseCard: {
        backgroundColor: Colors.dark.card,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    exerciseName: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.dark.text,
        marginBottom: 12,
    },
    exerciseInputs: {
        flexDirection: 'row',
        gap: 12,
    },
    inputGroup: {
        flex: 1,
    },
    inputLabel: {
        fontSize: 11,
        color: Colors.dark.textSecondary,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: {
        backgroundColor: Colors.dark.background,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        fontSize: 15,
        color: Colors.dark.text,
        textAlign: 'center',
    },
    ratingContainer: {
        paddingHorizontal: 16,
        marginBottom: 24,
        alignItems: 'center',
    },
    ratingLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.dark.textSecondary,
        marginBottom: 12,
    },
    starsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    feedbackInput: {
        backgroundColor: Colors.dark.card,
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        color: Colors.dark.text,
        minHeight: 80,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    bottomPadding: {
        height: 40,
    },
});
