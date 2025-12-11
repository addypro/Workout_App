import { StyleSheet, ScrollView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { PlateCalculator } from '@/components/plate-calculator';
import { OneRMCalculator } from '@/components/one-rm-calculator';

export default function ToolsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <ThemedView style={styles.header}>
          <ThemedText type="title">Workout Tools</ThemedText>
          <ThemedText style={styles.subtitle}>
            Essential calculators for your training
          </ThemedText>
        </ThemedView>

        {/* Calculators Section */}
        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Calculators</ThemedText>
          <ThemedView style={styles.toolsGrid}>
            <PlateCalculator />
            <OneRMCalculator />
          </ThemedView>
        </ThemedView>

        {/* Quick Reference */}
        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Quick Reference</ThemedText>

          <ThemedView style={[styles.card, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}>
            <ThemedText style={styles.cardTitle}>💪 Rep Ranges</ThemedText>
            <ThemedView style={styles.refList}>
              <RefItem label="Strength" value="1-5 reps" />
              <RefItem label="Power" value="3-5 reps" />
              <RefItem label="Hypertrophy" value="6-12 reps" />
              <RefItem label="Endurance" value="12-20+ reps" />
            </ThemedView>
          </ThemedView>

          <ThemedView style={[styles.card, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}>
            <ThemedText style={styles.cardTitle}>⏱️ Rest Times</ThemedText>
            <ThemedView style={styles.refList}>
              <RefItem label="Strength (Heavy)" value="3-5 minutes" />
              <RefItem label="Hypertrophy" value="60-90 seconds" />
              <RefItem label="Endurance" value="30-60 seconds" />
              <RefItem label="Circuit Training" value="Minimal" />
            </ThemedView>
          </ThemedView>

          <ThemedView style={[styles.card, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}>
            <ThemedText style={styles.cardTitle}>📊 Training Intensity</ThemedText>
            <ThemedView style={styles.refList}>
              <RefItem label="90-100% 1RM" value="Max Strength" />
              <RefItem label="85-90% 1RM" value="Power" />
              <RefItem label="70-85% 1RM" value="Strength" />
              <RefItem label="60-70% 1RM" value="Hypertrophy" />
              <RefItem label="50-60% 1RM" value="Endurance" />
            </ThemedView>
          </ThemedView>

          <ThemedView style={[styles.card, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}>
            <ThemedText style={styles.cardTitle}>🎯 RPE Scale</ThemedText>
            <ThemedView style={styles.refList}>
              <RefItem label="RPE 10" value="Max effort, no reps left" />
              <RefItem label="RPE 9" value="1 rep left in tank" />
              <RefItem label="RPE 8" value="2 reps left" />
              <RefItem label="RPE 7" value="3 reps left" />
              <RefItem label="RPE 6" value="4+ reps left" />
            </ThemedView>
          </ThemedView>
        </ThemedView>

        {/* Pro Tips */}
        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>💡 Pro Tips</ThemedText>
          <ThemedView style={[styles.tipCard, { backgroundColor: colors.tint + '10', borderColor: colors.tint + '30' }]}>
            <ThemedText style={styles.tipText}>
              • Progressive overload is key - aim to increase weight, reps, or volume each session{'\n'}
              • Track your workouts to identify patterns and plateaus{'\n'}
              • Deload every 4-6 weeks to prevent burnout{'\n'}
              • Sleep and nutrition matter as much as training{'\n'}
              • Form &gt; Ego - perfect technique prevents injury
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

function RefItem({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView style={styles.refItem}>
      <ThemedText style={styles.refLabel}>{label}</ThemedText>
      <ThemedText style={styles.refValue}>{value}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
    paddingTop: 50,
  },
  subtitle: {
    opacity: 0.6,
    marginTop: 4,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  toolsGrid: {
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  refList: {
    gap: 8,
  },
  refItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  refLabel: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.8,
  },
  refValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  tipCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.9,
  },
});
