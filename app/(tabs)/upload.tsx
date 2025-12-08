import { useState } from 'react';
import { StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { prisma } from '@/lib/db/client';
import { parseCSV } from '@/lib/services/parser/csv';
import { router } from 'expo-router';

export default function UploadScreen() {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [programName, setProgramName] = useState('');
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  async function handlePickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        setSelectedFile(file.name);
        setProgramName(file.name.replace('.csv', ''));
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Error', 'Failed to pick file');
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      Alert.alert('No File', 'Please select a file first');
      return;
    }

    setUploading(true);

    try {
      // Read file content
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv'],
      });

      if (result.canceled || !result.assets || !result.assets[0]) {
        return;
      }

      const fileUri = result.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(fileUri);

      // Parse CSV
      const parsed = await parseCSV(content);

      // Create program
      const program = await prisma.program.create({
        data: {
          userId: 'demo-user', // In real app, use actual user ID
          name: programName || 'Untitled Program',
          description: `${parsed.workouts.length} workouts`,
          sourceFileUri: fileUri,
          sourceType: 'CSV',
          status: 'PARSING',
          parsedData: JSON.stringify(parsed),
        },
      });

      Alert.alert('Success!', 'Program uploaded successfully', [
        {
          text: 'OK',
          onPress: () => {
            setSelectedFile(null);
            setProgramName('');
            router.push('/(tabs)');
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error uploading:', error);
      Alert.alert('Error', error.message || 'Failed to upload program');
    } finally {
      setUploading(false);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedView style={styles.header}>
          <ThemedText type="title">Upload Program</ThemedText>
          <ThemedText style={styles.subtitle}>
            Upload a CSV file containing your workout program
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            CSV Format
          </ThemedText>
          <ThemedText style={styles.helpText}>
            Your CSV should include: Week, Day, Exercise, Sets, Reps, Weight
          </ThemedText>
        </ThemedView>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.tint }]}
          onPress={handlePickFile}
        >
          <ThemedText style={styles.buttonText}>
            {selectedFile ? 'Change File' : 'Select CSV File'}
          </ThemedText>
        </TouchableOpacity>

        {selectedFile && (
          <ThemedView style={[styles.fileInfo, { backgroundColor: colors.tint + '20' }]}>
            <ThemedText style={styles.fileName}>{selectedFile}</ThemedText>
          </ThemedView>
        )}

        {selectedFile && (
          <TouchableOpacity
            style={[
              styles.uploadButton,
              { backgroundColor: '#4CAF50' },
              uploading && styles.buttonDisabled,
            ]}
            onPress={handleUpload}
            disabled={uploading}
          >
            <ThemedText style={styles.buttonText}>
              {uploading ? 'Uploading...' : 'Upload & Parse'}
            </ThemedText>
          </TouchableOpacity>
        )}

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Example CSV Format
          </ThemedText>
          <ThemedView style={[styles.codeBlock, { backgroundColor: colors.text + '10' }]}>
            <ThemedText style={styles.code}>
              Week,Day,Exercise,Sets,Reps,Weight{'\n'}
              1,1,Bench Press,4,8-10,135 lbs{'\n'}
              1,1,Squat,4,10,225 lbs{'\n'}
              1,2,Deadlift,3,5,315 lbs
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 50,
  },
  header: {
    marginBottom: 24,
  },
  subtitle: {
    opacity: 0.6,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
    gap: 8,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  helpText: {
    opacity: 0.7,
    fontSize: 14,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fileInfo: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  fileName: {
    fontWeight: '500',
  },
  codeBlock: {
    padding: 16,
    borderRadius: 8,
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
});
