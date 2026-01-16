/**
 * Workout Import Modal (Unified)
 * 
 * UI for importing workout history from Strong or Hevy App CSV exports.
 * Auto-detects the format, no user action required.
 */

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/context/auth-context';
import { importWorkouts, parseUnifiedWorkoutsFromCsv, type ImportProgress, type ParseResult } from '@/lib/services/import';
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
    View,
} from 'react-native';

interface WorkoutImportModalProps {
    visible: boolean;
    onClose: () => void;
    onImportComplete?: (result: { imported: number; prs: number }) => void;
}

type ImportPhase = 'idle' | 'parsing' | 'preview' | 'importing' | 'complete' | 'error';

export function WorkoutImportModal({ visible, onClose, onImportComplete }: WorkoutImportModalProps) {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const { user } = useAuth();

    const [phase, setPhase] = useState<ImportPhase>('idle');
    const [parseResult, setParseResult] = useState<ParseResult | null>(null);
    const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
    const [importResult, setImportResult] = useState<{ imported: number; prs: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [detectedSource, setDetectedSource] = useState<'hevy' | 'strong' | 'unknown'>('unknown');

    const handlePickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['text/csv', 'text/comma-separated-values', '*/*'],
                copyToCacheDirectory: true,
            });

            if (result.canceled || !result.assets?.[0]) {
                return;
            }

            const file = result.assets[0];

            // Validate file extension
            if (!file.name?.toLowerCase().endsWith('.csv')) {
                Alert.alert('Invalid File', 'Please select a CSV file exported from Strong or Hevy App.');
                return;
            }

            setPhase('parsing');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            // Read file content
            const content = await FileSystem.readAsStringAsync(file.uri);

            // Parse CSV with unified parser (auto-detects Strong vs Hevy)
            const parsed = parseUnifiedWorkoutsFromCsv(content, user?.id || 'local');

            setDetectedSource(parsed.diagnostics.exportType);
            setParseResult(parsed);

            if (parsed.diagnostics.errors.length > 0) {
                setError(parsed.diagnostics.errors.join('\n'));
                setPhase('error');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                return;
            }

            if (parsed.workouts.length === 0) {
                setError('No workouts found in the CSV file.');
                setPhase('error');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                return;
            }

            setPhase('preview');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            console.error('[WorkoutImport] Error:', err);
            setError(err instanceof Error ? err.message : 'Failed to parse file');
            setPhase('error');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    const handleImport = async () => {
        if (!parseResult || parseResult.workouts.length === 0) return;

        try {
            setPhase('importing');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            const result = await importWorkouts(
                parseResult.workouts,
                user?.id || 'local',
                (progress) => setImportProgress(progress)
            );

            setImportResult({
                imported: result.importedCount,
                prs: result.prsDetected.length,
            });
            setPhase('complete');

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            console.error('[WorkoutImport] Import error:', err);
            setError(err instanceof Error ? err.message : 'Import failed');
            setPhase('error');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    const handleViewHistory = () => {
        if (!importResult) {
            handleClose();
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onImportComplete?.({ imported: importResult.imported, prs: importResult.prs });
        handleClose();
    };

    const handleClose = () => {
        setPhase('idle');
        setParseResult(null);
        setImportProgress(null);
        setImportResult(null);
        setError(null);
        setDetectedSource('unknown');
        onClose();
    };

    const getStats = () => {
        if (!parseResult) return null;
        const workouts = parseResult.workouts;
        const totalExercises = workouts.reduce((sum, w) => sum + w.exercises.length, 0);
        const totalSets = workouts.reduce((sum, w) =>
            sum + w.exercises.reduce((eSum, e) => eSum + e.totalSets, 0), 0);

        // Date range
        const dates = workouts.map(w => new Date(w.completedAt)).filter(d => d.getTime() > 0);
        const earliest = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
        const latest = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;

        return {
            totalWorkouts: workouts.length,
            totalExercises,
            totalSets,
            earliest,
            latest
        };
    };

    const formatDateRange = () => {
        const stats = getStats();
        if (!stats?.earliest || !stats?.latest) return '';
        const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        return `${formatDate(stats.earliest)} - ${formatDate(stats.latest)}`;
    };

    const sourceLabel = detectedSource === 'hevy' ? 'Hevy' : detectedSource === 'strong' ? 'Strong' : 'Workout';
    const sourceColor = detectedSource === 'hevy' ? '#FF9500' : detectedSource === 'strong' ? '#34C759' : colors.tint;

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
                    <ThemedText style={styles.title}>Import Workout History</ThemedText>
                    <Pressable onPress={handleClose} hitSlop={12}>
                        <IconSymbol name="xmark.circle.fill" size={28} color={colors.textSecondary} />
                    </Pressable>
                </View>

                <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                    {/* Idle State */}
                    {phase === 'idle' && (
                        <View style={styles.centerContent}>
                            <View style={[styles.iconCircle, { backgroundColor: colors.tint + '20' }]}>
                                <IconSymbol name="arrow.down" size={48} color={colors.tint} />
                            </View>
                            <ThemedText style={styles.heading}>Import Workout History</ThemedText>
                            <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
                                Select a CSV export from Strong or Hevy App.{'\n'}
                                We'll auto-detect the format.
                            </ThemedText>
                            <Pressable
                                style={[styles.primaryButton, { backgroundColor: colors.tint }]}
                                onPress={handlePickFile}
                            >
                                <IconSymbol name="doc.text" size={20} color="#fff" />
                                <ThemedText style={styles.buttonText}>Select CSV File</ThemedText>
                            </Pressable>
                        </View>
                    )}

                    {/* Parsing State */}
                    {phase === 'parsing' && (
                        <View style={styles.centerContent}>
                            <ActivityIndicator size="large" color={colors.tint} />
                            <ThemedText style={[styles.heading, { marginTop: Spacing.lg }]}>
                                Parsing CSV...
                            </ThemedText>
                        </View>
                    )}

                    {/* Preview State */}
                    {phase === 'preview' && parseResult && (
                        <View>
                            <Card padding="md" style={styles.statsCard}>
                                <View style={styles.sourceRow}>
                                    <View style={[styles.sourceBadge, { backgroundColor: sourceColor + '20' }]}>
                                        <ThemedText style={[styles.sourceBadgeText, { color: sourceColor }]}>
                                            {sourceLabel} Export
                                        </ThemedText>
                                    </View>
                                </View>

                                <ThemedText style={styles.statsTitle}>Ready to Import</ThemedText>

                                <View style={styles.statsGrid}>
                                    <View style={styles.statItem}>
                                        <ThemedText style={[styles.statValue, { color: sourceColor }]}>
                                            {getStats()?.totalWorkouts ?? 0}
                                        </ThemedText>
                                        <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                                            Workouts
                                        </ThemedText>
                                    </View>
                                    <View style={styles.statItem}>
                                        <ThemedText style={[styles.statValue, { color: sourceColor }]}>
                                            {getStats()?.totalExercises ?? 0}
                                        </ThemedText>
                                        <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                                            Exercises
                                        </ThemedText>
                                    </View>
                                    <View style={styles.statItem}>
                                        <ThemedText style={[styles.statValue, { color: sourceColor }]}>
                                            {getStats()?.totalSets ?? 0}
                                        </ThemedText>
                                        <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                                            Sets
                                        </ThemedText>
                                    </View>
                                </View>

                                {formatDateRange() && (
                                    <View style={styles.dateRange}>
                                        <IconSymbol name="calendar" size={16} color={colors.textSecondary} />
                                        <ThemedText style={[styles.dateRangeText, { color: colors.textSecondary }]}>
                                            {formatDateRange()}
                                        </ThemedText>
                                    </View>
                                )}
                            </Card>

                            {parseResult.diagnostics.warnings.length > 0 && (
                                <Card padding="sm" style={[styles.warningsCard, { backgroundColor: '#FF9500' + '15' }]}>
                                    <ThemedText style={[styles.warningsTitle, { color: '#FF9500' }]}>
                                        Warnings ({parseResult.diagnostics.warnings.length})
                                    </ThemedText>
                                    {parseResult.diagnostics.warnings.slice(0, 3).map((w, i) => (
                                        <ThemedText key={i} style={[styles.warningText, { color: colors.textSecondary }]}>
                                            • {w}
                                        </ThemedText>
                                    ))}
                                </Card>
                            )}

                            <Pressable
                                style={[styles.primaryButton, { backgroundColor: sourceColor, marginTop: Spacing.lg }]}
                                onPress={handleImport}
                            >
                                <IconSymbol name="arrow.down" size={20} color="#fff" />
                                <ThemedText style={styles.buttonText}>Import Workouts</ThemedText>
                            </Pressable>
                        </View>
                    )}

                    {/* Importing State */}
                    {phase === 'importing' && (
                        <View style={styles.centerContent}>
                            <ActivityIndicator size="large" color={sourceColor} />
                            <ThemedText style={[styles.heading, { marginTop: Spacing.lg }]}>
                                Importing...
                            </ThemedText>
                            {importProgress && (
                                <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
                                    {importProgress.current} of {importProgress.total} workouts
                                </ThemedText>
                            )}
                        </View>
                    )}

                    {/* Complete State */}
                    {phase === 'complete' && importResult && (
                        <View style={styles.centerContent}>
                            <View style={[styles.iconCircle, { backgroundColor: '#34C759' + '20' }]}>
                                <IconSymbol name="checkmark" size={48} color="#34C759" />
                            </View>
                            <ThemedText style={styles.heading}>Import Complete!</ThemedText>
                            <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
                                Successfully imported {importResult.imported} workouts
                                {importResult.prs > 0 && ` with ${importResult.prs} new PRs`}.
                            </ThemedText>
                            <Pressable
                                style={[styles.primaryButton, { backgroundColor: colors.tint, marginTop: Spacing.lg }]}
                                onPress={handleViewHistory}
                            >
                                <ThemedText style={styles.buttonText}>View History</ThemedText>
                            </Pressable>
                        </View>
                    )}

                    {/* Error State */}
                    {phase === 'error' && (
                        <View style={styles.centerContent}>
                            <View style={[styles.iconCircle, { backgroundColor: '#FF453A' + '20' }]}>
                                <IconSymbol name="xmark" size={48} color="#FF453A" />
                            </View>
                            <ThemedText style={styles.heading}>Import Failed</ThemedText>
                            <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
                                {error || 'An unknown error occurred.'}
                            </ThemedText>
                            <Pressable
                                style={[styles.primaryButton, { backgroundColor: colors.tint, marginTop: Spacing.lg }]}
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

// Keep backward-compatible export name
export { WorkoutImportModal as StrongImportModal };

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    title: {
        ...Typography.title3,
        fontWeight: '600',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: Spacing.lg,
        paddingBottom: Spacing.xxl,
    },
    centerContent: {
        alignItems: 'center',
        paddingVertical: Spacing.xxl,
    },
    iconCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    heading: {
        ...Typography.title2,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: Spacing.sm,
    },
    description: {
        ...Typography.body,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: Spacing.lg,
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl,
        borderRadius: Radius.lg,
        marginTop: Spacing.xl,
    },
    buttonText: {
        ...Typography.headline,
        fontWeight: '600',
        color: '#fff',
    },
    statsCard: {
        marginBottom: Spacing.md,
    },
    sourceRow: {
        marginBottom: Spacing.sm,
    },
    sourceBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radius.sm,
    },
    sourceBadgeText: {
        ...Typography.caption1,
        fontWeight: '600',
    },
    statsTitle: {
        ...Typography.headline,
        fontWeight: '600',
        marginBottom: Spacing.md,
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        ...Typography.largeTitle,
        fontWeight: '700',
    },
    statLabel: {
        ...Typography.caption1,
        marginTop: 2,
    },
    dateRange: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        marginTop: Spacing.md,
        paddingTop: Spacing.md,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(0,0,0,0.1)',
    },
    dateRangeText: {
        ...Typography.subhead,
    },
    warningsCard: {
        marginTop: Spacing.sm,
    },
    warningsTitle: {
        ...Typography.subhead,
        fontWeight: '600',
        marginBottom: Spacing.xs,
    },
    warningText: {
        ...Typography.caption1,
        marginBottom: 2,
    },
});
