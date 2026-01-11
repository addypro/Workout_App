/**
 * Import Tab Screen
 *
 * Import workout programs from CSV, Excel, or PDF files.
 * PDF uses AI-powered vision parsing with multi-step flow.
 */

import { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Card } from '@/components/ui/card';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { saveProgram, getProgramByName } from '@/lib/db/storage';
import { parseCSV } from '@/lib/services/parser/csv';
import { parseExcelFromUri } from '@/lib/services/parser/excel';
import { downloadTemplate } from '@/lib/utils/csv-export';
import {
  parsePDF,
  parsePDFWithSelection,
  isPDFParsingAvailable,
  type PDFAnalysis,
  type ProgramOption,
  type ParsedPDFResult,
  type ExtractedProgram,
} from '@/lib/services/parser/pdf';

// Helper to read file content cross-platform
async function readFileContent(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    return await response.text();
  } else {
    const FileSystem = require('expo-file-system');
    return await FileSystem.readAsStringAsync(uri);
  }
}

type FileType = 'csv' | 'excel' | 'pdf' | null;
type Step =
  | 'select'
  | 'configure'
  | 'uploading'
  | 'pdf_analyzing'
  | 'pdf_select_program'
  | 'pdf_extracting'
  | 'pdf_matching'
  | 'pdf_review'
  | 'success'
  | 'error';

const FILE_TYPES = [
  {
    id: 'csv' as const,
    name: 'CSV',
    icon: 'doc.text',
    color: '#30D158',
    description: 'Comma-separated values',
    mimeTypes: ['text/csv', 'text/comma-separated-values'],
  },
  {
    id: 'excel' as const,
    name: 'Excel',
    icon: 'tablecells',
    color: '#34C759',
    description: '.xlsx or .xls files',
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ],
  },
  {
    id: 'pdf' as const,
    name: 'PDF',
    icon: 'doc.richtext',
    color: '#FF3B30',
    description: 'AI-powered extraction',
    mimeTypes: ['application/pdf'],
  },
];

export default function ImportScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Basic state
  const [step, setStep] = useState<Step>('select');
  const [selectedType, setSelectedType] = useState<FileType>(null);
  const [selectedFile, setSelectedFile] = useState<{ name: string; uri: string } | null>(null);
  const [programName, setProgramName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // PDF parsing state
  const [pdfProgress, setPdfProgress] = useState({ stage: '', percent: 0 });
  const [pdfAnalysis, setPdfAnalysis] = useState<PDFAnalysis | null>(null);
  const [pdfResult, setPdfResult] = useState<ParsedPDFResult | null>(null);
  const [selectedProgramOption, setSelectedProgramOption] = useState<ProgramOption | null>(null);
  const [contentHash, setContentHash] = useState<string | undefined>(undefined);
  const [customPageRange, setCustomPageRange] = useState<{ start: string; end: string }>({ start: '', end: '' });

  // Threshold for showing page range selector (PDFs with more pages may benefit from focused extraction)
  const LONG_PDF_THRESHOLD = 30;

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleSelectFileType = (type: FileType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedType(type);
    setError(null);
  };

  const handlePickFile = async () => {
    if (!selectedType) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const fileTypeConfig = FILE_TYPES.find(t => t.id === selectedType);
    if (!fileTypeConfig) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: fileTypeConfig.mimeTypes,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        setSelectedFile({ name: file.name, uri: file.uri });
        setProgramName(file.name.replace(/\.[^/.]+$/, ''));

        // For PDF, go directly to parsing flow
        if (selectedType === 'pdf') {
          handlePDFUpload(file.uri, file.name);
        } else {
          setStep('configure');
        }
      }
    } catch (err) {
      console.error('Error picking file:', err);
      showAlert('Error', 'Failed to pick file');
    }
  };

  // PDF Parsing Flow
  const handlePDFUpload = async (uri: string, filename: string) => {
    if (!isPDFParsingAvailable()) {
      showAlert(
        'PDF Parsing Unavailable',
        'PDF parsing requires Supabase Edge Functions. Please configure your Supabase project or use CSV/Excel format.'
      );
      return;
    }

    setStep('pdf_analyzing');
    setPdfProgress({ stage: 'Analyzing PDF structure...', percent: 0 });

    try {
      const result = await parsePDF(uri, filename, (stage, percent) => {
        setPdfProgress({ stage, percent });

        // Update step based on progress
        if (percent < 30) {
          setStep('pdf_analyzing');
        } else if (percent < 60) {
          setStep('pdf_extracting');
        } else if (percent < 90) {
          setStep('pdf_matching');
        }
      });

      setPdfResult(result);

      if (result.status === 'error') {
        setError(result.errorMessage || 'Failed to parse PDF');
        setStep('error');
        return;
      }

      if (result.status === 'no_workout_found') {
        setError(
          result.analysis.rejectionReason ||
            'This document does not appear to contain a workout program.'
        );
        setStep('error');
        return;
      }

      // Store content hash for subsequent operations (enables cache hits)
      if (result.metadata.contentHash) {
        setContentHash(result.metadata.contentHash);
      }

      // Check if user needs to select a program variation
      if (
        result.analysis.containsMultiplePrograms &&
        result.analysis.programOptions.length > 1
      ) {
        setPdfAnalysis(result.analysis);
        setStep('pdf_select_program');
        return;
      }

      // Success - go to review
      if (result.selectedProgram) {
        setProgramName(result.selectedProgram.name || filename.replace('.pdf', ''));
        setStep('pdf_review');
      }
    } catch (err: any) {
      console.error('PDF parsing error:', err);
      setError(err.message || 'Failed to parse PDF');
      setStep('error');
    }
  };

  // Handle program selection (when PDF has multiple programs)
  const handleProgramSelection = async (option: ProgramOption) => {
    if (!selectedFile || !pdfAnalysis) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Apply custom page range if user specified one
    const finalOption: ProgramOption = { ...option };
    if (customPageRange.start && customPageRange.end) {
      const start = parseInt(customPageRange.start, 10);
      const end = parseInt(customPageRange.end, 10);
      if (!isNaN(start) && !isNaN(end) && start > 0 && end >= start) {
        finalOption.pageStart = start;
        finalOption.pageEnd = end;
      }
    }

    setSelectedProgramOption(finalOption);
    setStep('pdf_extracting');
    setPdfProgress({ stage: 'Extracting workouts...', percent: 40 });

    try {
      const result = await parsePDFWithSelection(
        selectedFile.uri,
        selectedFile.name,
        finalOption,
        pdfAnalysis,
        contentHash, // Pass content hash for cache lookup
        (stage, percent) => {
          setPdfProgress({ stage, percent });
        }
      );

      setPdfResult(result);

      if (result.status === 'error') {
        setError(result.errorMessage || 'Failed to extract program');
        setStep('error');
        return;
      }

      if (result.selectedProgram) {
        setProgramName(result.selectedProgram.name || option.name);
        setStep('pdf_review');
      }
    } catch (err: any) {
      console.error('PDF extraction error:', err);
      setError(err.message || 'Failed to extract program');
      setStep('error');
    }
  };

  // Save PDF program
  const handleSavePDFProgram = async () => {
    if (!pdfResult?.selectedProgram || !selectedFile) return;

    setStep('uploading');

    try {
      const program = pdfResult.selectedProgram;
      const name = programName || program.name || 'Imported Program';
      const existing = await getProgramByName(name);

      // Convert extracted program to storage format
      const workouts = program.weeks.flatMap(week =>
        week.workouts.map(workout => ({
          week: week.weekNumber,
          day: workout.dayNumber,
          name: workout.name,
          exercises: workout.exercises.map(ex => ({
            name: ex.nameNormalized || ex.nameRaw,
            sets: ex.sets,
            reps: ex.reps,
            weight: ex.weight,
            restSeconds: ex.restSeconds,
            notes: ex.notes,
            supersetId: ex.supersetId,
          })),
        }))
      );

      const doSave = async () => {
        await saveProgram({
          userId: 'local',
          name,
          description: `${program.totalWeeks} week${program.totalWeeks !== 1 ? 's' : ''}, ${program.daysPerWeek} days/week`,
          sourceFileUri: selectedFile.uri,
          sourceType: 'PDF',
          status: 'READY',
          parsedData: JSON.stringify({ workouts, ...program }),
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep('success');

        setTimeout(() => {
          resetUpload();
          router.push('/(tabs)');
        }, 1500);
      };

      if (existing) {
        Alert.alert(
          'Program Exists',
          `"${name}" is already in My Programs. Add another copy?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setStep('pdf_review') },
            { text: 'Add Anyway', onPress: doSave },
          ]
        );
      } else {
        await doSave();
      }
    } catch (err: any) {
      console.error('Error saving PDF program:', err);
      setError(err.message || 'Failed to save program');
      setStep('error');
    }
  };

  // CSV/Excel upload
  const handleUpload = async () => {
    if (!selectedFile || !selectedType) return;

    setStep('uploading');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      let parsed;

      if (selectedType === 'csv') {
        const content = await readFileContent(selectedFile.uri);
        parsed = await parseCSV(content);
      } else if (selectedType === 'excel') {
        parsed = await parseExcelFromUri(selectedFile.uri);
      }

      if (!parsed || !parsed.workouts || parsed.workouts.length === 0) {
        throw new Error('No workout data found in file');
      }

      const name = programName || 'Untitled Program';
      const existing = await getProgramByName(name);

      const doSave = async () => {
        await saveProgram({
          userId: 'local',
          name,
          description: `${parsed.workouts.length} workout${parsed.workouts.length !== 1 ? 's' : ''}`,
          sourceFileUri: selectedFile.uri,
          sourceType: selectedType.toUpperCase() as 'CSV' | 'PDF' | 'EXCEL' | 'IMAGE' | 'KAGGLE',
          status: 'READY',
          parsedData: JSON.stringify(parsed),
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep('success');

        setTimeout(() => {
          resetUpload();
          router.push('/(tabs)');
        }, 1500);
      };

      if (existing) {
        Alert.alert(
          'Program Exists',
          `"${name}" is already in My Programs. Add another copy?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setStep('configure') },
            { text: 'Add Anyway', onPress: doSave },
          ]
        );
      } else {
        await doSave();
      }
    } catch (err: any) {
      console.error('Error uploading:', err);
      setStep('configure');
      setError(err.message || 'Failed to parse file');
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setProgramName('');
    setSelectedType(null);
    setStep('select');
    setError(null);
    setPdfAnalysis(null);
    setPdfResult(null);
    setSelectedProgramOption(null);
    setPdfProgress({ stage: '', percent: 0 });
    setContentHash(undefined);
    setCustomPageRange({ start: '', end: '' });
  };

  // Render progress bar for PDF parsing
  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={[styles.progressBar, { backgroundColor: colors.separator }]}>
        <View
          style={[
            styles.progressFill,
            { backgroundColor: colors.tint, width: `${pdfProgress.percent}%` },
          ]}
        />
      </View>
      <ThemedText style={[styles.progressText, { color: colors.textSecondary }]}>
        {pdfProgress.stage}
      </ThemedText>
    </View>
  );

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Hero Section */}
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: colors.tintMuted }]}>
            <IconSymbol name="square.and.arrow.down" size={40} color={colors.tint} />
          </View>
          <ThemedText style={[styles.heroTitle, { color: colors.text }]}>
            Import Program
          </ThemedText>
          <ThemedText style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            Upload your workout plan from CSV, Excel, or PDF
          </ThemedText>
        </View>

        {/* Step: Select File Type */}
        {step === 'select' && (
          <>
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                SELECT FILE TYPE
              </ThemedText>
              <View style={styles.fileTypeGrid}>
                {FILE_TYPES.map((type) => (
                  <Pressable
                    key={type.id}
                    style={[
                      styles.fileTypeCard,
                      {
                        backgroundColor: selectedType === type.id ? type.color + '18' : colors.card,
                        borderColor: selectedType === type.id ? type.color : colors.separator,
                      },
                    ]}
                    onPress={() => handleSelectFileType(type.id)}
                  >
                    <View style={[styles.fileTypeIcon, { backgroundColor: type.color + '18' }]}>
                      <IconSymbol name={type.icon as any} size={24} color={type.color} />
                    </View>
                    <ThemedText style={[styles.fileTypeName, { color: colors.text }]}>
                      {type.name}
                    </ThemedText>
                    <ThemedText style={[styles.fileTypeDesc, { color: colors.textTertiary }]}>
                      {type.description}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            {selectedType && (
              <Pressable
                style={({ pressed }) => [
                  styles.uploadButton,
                  { backgroundColor: colors.tint, opacity: pressed ? 0.9 : 1 },
                ]}
                onPress={handlePickFile}
              >
                <IconSymbol name="plus.circle.fill" size={20} color="#fff" />
                <ThemedText style={styles.uploadButtonText}>
                  Select {FILE_TYPES.find(t => t.id === selectedType)?.name} File
                </ThemedText>
              </Pressable>
            )}

            {/* Format Guide */}
            <Card style={styles.formatCard} padding="md">
              <View style={styles.formatHeader}>
                <IconSymbol name="info.circle" size={18} color={colors.tint} />
                <ThemedText style={[styles.formatTitle, { color: colors.text }]}>
                  {selectedType === 'pdf' ? 'PDF Parsing' : 'CSV/Excel Format'}
                </ThemedText>
              </View>
              {selectedType === 'pdf' ? (
                <>
                  <ThemedText style={[styles.formatDesc, { color: colors.textSecondary }]}>
                    Our AI analyzes workout PDFs from popular coaches:
                  </ThemedText>
                  <View style={styles.pdfFeatures}>
                    {[
                      'Detects program structure automatically',
                      'Handles multiple program variations',
                      'Extracts supersets, drop sets, RPE',
                      'Matches exercises to our database',
                    ].map((feature, i) => (
                      <View key={i} style={styles.featureRow}>
                        <IconSymbol name="checkmark.circle.fill" size={16} color="#30D158" />
                        <ThemedText style={[styles.featureText, { color: colors.textSecondary }]}>
                          {feature}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <ThemedText style={[styles.formatDesc, { color: colors.textSecondary }]}>
                    Your file should have these columns:
                  </ThemedText>
                  <View style={[styles.codeBlock, { backgroundColor: colors.groupedBackground }]}>
                    <ThemedText style={[styles.codeText, { color: colors.textSecondary }]}>
                      Week, Day, Exercise, Sets, Reps, Weight
                    </ThemedText>
                  </View>
                  <Pressable
                    style={({ pressed }) => [
                      styles.templateButton,
                      { borderColor: colors.tint, opacity: pressed ? 0.8 : 1 },
                    ]}
                    onPress={async () => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const success = await downloadTemplate();
                      if (success) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      }
                    }}
                  >
                    <IconSymbol name="arrow.down.circle" size={18} color={colors.tint} />
                    <ThemedText style={[styles.templateButtonText, { color: colors.tint }]}>
                      Download Template CSV
                    </ThemedText>
                  </Pressable>
                </>
              )}
            </Card>
          </>
        )}

        {/* Step: Configure (CSV/Excel) */}
        {step === 'configure' && selectedFile && (
          <View style={styles.configSection}>
            <Card padding="md">
              <View style={styles.fileCardContent}>
                <View style={[styles.fileIcon, { backgroundColor: '#30D158' + '18' }]}>
                  <IconSymbol name="checkmark.circle.fill" size={24} color="#30D158" />
                </View>
                <View style={styles.fileInfo}>
                  <ThemedText style={[styles.fileLabel, { color: colors.textTertiary }]}>
                    Selected file
                  </ThemedText>
                  <ThemedText style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                    {selectedFile.name}
                  </ThemedText>
                </View>
                <Pressable onPress={resetUpload} hitSlop={12}>
                  <IconSymbol name="xmark.circle.fill" size={22} color={colors.textTertiary} />
                </Pressable>
              </View>
            </Card>

            <Card padding="md">
              <ThemedText style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Program Name
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.separator, backgroundColor: colors.groupedBackground },
                ]}
                value={programName}
                onChangeText={setProgramName}
                placeholder="Enter a name for your program"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="words"
              />
            </Card>

            {error && (
              <View style={[styles.errorCard, { backgroundColor: '#FF3B30' + '18' }]}>
                <IconSymbol name="exclamationmark.triangle.fill" size={18} color="#FF3B30" />
                <ThemedText style={styles.errorText}>{error}</ThemedText>
              </View>
            )}

            <View style={styles.buttonRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: colors.separator, opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={resetUpload}
              >
                <ThemedText style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
                  Cancel
                </ThemedText>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: colors.tint, opacity: pressed ? 0.9 : 1 },
                ]}
                onPress={handleUpload}
              >
                <IconSymbol name="arrow.up.circle" size={18} color="#fff" />
                <ThemedText style={styles.primaryButtonText}>Import</ThemedText>
              </Pressable>
            </View>
          </View>
        )}

        {/* PDF Analysis/Extraction in progress */}
        {(step === 'pdf_analyzing' || step === 'pdf_extracting' || step === 'pdf_matching') && (
          <View style={styles.loadingSection}>
            <View style={[styles.loadingIcon, { backgroundColor: colors.tintMuted }]}>
              <ActivityIndicator size="large" color={colors.tint} />
            </View>
            <ThemedText style={[styles.loadingTitle, { color: colors.text }]}>
              {step === 'pdf_analyzing' && 'Analyzing PDF...'}
              {step === 'pdf_extracting' && 'Extracting Workouts...'}
              {step === 'pdf_matching' && 'Matching Exercises...'}
            </ThemedText>
            {renderProgressBar()}
          </View>
        )}

        {/* PDF Program Selection */}
        {step === 'pdf_select_program' && pdfAnalysis && (
          <View style={styles.programSelectSection}>
            <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              MULTIPLE PROGRAMS DETECTED
            </ThemedText>
            <ThemedText style={[styles.selectPrompt, { color: colors.text }]}>
              This PDF contains multiple program variations. Please select one:
            </ThemedText>

            {/* Page info for long PDFs */}
            {pdfAnalysis.totalPages && pdfAnalysis.totalPages > LONG_PDF_THRESHOLD && (
              <Card padding="sm" style={styles.pageRangeCard}>
                <View style={styles.pageRangeHeader}>
                  <IconSymbol name="doc.text.magnifyingglass" size={18} color={colors.tint} />
                  <ThemedText style={[styles.pageRangeTitle, { color: colors.text }]}>
                    Large PDF ({pdfAnalysis.totalPages} pages)
                  </ThemedText>
                </View>
                <ThemedText style={[styles.pageRangeDesc, { color: colors.textSecondary }]}>
                  Optionally focus on specific pages for faster extraction:
                </ThemedText>
                <View style={styles.pageRangeInputs}>
                  <View style={styles.pageRangeInputGroup}>
                    <ThemedText style={[styles.pageRangeLabel, { color: colors.textTertiary }]}>
                      From
                    </ThemedText>
                    <TextInput
                      style={[
                        styles.pageRangeInput,
                        { color: colors.text, borderColor: colors.separator, backgroundColor: colors.groupedBackground },
                      ]}
                      value={customPageRange.start}
                      onChangeText={(text) => setCustomPageRange(prev => ({ ...prev, start: text }))}
                      placeholder="1"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                  </View>
                  <ThemedText style={[styles.pageRangeSeparator, { color: colors.textTertiary }]}>
                    to
                  </ThemedText>
                  <View style={styles.pageRangeInputGroup}>
                    <ThemedText style={[styles.pageRangeLabel, { color: colors.textTertiary }]}>
                      To
                    </ThemedText>
                    <TextInput
                      style={[
                        styles.pageRangeInput,
                        { color: colors.text, borderColor: colors.separator, backgroundColor: colors.groupedBackground },
                      ]}
                      value={customPageRange.end}
                      onChangeText={(text) => setCustomPageRange(prev => ({ ...prev, end: text }))}
                      placeholder={String(pdfAnalysis.totalPages)}
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                  </View>
                </View>
              </Card>
            )}

            {pdfAnalysis.programOptions.map((option, index) => (
              <Pressable
                key={index}
                style={({ pressed }) => [
                  styles.programOptionCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.separator,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
                onPress={() => handleProgramSelection(option)}
              >
                <View style={styles.programOptionContent}>
                  <ThemedText style={[styles.programOptionName, { color: colors.text }]}>
                    {option.name}
                  </ThemedText>
                  <ThemedText style={[styles.programOptionDesc, { color: colors.textSecondary }]}>
                    {option.description}
                  </ThemedText>
                  {option.daysPerWeek && (
                    <ThemedText style={[styles.programOptionMeta, { color: colors.textTertiary }]}>
                      {option.daysPerWeek} days/week • Pages {option.pageStart}-{option.pageEnd}
                    </ThemedText>
                  )}
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
              </Pressable>
            ))}

            <Pressable style={styles.cancelLink} onPress={resetUpload}>
              <ThemedText style={[styles.cancelLinkText, { color: colors.tint }]}>
                Cancel and choose different file
              </ThemedText>
            </Pressable>
          </View>
        )}

        {/* PDF Review */}
        {step === 'pdf_review' && pdfResult?.selectedProgram && (
          <View style={styles.reviewSection}>
            <Card padding="md">
              <View style={styles.reviewHeader}>
                <View style={[styles.reviewIcon, { backgroundColor: '#30D158' + '18' }]}>
                  <IconSymbol name="checkmark.circle.fill" size={24} color="#30D158" />
                </View>
                <View style={styles.reviewInfo}>
                  <ThemedText style={[styles.reviewTitle, { color: colors.text }]}>
                    Program Extracted
                  </ThemedText>
                  <ThemedText style={[styles.reviewMeta, { color: colors.textSecondary }]}>
                    {pdfResult.selectedProgram.totalWeeks} weeks •{' '}
                    {pdfResult.selectedProgram.daysPerWeek} days/week
                  </ThemedText>
                </View>
              </View>
            </Card>

            <Card padding="md">
              <ThemedText style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Program Name
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.separator, backgroundColor: colors.groupedBackground },
                ]}
                value={programName}
                onChangeText={setProgramName}
                placeholder="Enter a name"
                placeholderTextColor={colors.textTertiary}
              />
            </Card>

            {/* Unmatched exercises warning */}
            {pdfResult.unmatchedExercises && pdfResult.unmatchedExercises.length > 0 && (
              <Card padding="md" style={{ borderColor: '#FF9500' }}>
                <View style={styles.warningHeader}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={18} color="#FF9500" />
                  <ThemedText style={[styles.warningTitle, { color: colors.text }]}>
                    {pdfResult.unmatchedExercises.length} Exercises Need Review
                  </ThemedText>
                </View>
                <ThemedText style={[styles.warningDesc, { color: colors.textSecondary }]}>
                  Some exercises couldn't be matched automatically. They'll be imported as written.
                </ThemedText>
                <View style={styles.unmatchedList}>
                  {pdfResult.unmatchedExercises.slice(0, 5).map((ex, i) => (
                    <ThemedText key={i} style={[styles.unmatchedItem, { color: colors.textSecondary }]}>
                      • {ex.nameRaw}
                    </ThemedText>
                  ))}
                  {pdfResult.unmatchedExercises.length > 5 && (
                    <ThemedText style={[styles.unmatchedMore, { color: colors.textTertiary }]}>
                      +{pdfResult.unmatchedExercises.length - 5} more
                    </ThemedText>
                  )}
                </View>
              </Card>
            )}

            <View style={styles.buttonRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: colors.separator, opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={resetUpload}
              >
                <ThemedText style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
                  Cancel
                </ThemedText>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: colors.tint, opacity: pressed ? 0.9 : 1 },
                ]}
                onPress={handleSavePDFProgram}
              >
                <IconSymbol name="checkmark.circle" size={18} color="#fff" />
                <ThemedText style={styles.primaryButtonText}>Save Program</ThemedText>
              </Pressable>
            </View>
          </View>
        )}

        {/* Uploading */}
        {step === 'uploading' && (
          <View style={styles.loadingSection}>
            <ActivityIndicator size="large" color={colors.tint} />
            <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
              Saving program...
            </ThemedText>
          </View>
        )}

        {/* Success */}
        {step === 'success' && (
          <View style={styles.successSection}>
            <View style={[styles.successIcon, { backgroundColor: '#30D158' + '18' }]}>
              <IconSymbol name="checkmark.circle.fill" size={48} color="#30D158" />
            </View>
            <ThemedText style={[styles.successTitle, { color: colors.text }]}>
              Import Successful!
            </ThemedText>
            <ThemedText style={[styles.successSubtitle, { color: colors.textSecondary }]}>
              Redirecting to My Programs...
            </ThemedText>
          </View>
        )}

        {/* Error */}
        {step === 'error' && (
          <View style={styles.errorSection}>
            <View style={[styles.errorIcon, { backgroundColor: '#FF3B30' + '18' }]}>
              <IconSymbol name="xmark.circle.fill" size={48} color="#FF3B30" />
            </View>
            <ThemedText style={[styles.errorTitle, { color: colors.text }]}>
              Import Failed
            </ThemedText>
            <ThemedText style={[styles.errorDescription, { color: colors.textSecondary }]}>
              {error || 'An unexpected error occurred'}
            </ThemedText>
            <Pressable
              style={({ pressed }) => [
                styles.retryButton,
                { backgroundColor: colors.tint, opacity: pressed ? 0.9 : 1 },
              ]}
              onPress={resetUpload}
            >
              <ThemedText style={styles.retryButtonText}>Try Again</ThemedText>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: 120,
  },
  hero: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  heroTitle: {
    ...Typography.title2,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  heroSubtitle: {
    ...Typography.body,
    textAlign: 'center',
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.caption1,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  fileTypeGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  fileTypeCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 2,
    gap: Spacing.xs,
  },
  fileTypeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  fileTypeName: {
    ...Typography.headline,
  },
  fileTypeDesc: {
    ...Typography.caption2,
    textAlign: 'center',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: Radius.lg,
    marginBottom: Spacing.lg,
  },
  uploadButtonText: {
    ...Typography.headline,
    color: '#fff',
  },
  formatCard: {
    gap: Spacing.sm,
  },
  formatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  formatTitle: {
    ...Typography.subhead,
    fontWeight: '600',
  },
  formatDesc: {
    ...Typography.footnote,
  },
  pdfFeatures: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    ...Typography.footnote,
  },
  codeBlock: {
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  codeText: {
    ...Typography.caption1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  templateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  templateButtonText: {
    ...Typography.subhead,
    fontWeight: '600',
  },
  configSection: {
    gap: Spacing.md,
  },
  fileCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  fileIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    flex: 1,
    gap: 2,
  },
  fileLabel: {
    ...Typography.caption2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fileName: {
    ...Typography.headline,
  },
  inputLabel: {
    ...Typography.footnote,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  input: {
    ...Typography.body,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  errorText: {
    ...Typography.footnote,
    color: '#FF3B30',
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryButtonText: {
    ...Typography.headline,
  },
  primaryButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.md,
  },
  primaryButtonText: {
    ...Typography.headline,
    color: '#fff',
  },
  loadingSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  loadingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTitle: {
    ...Typography.title3,
    fontWeight: '600',
  },
  loadingText: {
    ...Typography.body,
  },
  progressContainer: {
    width: '100%',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    ...Typography.caption1,
    textAlign: 'center',
  },
  programSelectSection: {
    gap: Spacing.md,
  },
  selectPrompt: {
    ...Typography.body,
    marginBottom: Spacing.sm,
  },
  programOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  programOptionContent: {
    flex: 1,
    gap: 4,
  },
  programOptionName: {
    ...Typography.headline,
  },
  programOptionDesc: {
    ...Typography.footnote,
  },
  programOptionMeta: {
    ...Typography.caption2,
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  cancelLinkText: {
    ...Typography.body,
  },
  pageRangeCard: {
    marginBottom: Spacing.sm,
  },
  pageRangeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.xs,
  },
  pageRangeTitle: {
    ...Typography.subhead,
    fontWeight: '600',
  },
  pageRangeDesc: {
    ...Typography.footnote,
    marginBottom: Spacing.sm,
  },
  pageRangeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  pageRangeInputGroup: {
    flex: 1,
    gap: 4,
  },
  pageRangeLabel: {
    ...Typography.caption2,
    textTransform: 'uppercase',
  },
  pageRangeInput: {
    ...Typography.body,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    textAlign: 'center',
  },
  pageRangeSeparator: {
    ...Typography.footnote,
    marginTop: 16,
  },
  reviewSection: {
    gap: Spacing.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  reviewIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewInfo: {
    flex: 1,
    gap: 2,
  },
  reviewTitle: {
    ...Typography.headline,
  },
  reviewMeta: {
    ...Typography.footnote,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.xs,
  },
  warningTitle: {
    ...Typography.subhead,
    fontWeight: '600',
  },
  warningDesc: {
    ...Typography.footnote,
    marginBottom: Spacing.sm,
  },
  unmatchedList: {
    gap: 4,
  },
  unmatchedItem: {
    ...Typography.footnote,
  },
  unmatchedMore: {
    ...Typography.caption2,
    marginTop: 4,
  },
  successSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    ...Typography.title3,
    fontWeight: '600',
  },
  successSubtitle: {
    ...Typography.body,
  },
  errorSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    ...Typography.title3,
    fontWeight: '600',
  },
  errorDescription: {
    ...Typography.body,
    textAlign: 'center',
    maxWidth: 280,
  },
  retryButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  retryButtonText: {
    ...Typography.headline,
    color: '#fff',
  },
});
