/**
 * Voice Workout Builder Screen
 * 
 * Real-time voice workout creation with streaming exercise extraction.
 * Ultra-light UI optimized for low latency and inline editing.
 * 
 * Key UX Principles (based on user psychology research):
 * - Inline correction: Users fix as they go (like iOS autocorrect)
 * - No confirmation screen: Exercises added directly from this screen
 * - Minimal visual weight: Focus on speed, not decoration
 */

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMachine } from '@xstate/react';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
    Animated,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/lib/context/theme-context';
import {
    createStreamingExercise,
    getConfidenceLevel,
    voiceBuilderMachine,
    type StreamingExercise
} from '@/lib/machines/voice-builder.machine';
import { resolveExercise } from '@/lib/services/exercise/resolver';
import { searchExercisesAdvanced, type SearchResult } from '@/lib/services/exercise/search';
import type { ExtractedExercise } from '@/lib/services/voice/direct-intent-types';
import {
    voiceDirectService,
    type AudioFile,
} from '@/lib/services/voice/voice-direct-service';

const SELECTED_EXERCISE_KEY = '@selected_exercise_temp';

// ============================================
// STREAMING EXERCISE CARD (Ultra-Light)
// ============================================

interface ExerciseCardProps {
    exercise: StreamingExercise;
    isEditing: boolean;
    onEdit: () => void;
    onConfirm: () => void;
    onUpdate: (updates: Partial<StreamingExercise>) => void;
    onDelete: () => void;
    onClose: () => void;
}

function StreamingExerciseCard({
    exercise,
    isEditing,
    onEdit,
    onConfirm,
    onUpdate,
    onDelete,
    onClose,
}: ExerciseCardProps) {
    const { colors } = useAppTheme();
    const confidenceLevel = getConfidenceLevel(exercise.confidence);

    // Confidence-based styling
    const borderColor =
        exercise.status === 'confirmed' || exercise.status === 'edited'
            ? colors.success
            : confidenceLevel === 'high'
                ? colors.success + '80'
                : confidenceLevel === 'medium'
                    ? colors.warning
                    : colors.error + '80';

    const borderStyle = confidenceLevel === 'low' && exercise.status === 'resolved'
        ? 'dashed' as const
        : 'solid' as const;

    if (isEditing) {
        return (
            <View style={[styles.card, styles.editingCard, { borderColor: colors.primary }]}>
                <TextInput
                    style={[styles.editInput, { color: colors.text }]}
                    value={exercise.resolvedName}
                    onChangeText={(text) => onUpdate({ resolvedName: text })}
                    placeholder="Exercise name"
                    placeholderTextColor={colors.textSecondary}
                    autoFocus
                />

                <View style={styles.editRow}>
                    <View style={styles.editField}>
                        <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Sets</Text>
                        <TextInput
                            style={[styles.editSmallInput, { color: colors.text, borderColor: colors.border }]}
                            value={String(exercise.sets)}
                            onChangeText={(text) => onUpdate({ sets: parseInt(text) || 3 })}
                            keyboardType="number-pad"
                        />
                    </View>
                    <View style={styles.editField}>
                        <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Reps</Text>
                        <TextInput
                            style={[styles.editSmallInput, { color: colors.text, borderColor: colors.border }]}
                            value={exercise.reps}
                            onChangeText={(text) => onUpdate({ reps: text })}
                            keyboardType="number-pad"
                        />
                    </View>
                    <View style={styles.editField}>
                        <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Weight</Text>
                        <TextInput
                            style={[styles.editSmallInput, { color: colors.text, borderColor: colors.border }]}
                            value={exercise.weight ? String(exercise.weight) : ''}
                            onChangeText={(text) => onUpdate({ weight: parseFloat(text) || null })}
                            placeholder="-"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="decimal-pad"
                        />
                    </View>
                </View>

                {/* Alternatives */}
                {exercise.alternatives.length > 0 && (
                    <View style={styles.alternatives}>
                        <Text style={[styles.alternativesLabel, { color: colors.textSecondary }]}>
                            Did you mean:
                        </Text>
                        {exercise.alternatives.slice(0, 3).map((alt, idx) => (
                            <Pressable
                                key={idx}
                                style={[styles.alternativeChip, { backgroundColor: colors.cardBackground }]}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    onUpdate({ resolvedName: alt.name, confidence: alt.score });
                                }}
                            >
                                <Text style={[styles.alternativeText, { color: colors.text }]}>
                                    {alt.name}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                )}

                <View style={styles.editActions}>
                    <Pressable style={styles.deleteBtn} onPress={onDelete}>
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </Pressable>
                    <Pressable
                        style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            onConfirm();
                            onClose();
                        }}
                    >
                        <Text style={styles.confirmBtnText}>Done</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    // Collapsed view
    return (
        <Pressable
            style={[
                styles.card,
                { borderColor, borderStyle }
            ]}
            onPress={() => {
                Haptics.selectionAsync();
                onEdit();
            }}
        >
            <View style={styles.cardRow}>
                <View style={styles.cardLeft}>
                    {exercise.status === 'pending' ? (
                        <Ionicons name="sync" size={16} color={colors.textSecondary} />
                    ) : exercise.status === 'confirmed' || exercise.status === 'edited' ? (
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    ) : confidenceLevel === 'low' ? (
                        <Ionicons name="help-circle" size={16} color={colors.warning} />
                    ) : null}
                    <Text
                        style={[styles.exerciseName, { color: colors.text }]}
                        numberOfLines={1}
                    >
                        {exercise.resolvedName || exercise.rawName}
                    </Text>
                </View>
                <Text style={[styles.exerciseDetails, { color: colors.textSecondary }]}>
                    {exercise.sets}×{exercise.reps}
                    {exercise.weight ? ` @ ${exercise.weight}${exercise.weightUnit}` : ''}
                </Text>
            </View>
        </Pressable>
    );
}

// ============================================
// LIVE TRANSCRIPTION BAR
// ============================================

function LiveTranscriptionBar({ text, isRecording }: { text: string; isRecording: boolean }) {
    const { colors } = useAppTheme();
    const pulseAnim = useRef(new Animated.Value(1)).current;

    React.useEffect(() => {
        if (isRecording) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 0.5, duration: 800, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isRecording]);

    if (!isRecording && !text) return null;

    return (
        <View style={[styles.transcriptionBar, { backgroundColor: colors.cardBackground }]}>
            {isRecording && (
                <Animated.View style={{ opacity: pulseAnim }}>
                    <View style={[styles.recordingDot, { backgroundColor: colors.error }]} />
                </Animated.View>
            )}
            <Text
                style={[styles.transcriptionText, { color: colors.textSecondary }]}
                numberOfLines={2}
            >
                {text || (isRecording ? 'Listening...' : '')}
            </Text>
        </View>
    );
}

// ============================================
// MAIN SCREEN
// ============================================

export default function VoiceWorkoutBuilderScreen() {
    const router = useRouter();
    const { colors } = useAppTheme();
    const [state, send] = useMachine(voiceBuilderMachine);
    const [isRecording, setIsRecording] = useState(false);

    const [isProcessing, setIsProcessing] = useState(false);
    const audioFileRef = useRef<AudioFile | null>(null);

    const isRecordingState = state.matches('recording');
    const isPaused = state.matches('paused');

    // Process extracted exercises with local resolver (hybrid approach)
    const processExtractedExercises = useCallback(async (exercises: ExtractedExercise[]) => {
        const streamingExercises: StreamingExercise[] = exercises.map(ex => {
            const rawName = ex.nameRaw || ex.nameNormalized || 'Exercise';
            const resolved = resolveExercise(rawName);

            return createStreamingExercise(
                rawName,
                ex.sets || 3,
                ex.reps || '10',
                ex.weight,
            );
        });

        // Add to state
        send({ type: 'EXERCISE_EXTRACTED', exercises: streamingExercises });

        // Resolve each exercise asynchronously with alternatives
        for (const ex of streamingExercises) {
            const resolved = resolveExercise(ex.rawName);

            // Get alternatives via search
            let alternatives: { name: string; score: number }[] = [];
            try {
                const searchResults = await searchExercisesAdvanced(ex.rawName, {});
                const allResults = [...searchResults.popular, ...searchResults.byCategory.flatMap(c => c.exercises)];
                alternatives = allResults
                    .filter((r: SearchResult) => r.name !== (resolved.exercise?.canonical_name || resolved.globalRanking?.name || ex.rawName))
                    .slice(0, 3)
                    .map((r: SearchResult) => ({ name: r.name, score: r.score }));
            } catch (e) {
                console.warn('[VoiceBuilder] Failed to get alternatives:', e);
            }

            send({
                type: 'EXERCISE_RESOLVED',
                exerciseId: ex.id,
                resolvedName: resolved.exercise?.canonical_name || resolved.globalRanking?.name || ex.rawName,
                confidence: resolved.confidence,
                alternatives,
            });
        }
    }, [send]);

    // Handle recording start/stop
    const toggleRecording = useCallback(async () => {
        if (isRecordingState) {
            // Stop recording and process
            try {
                setIsProcessing(true);
                const audioFile = await voiceDirectService.stopRecording();
                audioFileRef.current = audioFile;

                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                send({ type: 'PAUSE_RECORDING' });
                setIsRecording(false);

                // Extract workout from audio
                const result = await voiceDirectService.extractWorkout(audioFile);

                if (result.success && result.data?.exercises) {
                    await processExtractedExercises(result.data.exercises);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } else if (result.error) {
                    console.error('Extraction error:', result.error.message);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                }
            } catch (error) {
                console.error('Recording error:', error);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } finally {
                setIsProcessing(false);
            }
        } else {
            // Start recording
            try {
                await voiceDirectService.startRecording();
                send({ type: isPaused ? 'RESUME_RECORDING' : 'START_RECORDING' });
                setIsRecording(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            } catch (error) {
                console.error('Failed to start recording:', error);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
        }
    }, [isRecordingState, isPaused, send, processExtractedExercises]);

    const handleFinish = useCallback(async () => {
        if (state.context.exercises.length === 0) {
            router.back();
            return;
        }

        // Add each exercise to the active workout via AsyncStorage
        // The workout screen polls for this key and adds exercises
        for (const ex of state.context.exercises) {
            await AsyncStorage.setItem(SELECTED_EXERCISE_KEY, JSON.stringify({
                name: ex.resolvedName || ex.rawName,
                setsCount: ex.sets,
                reps: ex.reps,
                weight: ex.weight,
            }));
            // Small delay to allow workout screen to pick up each exercise
            await new Promise(r => setTimeout(r, 100));
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        send({ type: 'FINISH_WORKOUT' });
        router.back();
    }, [state.context.exercises, router, send]);

    const handleExerciseEdit = useCallback((exerciseId: string) => {
        send({ type: 'EDIT_EXERCISE', exerciseId });
    }, [send]);

    const handleExerciseConfirm = useCallback((exerciseId: string) => {
        send({ type: 'CONFIRM_EXERCISE', exerciseId });
    }, [send]);

    const handleExerciseUpdate = useCallback((exerciseId: string, updates: Partial<StreamingExercise>) => {
        send({ type: 'UPDATE_EXERCISE', exerciseId, updates });
    }, [send]);

    const handleExerciseDelete = useCallback((exerciseId: string) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        send({ type: 'DELETE_EXERCISE', exerciseId });
    }, [send]);

    const handleCloseEdit = useCallback(() => {
        send({ type: 'CLOSE_EDIT' });
    }, [send]);

    // Render exercise card
    const renderExercise = useCallback(({ item }: { item: StreamingExercise }) => (
        <StreamingExerciseCard
            exercise={item}
            isEditing={state.context.editingExerciseId === item.id}
            onEdit={() => handleExerciseEdit(item.id)}
            onConfirm={() => handleExerciseConfirm(item.id)}
            onUpdate={(updates) => handleExerciseUpdate(item.id, updates)}
            onDelete={() => handleExerciseDelete(item.id)}
            onClose={handleCloseEdit}
        />
    ), [state.context.editingExerciseId, handleExerciseEdit, handleExerciseConfirm, handleExerciseUpdate, handleExerciseDelete, handleCloseEdit]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={12}>
                    <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                    Voice Builder
                </Text>
                <Pressable
                    onPress={handleFinish}
                    disabled={state.context.exercises.length === 0}
                    hitSlop={12}
                >
                    <Text style={[
                        styles.doneBtn,
                        { color: state.context.exercises.length > 0 ? colors.primary : colors.textSecondary }
                    ]}>
                        Done
                    </Text>
                </Pressable>
            </View>

            {/* Exercise List */}
            <FlatList
                data={state.context.exercises}
                renderItem={renderExercise}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="mic-outline" size={48} color={colors.textSecondary} />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                            Tap the mic to start adding exercises
                        </Text>
                    </View>
                }
            />

            {/* Live Transcription */}
            <LiveTranscriptionBar
                text={state.context.currentTranscription}
                isRecording={isRecordingState}
            />

            {/* Recording Controls */}
            <View style={[styles.controls, { backgroundColor: colors.cardBackground }]}>
                <Pressable
                    style={[
                        styles.recordBtn,
                        { backgroundColor: isRecordingState ? colors.error : colors.primary }
                    ]}
                    onPress={toggleRecording}
                >
                    <Ionicons
                        name={isRecordingState ? 'pause' : 'mic'}
                        size={32}
                        color="#FFF"
                    />
                </Pressable>
                {isRecordingState && (
                    <Pressable
                        style={[styles.stopBtn, { borderColor: colors.error }]}
                        onPress={() => {
                            send({ type: 'STOP_RECORDING' });
                            setIsRecording(false);
                        }}
                    >
                        <Ionicons name="stop" size={24} color={colors.error} />
                    </Pressable>
                )}
            </View>
        </SafeAreaView>
    );
}

// ============================================
// STYLES (Ultra-Light)
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
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
    },
    doneBtn: {
        fontSize: 17,
        fontWeight: '600',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 120,
        flexGrow: 1,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
        gap: 12,
    },
    emptyText: {
        fontSize: 16,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    card: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
    },
    editingCard: {
        borderWidth: 2,
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    cardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    exerciseName: {
        fontSize: 16,
        fontWeight: '500',
        flex: 1,
    },
    exerciseDetails: {
        fontSize: 14,
    },
    editInput: {
        fontSize: 18,
        fontWeight: '600',
        paddingVertical: 4,
        marginBottom: 12,
    },
    editRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    editField: {
        flex: 1,
    },
    editLabel: {
        fontSize: 12,
        marginBottom: 4,
    },
    editSmallInput: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 8,
        fontSize: 16,
        textAlign: 'center',
    },
    alternatives: {
        marginBottom: 12,
    },
    alternativesLabel: {
        fontSize: 12,
        marginBottom: 6,
    },
    alternativeChip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        marginBottom: 4,
    },
    alternativeText: {
        fontSize: 14,
    },
    editActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    deleteBtn: {
        padding: 8,
    },
    confirmBtn: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 8,
    },
    confirmBtnText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 15,
    },
    transcriptionBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    recordingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    transcriptionText: {
        flex: 1,
        fontSize: 14,
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
        gap: 20,
    },
    recordBtn: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stopBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
