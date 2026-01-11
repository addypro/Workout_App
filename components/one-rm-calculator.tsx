import { useState } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Standard 1RM formulas
const calculateOneRM = (weight: number, reps: number): Record<string, number> => {
  return {
    brzycki: weight * (36 / (37 - reps)),
    epley: weight * (1 + reps / 30),
    lander: (100 * weight) / (101.3 - 2.67123 * reps),
    lombardi: weight * Math.pow(reps, 0.10),
    mayhew: (100 * weight) / (52.2 + 41.9 * Math.exp(-0.055 * reps)),
    oconner: weight * (1 + reps / 40),
    wathan: (100 * weight) / (48.8 + 53.8 * Math.exp(-0.075 * reps)),
  };
};

const getAverage = (values: Record<string, number>): number => {
  const sum = Object.values(values).reduce((a, b) => a + b, 0);
  return sum / Object.values(values).length;
};

// Generate percentage-based training weights
const generateTrainingWeights = (oneRM: number) => {
  const percentages = [95, 90, 85, 80, 75, 70, 65, 60, 55, 50];
  return percentages.map(pct => ({
    percentage: pct,
    weight: (oneRM * pct) / 100,
  }));
};

export function OneRMCalculator() {
  const [visible, setVisible] = useState(false);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [unit, setUnit] = useState<'kg' | 'lbs'>('lbs');
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const weightNum = parseFloat(weight);
  const repsNum = parseInt(reps);

  const isValid = !isNaN(weightNum) && !isNaN(repsNum) && repsNum >= 1 && repsNum <= 15;

  const oneRMs = isValid ? calculateOneRM(weightNum, repsNum) : null;
  const avgOneRM = oneRMs ? getAverage(oneRMs) : 0;
  const trainingWeights = avgOneRM > 0 ? generateTrainingWeights(avgOneRM) : [];

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, { backgroundColor: colors.tint }]}
        onPress={() => setVisible(true)}
      >
        <IconSymbol name="chart.bar.fill" size={20} color="#fff" />
        <ThemedText style={styles.triggerText}>1RM Calculator</ThemedText>
      </TouchableOpacity>

      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setVisible(false)}
      >
        <ThemedView style={styles.container}>
          <ThemedView style={styles.header}>
            <ThemedText type="title">1RM Calculator</ThemedText>
            <TouchableOpacity onPress={() => setVisible(false)}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.text} />
            </TouchableOpacity>
          </ThemedView>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Unit Toggle */}
            <ThemedView style={styles.unitToggle}>
              <TouchableOpacity
                style={[
                  styles.unitButton,
                  unit === 'kg' && { backgroundColor: colors.tint },
                  { borderColor: colors.text + '30' },
                ]}
                onPress={() => setUnit('kg')}
              >
                <ThemedText style={[styles.unitText, unit === 'kg' && { color: '#fff' }]}>
                  KG
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.unitButton,
                  unit === 'lbs' && { backgroundColor: colors.tint },
                  { borderColor: colors.text + '30' },
                ]}
                onPress={() => setUnit('lbs')}
              >
                <ThemedText style={[styles.unitText, unit === 'lbs' && { color: '#fff' }]}>
                  LBS
                </ThemedText>
              </TouchableOpacity>
            </ThemedView>

            {/* Inputs */}
            <ThemedView style={styles.section}>
              <ThemedText style={styles.label}>Weight Lifted</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.text + '30',
                    color: colors.text,
                  },
                ]}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholder={`e.g., 225 ${unit}`}
                placeholderTextColor={colors.text + '60'}
              />
            </ThemedView>

            <ThemedView style={styles.section}>
              <ThemedText style={styles.label}>Reps Completed</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.text + '30',
                    color: colors.text,
                  },
                ]}
                value={reps}
                onChangeText={setReps}
                keyboardType="number-pad"
                placeholder="e.g., 5"
                placeholderTextColor={colors.text + '60'}
              />
            </ThemedView>

            {/* Results */}
            {isValid && oneRMs && (
              <>
                {/* 1RM Estimate */}
                <ThemedView style={[styles.resultCard, { backgroundColor: colors.tint + '20', borderColor: colors.tint }]}>
                  <ThemedText style={styles.resultLabel}>Estimated 1 Rep Max</ThemedText>
                  <ThemedText style={[styles.resultValue, { color: colors.tint }]}>
                    {avgOneRM.toFixed(1)} {unit}
                  </ThemedText>
                  <ThemedText style={styles.resultSubtext}>
                    Average of 7 formulas
                  </ThemedText>
                </ThemedView>

                {/* Formula Breakdown */}
                <ThemedView style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Formula Breakdown</ThemedText>
                  <ThemedView style={styles.formulaList}>
                    {Object.entries(oneRMs).map(([name, value]) => (
                      <ThemedView key={name} style={styles.formulaRow}>
                        <ThemedText style={styles.formulaName}>
                          {name.charAt(0).toUpperCase() + name.slice(1)}
                        </ThemedText>
                        <ThemedText style={styles.formulaValue}>
                          {value.toFixed(1)} {unit}
                        </ThemedText>
                      </ThemedView>
                    ))}
                  </ThemedView>
                </ThemedView>

                {/* Training Percentages */}
                <ThemedView style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Training Weights</ThemedText>
                  <ThemedText style={styles.sectionSubtext}>
                    Based on your estimated 1RM
                  </ThemedText>
                  <ThemedView style={styles.percentageList}>
                    {trainingWeights.map(({ percentage, weight: trainingWeight }) => (
                      <ThemedView
                        key={percentage}
                        style={[
                          styles.percentageRow,
                          { backgroundColor: colors.background, borderColor: colors.text + '20' },
                        ]}
                      >
                        <ThemedView style={styles.percentageInfo}>
                          <ThemedText style={styles.percentageValue}>
                            {percentage}%
                          </ThemedText>
                          <ThemedText style={styles.percentageDescription}>
                            {percentage >= 90
                              ? 'Max Strength'
                              : percentage >= 85
                              ? 'Power'
                              : percentage >= 70
                              ? 'Strength'
                              : percentage >= 60
                              ? 'Hypertrophy'
                              : 'Endurance'}
                          </ThemedText>
                        </ThemedView>
                        <ThemedText style={styles.percentageWeight}>
                          {trainingWeight.toFixed(1)} {unit}
                        </ThemedText>
                      </ThemedView>
                    ))}
                  </ThemedView>
                </ThemedView>

                {/* Notes */}
                <ThemedView style={[styles.noteCard, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}>
                  <ThemedText style={styles.noteTitle}>Pro Tips</ThemedText>
                  <ThemedText style={styles.noteText}>
                    • Most accurate between 3-10 reps{'\n'}
                    • Formulas may overestimate for high reps (&gt;10){'\n'}
                    • Use as a guide, not absolute truth{'\n'}
                    • Rest 3-5 minutes before true 1RM attempts
                  </ThemedText>
                </ThemedView>
              </>
            )}

            {!isValid && (weight || reps) && (
              <ThemedView style={[styles.noteCard, { backgroundColor: '#FF9800' + '20', borderColor: '#FF9800' }]}>
                <ThemedText style={[styles.noteText, { color: '#FF9800' }]}>
                  Enter weight and reps (1-15) to calculate your 1RM
                </ThemedText>
              </ThemedView>
            )}
          </ScrollView>
        </ThemedView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  triggerText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  unitToggle: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  unitButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  unitText: {
    fontSize: 16,
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    opacity: 0.7,
  },
  input: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 18,
    fontWeight: '600',
  },
  resultCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    marginBottom: 24,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.7,
    marginBottom: 8,
  },
  resultValue: {
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 4,
  },
  resultSubtext: {
    fontSize: 12,
    opacity: 0.6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionSubtext: {
    fontSize: 13,
    opacity: 0.6,
    marginBottom: 16,
  },
  formulaList: {
    gap: 12,
  },
  formulaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  formulaName: {
    fontSize: 15,
    fontWeight: '500',
    opacity: 0.8,
  },
  formulaValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  percentageList: {
    gap: 8,
  },
  percentageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  percentageInfo: {
    gap: 4,
  },
  percentageValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  percentageDescription: {
    fontSize: 12,
    opacity: 0.6,
  },
  percentageWeight: {
    fontSize: 18,
    fontWeight: '700',
  },
  noteCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 40,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
});
