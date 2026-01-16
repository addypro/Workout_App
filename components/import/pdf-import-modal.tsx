/**
 * PDF Import Modal
 * 
 * UI for importing workout programs from PDF files.
 * Supports preview, editing, and saving extracted programs.
 */

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/context/auth-context';
import {
    analyzeFilename,
    formatFileSize,
    validatePDFFile,
} from '@/lib/services/import/pdf-validator';
import { supabase } from '@/lib/supabase/client';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';

interface PDFImportModalProps {
    visible: boolean;
    onClose: () => void;
    onImportComplete?: (programName: string) => void;
}

type ImportPhase =
    | 'idle'
    | 'uploading'
    | 'classifying'
    | 'extracting'
    | 'preview'
    | 'saving'
    | 'complete'
    | 'rejected'
    | 'error';

interface ExtractedProgram {
    name: string;
    description?: string;
    durationWeeks: number;
    daysPerWeek: number;
    weeks: {
        weekNumber: number;
        days: {
            dayNumber: number;
            name: string;
            focus?: string;
            exercises: {
                name: string;
                sets: number;
                reps: string;
                restSeconds?: number;
                notes?: string;
            }[];
        }[];
    }[];
}

interface Classification {
    isWorkoutProgram: boolean;
    confidence: number;
    programType?: string;
    reason?: string;
}

export function PDFImportModal({ visible, onClose, onImportComplete }: PDFImportModalProps) {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const { user } = useAuth();

    const [phase, setPhase] = useState<ImportPhase>('idle');
    const [selectedFile, setSelectedFile] = useState<{ name: string; size: number } | null>(null);
    const [classification, setClassification] = useState<Classification | null>(null);
    const [program, setProgram] = useState<ExtractedProgram | null>(null);
    const [editedName, setEditedName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [processingTime, setProcessingTime] = useState(0);
    const [wasCached, setWasCached] = useState(false);

    const handlePickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf'],
                copyToCacheDirectory: true,
            });

            if (result.canceled || !result.assets?.[0]) {
                return;
            }

            const file = result.assets[0];

            // Validate file
            const validation = validatePDFFile({
                name: file.name,
                size: file.size || 0,
                mimeType: file.mimeType,
            });

            if (!validation.valid) {
                Alert.alert('Invalid File', validation.error || 'Please select a valid PDF');
                return;
            }

            // Check filename hints
            const filenameAnalysis = analyzeFilename(file.name);
            if (filenameAnalysis.hints.includes('non_workout_keyword_in_name')) {
                Alert.alert(
                    'This may not be a workout program',
                    'The filename suggests this might be a nutrition or supplement guide. Continue anyway?',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Continue', onPress: () => processFile(file) },
                    ]
                );
                return;
            }

            await processFile(file);
        } catch (err) {
            console.error('[PDFImport] File picker error:', err);
            setError('Failed to select file');
            setPhase('error');
        }
    };

    const processFile = async (file: DocumentPicker.DocumentPickerAsset) => {
        try {
            setSelectedFile({ name: file.name, size: file.size || 0 });
            setPhase('uploading');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            // Read file as base64
            const base64 = await FileSystem.readAsStringAsync(file.uri, {
                encoding: FileSystem.EncodingType.Base64,
            });

            setPhase('classifying');

            // Call edge function
            const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
            const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
            const { data: { session } } = await supabase.auth.getSession();

            const response = await fetch(
                `${supabaseUrl}/functions/v1/extract-program-pdf`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': supabaseAnonKey || '',
                        'Authorization': session?.access_token
                            ? `Bearer ${session.access_token}`
                            : `Bearer ${supabaseAnonKey}`,
                    },
                    body: JSON.stringify({
                        base64,
                        filename: file.name,
                        mimeType: file.mimeType || 'application/pdf',
                    }),
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                if (result.rejected) {
                    setClassification(result.classification);
                    setPhase('rejected');
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    return;
                }
                throw new Error(result.error || 'Extraction failed');
            }

            // Success!
            setClassification(result.classification);
            setProgram(result.program);
            setEditedName(result.program.name || 'Imported Program');
            setProcessingTime(result.processingTimeMs || 0);
            setWasCached(result.cached || false);
            setPhase('preview');

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err: any) {
            console.error('[PDFImport] Processing error:', err);
            setError(err.message || 'Failed to process PDF');
            setPhase('error');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    const handleSave = async () => {
        if (!program) return;

        try {
            setPhase('saving');

            // TODO: Save to user's programs collection
            // For now, just simulate save
            await new Promise(resolve => setTimeout(resolve, 500));

            setPhase('complete');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onImportComplete?.(editedName);
        } catch (err: any) {
            console.error('[PDFImport] Save error:', err);
            setError(err.message || 'Failed to save program');
            setPhase('error');
        }
    };

    const handleClose = () => {
        setPhase('idle');
        setSelectedFile(null);
        setClassification(null);
        setProgram(null);
        setEditedName('');
        setError(null);
        setProcessingTime(0);
        setWasCached(false);
        onClose();
    };

    const getTotalExercises = () => {
        if (!program?.weeks) return 0;
        return program.weeks.reduce((sum, week) =>
            sum + week.days.reduce((daySum, day) =>
                daySum + (day.exercises?.length || 0), 0), 0);
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleClose}
        >
            <ThemedView style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <ThemedText style={styles.title}>Import Program PDF</ThemedText>
                    <Pressable onPress={handleClose} hitSlop={12}>
                        <IconSymbol name="xmark.circle.fill" size={28} color={colors.textSecondary} />
                    </Pressable>
                </View>

                <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                    {/* Idle State */}
                    {phase === 'idle' && (
                        <View style={styles.centerContent}>
                            <View style={[styles.iconCircle, { backgroundColor: colors.tint + '20' }]}>
                                <IconSymbol name="doc.text" size={48} color={colors.tint} />
                            </View>
                            <ThemedText style={styles.heading}>Import Workout Program</ThemedText>
                            <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
                                Upload a PDF from any fitness program and we'll extract the workouts automatically.
                            </ThemedText>
                            <Pressable
                                style={[styles.primaryButton, { backgroundColor: colors.tint }]}
                                onPress={handlePickFile}
                            >
                                <IconSymbol name="doc.badge.plus" size={20} color="#fff" />
                                <ThemedText style={styles.buttonText}>Select PDF</ThemedText>
                            </Pressable>
                        </View>
                    )}

                    {/* Uploading/Processing States */}
                    {(phase === 'uploading' || phase === 'classifying' || phase === 'extracting') && (
                        <View style={styles.centerContent}>
                            <ActivityIndicator size="large" color={colors.tint} />
                            <ThemedText style={[styles.heading, { marginTop: Spacing.lg }]}>
                                {phase === 'uploading' && 'Uploading...'}
                                {phase === 'classifying' && 'Analyzing PDF...'}
                                {phase === 'extracting' && 'Extracting program...'}
                            </ThemedText>
                            {selectedFile && (
                                <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
                                    {selectedFile.name} ({formatFileSize(selectedFile.size)})
                                </ThemedText>
                            )}
                        </View>
                    )}

                    {/* Rejected State */}
                    {phase === 'rejected' && (
                        <View style={styles.centerContent}>
                            <View style={[styles.iconCircle, { backgroundColor: '#FF950020' }]}>
                                <IconSymbol name="exclamationmark.triangle" size={48} color="#FF9500" />
                            </View>
                            <ThemedText style={styles.heading}>Not a Workout Program</ThemedText>
                            <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
                                {classification?.reason || 'This PDF does not appear to contain a workout program.'}
                            </ThemedText>
                            <Pressable
                                style={[styles.primaryButton, { backgroundColor: colors.tint }]}
                                onPress={() => setPhase('idle')}
                            >
                                <ThemedText style={styles.buttonText}>Try Another PDF</ThemedText>
                            </Pressable>
                        </View>
                    )}

                    {/* Preview State */}
                    {phase === 'preview' && program && (
                        <View>
                            {wasCached && (
                                <View style={[styles.cachedBadge, { backgroundColor: '#34C75920' }]}>
                                    <IconSymbol name="bolt.fill" size={14} color="#34C759" />
                                    <ThemedText style={[styles.cachedText, { color: '#34C759' }]}>
                                        Instant load (cached)
                                    </ThemedText>
                                </View>
                            )}

                            <Card padding="md" style={styles.previewCard}>
                                <ThemedText style={styles.previewLabel}>Program Name</ThemedText>
                                <TextInput
                                    style={[styles.nameInput, {
                                        color: colors.text,
                                        borderColor: colors.border,
                                    }]}
                                    value={editedName}
                                    onChangeText={setEditedName}
                                    placeholder="Enter program name"
                                    placeholderTextColor={colors.textSecondary}
                                />

                                <View style={styles.statsRow}>
                                    <View style={styles.statItem}>
                                        <ThemedText style={[styles.statValue, { color: colors.tint }]}>
                                            {program.weeks?.length || 0}
                                        </ThemedText>
                                        <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                                            Weeks
                                        </ThemedText>
                                    </View>
                                    <View style={styles.statItem}>
                                        <ThemedText style={[styles.statValue, { color: colors.tint }]}>
                                            {program.daysPerWeek || program.weeks?.[0]?.days?.length || 0}
                                        </ThemedText>
                                        <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                                            Days/Week
                                        </ThemedText>
                                    </View>
                                    <View style={styles.statItem}>
                                        <ThemedText style={[styles.statValue, { color: colors.tint }]}>
                                            {getTotalExercises()}
                                        </ThemedText>
                                        <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                                            Exercises
                                        </ThemedText>
                                    </View>
                                </View>

                                {classification?.programType && (
                                    <View style={[styles.typeBadge, { backgroundColor: colors.tint + '20' }]}>
                                        <ThemedText style={[styles.typeText, { color: colors.tint }]}>
                                            {classification.programType.charAt(0).toUpperCase() + classification.programType.slice(1)}
                                        </ThemedText>
                                    </View>
                                )}
                            </Card>

                            {/* Week Preview */}
                            <ThemedText style={styles.sectionTitle}>Program Structure</ThemedText>
                            {program.weeks?.slice(0, 2).map((week) => (
                                <Card key={week.weekNumber} padding="sm" style={styles.weekCard}>
                                    <ThemedText style={styles.weekTitle}>Week {week.weekNumber}</ThemedText>
                                    {week.days.map((day) => (
                                        <View key={`${week.weekNumber}-${day.dayNumber}`} style={styles.dayRow}>
                                            <ThemedText style={styles.dayName}>{day.name}</ThemedText>
                                            <ThemedText style={[styles.exerciseCount, { color: colors.textSecondary }]}>
                                                {day.exercises?.length || 0} exercises
                                            </ThemedText>
                                        </View>
                                    ))}
                                </Card>
                            ))}
                            {(program.weeks?.length || 0) > 2 && (
                                <ThemedText style={[styles.moreWeeks, { color: colors.textSecondary }]}>
                                    + {(program.weeks?.length || 0) - 2} more weeks
                                </ThemedText>
                            )}

                            <Pressable
                                style={[styles.primaryButton, { backgroundColor: colors.tint }]}
                                onPress={handleSave}
                            >
                                <IconSymbol name="checkmark.circle" size={20} color="#fff" />
                                <ThemedText style={styles.buttonText}>Import Program</ThemedText>
                            </Pressable>

                            <Pressable style={styles.secondaryButton} onPress={handleClose}>
                                <ThemedText style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
                                    Cancel
                                </ThemedText>
                            </Pressable>
                        </View>
                    )}

                    {/* Saving State */}
                    {phase === 'saving' && (
                        <View style={styles.centerContent}>
                            <ActivityIndicator size="large" color={colors.tint} />
                            <ThemedText style={[styles.heading, { marginTop: Spacing.lg }]}>
                                Saving program...
                            </ThemedText>
                        </View>
                    )}

                    {/* Complete State */}
                    {phase === 'complete' && (
                        <View style={styles.centerContent}>
                            <View style={[styles.iconCircle, { backgroundColor: '#34C75920' }]}>
                                <IconSymbol name="checkmark.circle" size={48} color="#34C759" />
                            </View>
                            <ThemedText style={styles.heading}>Program Imported!</ThemedText>
                            <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
                                "{editedName}" has been added to your programs.
                            </ThemedText>
                            <Pressable
                                style={[styles.primaryButton, { backgroundColor: colors.tint }]}
                                onPress={handleClose}
                            >
                                <ThemedText style={styles.buttonText}>Done</ThemedText>
                            </Pressable>
                        </View>
                    )}

                    {/* Error State */}
                    {phase === 'error' && (
                        <View style={styles.centerContent}>
                            <View style={[styles.iconCircle, { backgroundColor: '#FF3B3020' }]}>
                                <IconSymbol name="xmark.circle" size={48} color="#FF3B30" />
                            </View>
                            <ThemedText style={styles.heading}>Import Failed</ThemedText>
                            <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
                                {error || 'An unexpected error occurred'}
                            </ThemedText>
                            <Pressable
                                style={[styles.primaryButton, { backgroundColor: colors.tint }]}
                                onPress={() => setPhase('idle')}
                            >
                                <ThemedText style={styles.buttonText}>Try Again</ThemedText>
                            </Pressable>
                        </View>
                    )}
                </ScrollView>
            </ThemedView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.md,
        paddingTop: Spacing.lg,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(128,128,128,0.2)',
    },
    title: { ...Typography.title3 },
    content: { flex: 1 },
    contentContainer: { padding: Spacing.md, paddingBottom: Spacing.xxl },
    centerContent: { alignItems: 'center', paddingVertical: Spacing.xxl },
    iconCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    heading: { ...Typography.title2, textAlign: 'center', marginBottom: Spacing.sm },
    description: {
        ...Typography.body,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: Spacing.lg,
        paddingHorizontal: Spacing.md,
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl,
        borderRadius: Radius.lg,
        marginTop: Spacing.md,
        width: '100%',
    },
    buttonText: { color: '#fff', ...Typography.headline },
    secondaryButton: { alignItems: 'center', paddingVertical: Spacing.md, marginTop: Spacing.sm },
    secondaryButtonText: { ...Typography.body },
    cachedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: Spacing.sm,
        borderRadius: Radius.sm,
        marginBottom: Spacing.md,
    },
    cachedText: { ...Typography.caption1, fontWeight: '600' },
    previewCard: { marginBottom: Spacing.md },
    previewLabel: { ...Typography.caption1, marginBottom: 4 },
    nameInput: {
        ...Typography.title3,
        borderWidth: 1,
        borderRadius: Radius.md,
        padding: Spacing.sm,
        marginBottom: Spacing.md,
    },
    statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: Spacing.md },
    statItem: { alignItems: 'center' },
    statValue: { fontSize: 28, fontWeight: '700' },
    statLabel: { ...Typography.caption1, marginTop: 2 },
    typeBadge: {
        alignSelf: 'center',
        paddingVertical: 4,
        paddingHorizontal: Spacing.sm,
        borderRadius: Radius.sm,
    },
    typeText: { ...Typography.caption1, fontWeight: '600' },
    sectionTitle: { ...Typography.headline, marginBottom: Spacing.sm, marginTop: Spacing.md },
    weekCard: { marginBottom: Spacing.sm },
    weekTitle: { ...Typography.headline, marginBottom: Spacing.xs },
    dayRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(128,128,128,0.1)',
    },
    dayName: { ...Typography.body },
    exerciseCount: { ...Typography.caption1 },
    moreWeeks: { ...Typography.caption1, textAlign: 'center', marginTop: Spacing.xs },
});
