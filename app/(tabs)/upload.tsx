import { Screen } from '@/components/screen';
import { SwipeTabs } from '@/components/swipe-tabs';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getProgramByName, saveProgram } from '@/lib/db/storage';
import { extractorService } from '@/lib/services/parser/extractor-service';
import { downloadExcelTemplate, downloadTemplate } from '@/lib/utils/csv-export';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

// Helper to read file content cross-platform
async function readFileContent(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    // On web, fetch the blob URI and read as text
    const response = await fetch(uri);
    return await response.text();
  } else {
    // On native, use expo-file-system
    const FileSystem = require('expo-file-system');
    return await FileSystem.readAsStringAsync(uri);
  }
}

type Step = 'select' | 'configure' | 'uploading';

export default function UploadScreen() {
  const [step, setStep] = useState<Step>('select');
  const [selectedFile, setSelectedFile] = useState<{ name: string; uri: string; mimeType?: string } | null>(null);
  const [programName, setProgramName] = useState('');
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  async function handlePickFile() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        setSelectedFile({ name: file.name, uri: file.uri, mimeType: file.mimeType });
        setProgramName(file.name.replace(/\.(csv|pdf|png|jpg|jpeg)$/i, ''));
        setStep('configure');
      }
    } catch (error) {
      console.error('Error picking file:', error);
      showAlert('Error', 'Failed to pick file');
    }
  }

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  async function handleUpload() {
    if (!selectedFile) return;

    setStep('uploading');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      let content = undefined;
      const fileType = selectedFile.name.toLowerCase().endsWith('.csv') ? 'csv' :
        selectedFile.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image';

      if (fileType === 'csv') {
        content = await readFileContent(selectedFile.uri);
      }

      const result = await extractorService.extract(selectedFile.uri, fileType, content);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to extract program data');
      }

      const parsed = result.data;
      const name = programName || 'Untitled Program';

      const existing = await getProgramByName(name);

      const doSave = async () => {
        await saveProgram({
          userId: 'demo-user',
          name,
          description: `${parsed.workouts.length} workout${parsed.workouts.length !== 1 ? 's' : ''}`,
          sourceFileUri: selectedFile.uri,
          sourceType: 'CSV',
          status: 'READY',
          parsedData: JSON.stringify(parsed),
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSelectedFile(null);
        setProgramName('');
        setStep('select');

        parsed.name = name; // Ensure user-provided name is passed
        router.push({
          pathname: '/program/import-review',
          params: { data: JSON.stringify(parsed) }
        });
      };

      if (existing) {
        if (Platform.OS === 'web') {
          if (window.confirm(`"${name}" already exists. Add another copy?`)) {
            await doSave();
          } else {
            setStep('configure');
          }
        } else {
          Alert.alert(
            'Program Exists',
            `"${name}" is already in My Programs. Add another copy?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => setStep('configure') },
              { text: 'Add Anyway', onPress: doSave },
            ]
          );
        }
      } else {
        await doSave();
      }
    } catch (error: any) {
      console.error('Error uploading:', error);
      setStep('configure');
      showAlert('Error', error.message || 'Failed to upload program');
    }
  }

  const resetUpload = () => {
    setSelectedFile(null);
    setProgramName('');
    setStep('select');
  };

  return (
    <SwipeTabs current="upload">
      <Screen contentStyle={styles.screenContent}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

          {/* Step Indicator */}
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, { backgroundColor: colors.tint }]} />
            <View style={[styles.stepLine, { backgroundColor: step !== 'select' ? colors.tint : colors.separator }]} />
            <View style={[styles.stepDot, { backgroundColor: step !== 'select' ? colors.tint : colors.separator }]} />
            <View style={[styles.stepLine, { backgroundColor: step === 'uploading' ? colors.tint : colors.separator }]} />
            <View style={[styles.stepDot, { backgroundColor: step === 'uploading' ? colors.tint : colors.separator }]} />
          </View>

          {/* Select File Step */}
          {step === 'select' && (
            <View style={styles.stepContent}>
              <View style={[styles.heroIcon, { backgroundColor: colors.tintMuted }]}>
                <IconSymbol name="arrow.up.circle" size={48} color={colors.tint} />
              </View>
              <ThemedText style={[styles.heroTitle, { color: colors.text }]}>
                Upload a Program
              </ThemedText>
              <ThemedText style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
                Import from CSV, Excel, PDF, or Image
              </ThemedText>

              <Pressable
                style={({ pressed }) => [
                  styles.uploadButton,
                  { backgroundColor: colors.tint, transform: [{ scale: pressed ? 0.98 : 1 }] },
                ]}
                onPress={handlePickFile}
              >
                <IconSymbol name="plus.circle.fill" size={20} color="#fff" />
                <ThemedText style={styles.uploadButtonText}>Select File</ThemedText>
              </Pressable>

              {/* Format Guide */}
              <View style={[styles.formatCard, { backgroundColor: colors.card, borderColor: colors.separator }, Shadows.sm]}>
                <View style={styles.formatHeader}>
                  <IconSymbol name="list.bullet" size={16} color={colors.textSecondary} />
                  <ThemedText style={[styles.formatTitle, { color: colors.text }]}>CSV Format</ThemedText>
                </View>
                <ThemedText style={[styles.formatDesc, { color: colors.textSecondary }]}>
                  Include these columns in your file:
                </ThemedText>
                <View style={[styles.codeBlock, { backgroundColor: colors.groupedBackground }]}>
                  <ThemedText style={[styles.codeText, { color: colors.textSecondary }]}>
                    Week, Day, Exercise, Sets, Reps, Weight
                  </ThemedText>
                </View>
                <View style={styles.formatExample}>
                  <ThemedText style={[styles.exampleLabel, { color: colors.textTertiary }]}>Example row:</ThemedText>
                  <ThemedText style={[styles.exampleText, { color: colors.textSecondary }]}>
                    1, 1, Bench Press, 4, 8-10, 135 lbs
                  </ThemedText>
                </View>

                {/* Download Template Buttons */}
                <ThemedText style={[styles.templateLabel, { color: colors.textTertiary }]}>
                  DOWNLOAD TEMPLATE
                </ThemedText>
                <View style={styles.templateButtonRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.templateButton,
                      styles.templateButtonHalf,
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
                      CSV
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.templateButton,
                      styles.templateButtonHalf,
                      { borderColor: '#217346', opacity: pressed ? 0.8 : 1 },
                    ]}
                    onPress={async () => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const success = await downloadExcelTemplate();
                      if (success) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      }
                    }}
                  >
                    <IconSymbol name="square.and.arrow.down" size={18} color="#217346" />
                    <ThemedText style={[styles.templateButtonText, { color: '#217346' }]}>
                      Excel
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* Configure Step */}
          {step === 'configure' && selectedFile && (
            <View style={styles.stepContent}>
              <View style={[styles.fileCard, { backgroundColor: colors.card, borderColor: colors.separator }, Shadows.sm]}>
                <View style={[styles.fileIcon, { backgroundColor: '#30D158' + '18' }]}>
                  <IconSymbol name="checkmark.circle.fill" size={24} color="#30D158" />
                </View>
                <View style={styles.fileInfo}>
                  <ThemedText style={[styles.fileLabel, { color: colors.textTertiary }]}>Selected file</ThemedText>
                  <ThemedText style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                    {selectedFile.name}
                  </ThemedText>
                </View>
                <Pressable onPress={resetUpload} hitSlop={12}>
                  <IconSymbol name="xmark.circle.fill" size={22} color={colors.textTertiary} />
                </Pressable>
              </View>

              <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.separator }, Shadows.sm]}>
                <ThemedText style={[styles.inputLabel, { color: colors.textSecondary }]}>Program Name</ThemedText>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.separator }]}
                  value={programName}
                  onChangeText={setProgramName}
                  placeholder="Enter a name for your program"
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.buttonRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    { borderColor: colors.separator, opacity: pressed ? 0.8 : 1 },
                  ]}
                  onPress={resetUpload}
                >
                  <ThemedText style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>Cancel</ThemedText>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: colors.tint, transform: [{ scale: pressed ? 0.98 : 1 }] },
                  ]}
                  onPress={handleUpload}
                >
                  <IconSymbol name="arrow.up.circle" size={18} color="#fff" />
                  <ThemedText style={styles.primaryButtonText}>Upload</ThemedText>
                </Pressable>
              </View>
            </View>
          )}

          {/* Uploading Step */}
          {step === 'uploading' && (
            <View style={styles.stepContent}>
              <View style={[styles.heroIcon, { backgroundColor: colors.tintMuted }]}>
                <ActivityIndicator size="large" color={colors.tint} />
              </View>
              <ThemedText style={[styles.heroTitle, { color: colors.text }]}>
                Uploading...
              </ThemedText>
              <ThemedText style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
                Parsing your workout program
              </ThemedText>
            </View>
          )}
        </ScrollView>
      </Screen>
    </SwipeTabs>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: 0,
  },
  // ... rest of styles
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: 120,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stepLine: {
    width: 40,
    height: 2,
  },
  stepContent: {
    alignItems: 'center',
    gap: Spacing.lg,
  },
  heroIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    ...Typography.title2,
    textAlign: 'center',
  },
  heroSubtitle: {
    ...Typography.body,
    textAlign: 'center',
    marginTop: -8,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: Radius.lg,
    marginTop: Spacing.sm,
  },
  uploadButtonText: {
    ...Typography.headline,
    color: '#fff',
  },
  formatCard: {
    width: '100%',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
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
  codeBlock: {
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  codeText: {
    ...Typography.caption1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  formatExample: {
    gap: 2,
  },
  exampleLabel: {
    ...Typography.caption2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exampleText: {
    ...Typography.caption1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fileCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
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
  inputCard: {
    width: '100%',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  inputLabel: {
    ...Typography.footnote,
    fontWeight: '600',
  },
  input: {
    ...Typography.body,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  buttonRow: {
    width: '100%',
    flexDirection: 'row',
    gap: Spacing.sm,
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
  templateLabel: {
    ...Typography.caption2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
    marginTop: Spacing.sm,
    marginBottom: -4,
  },
  templateButtonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
  },
  templateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  templateButtonHalf: {
    flex: 1,
  },
  templateButtonText: {
    ...Typography.subhead,
    fontWeight: '600',
  },
});
