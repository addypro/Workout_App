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

interface PlateConfig {
  weight: number;
  count: number;
  color: string;
}

const STANDARD_PLATES = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25, 0.5],
  lbs: [45, 35, 25, 10, 5, 2.5],
};

const getPlateColor = (weight: number, unit: 'kg' | 'lbs'): string => {
  if (unit === 'kg') {
    switch (weight) {
      case 25: return '#FF0000'; // Red
      case 20: return '#0000FF'; // Blue
      case 15: return '#FFFF00'; // Yellow
      case 10: return '#00FF00'; // Green
      case 5: return '#FFFFFF';  // White
      case 2.5: return '#FF0000'; // Red (small)
      case 1.25: return '#888888'; // Gray
      case 0.5: return '#888888'; // Gray
      default: return '#888888';
    }
  } else {
    switch (weight) {
      case 45: return '#FF0000'; // Red
      case 35: return '#FFFF00'; // Yellow
      case 25: return '#00FF00'; // Green
      case 10: return '#FFFFFF'; // White
      case 5: return '#888888';  // Gray
      case 2.5: return '#888888'; // Gray
      default: return '#888888';
    }
  }
};

export function PlateCalculator() {
  const [visible, setVisible] = useState(false);
  const [targetWeight, setTargetWeight] = useState('');
  const [unit, setUnit] = useState<'kg' | 'lbs'>('lbs');
  const [barWeight, setBarWeight] = useState(45); // Standard barbell
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const calculatePlates = (): PlateConfig[] => {
    const weight = parseFloat(targetWeight);
    if (isNaN(weight) || weight <= barWeight) return [];

    // Weight to load on each side
    const sideWeight = (weight - barWeight) / 2;
    const plates = STANDARD_PLATES[unit];
    const result: PlateConfig[] = [];

    let remaining = sideWeight;

    for (const plateWeight of plates) {
      if (remaining >= plateWeight) {
        const count = Math.floor(remaining / plateWeight);
        result.push({
          weight: plateWeight,
          count,
          color: getPlateColor(plateWeight, unit),
        });
        remaining -= count * plateWeight;
      }
    }

    return result;
  };

  const plates = calculatePlates();
  const totalLoaded = plates.reduce((sum, p) => sum + p.weight * p.count, 0) * 2 + barWeight;
  const difference = parseFloat(targetWeight) - totalLoaded;

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, { backgroundColor: colors.tint }]}
        onPress={() => setVisible(true)}
      >
        <IconSymbol name="scalemass" size={20} color="#fff" />
        <ThemedText style={styles.triggerText}>Plate Calculator</ThemedText>
      </TouchableOpacity>

      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setVisible(false)}
      >
        <ThemedView style={styles.container}>
          <ThemedView style={styles.header}>
            <ThemedText type="title">Plate Calculator</ThemedText>
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
                <ThemedText
                  style={[
                    styles.unitText,
                    unit === 'kg' && { color: '#fff' },
                  ]}
                >
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
                <ThemedText
                  style={[
                    styles.unitText,
                    unit === 'lbs' && { color: '#fff' },
                  ]}
                >
                  LBS
                </ThemedText>
              </TouchableOpacity>
            </ThemedView>

            {/* Bar Weight */}
            <ThemedView style={styles.section}>
              <ThemedText style={styles.label}>Barbell Weight</ThemedText>
              <ThemedView style={styles.barOptions}>
                {[20, 35, 45].map(weight => (
                  <TouchableOpacity
                    key={weight}
                    style={[
                      styles.barOption,
                      barWeight === weight && { backgroundColor: colors.tint },
                      { borderColor: colors.text + '30' },
                    ]}
                    onPress={() => setBarWeight(weight)}
                  >
                    <ThemedText
                      style={[
                        styles.barOptionText,
                        barWeight === weight && { color: '#fff' },
                      ]}
                    >
                      {weight} {unit}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ThemedView>
            </ThemedView>

            {/* Target Weight Input */}
            <ThemedView style={styles.section}>
              <ThemedText style={styles.label}>Target Weight</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.text + '30',
                    color: colors.text,
                  },
                ]}
                value={targetWeight}
                onChangeText={setTargetWeight}
                keyboardType="decimal-pad"
                placeholder={`e.g., 225 ${unit}`}
                placeholderTextColor={colors.text + '60'}
              />
            </ThemedView>

            {/* Results */}
            {plates.length > 0 && (
              <>
                <ThemedView style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>
                    Plates Per Side
                  </ThemedText>
                  <ThemedView style={styles.platesList}>
                    {plates.map((plate, index) => (
                      <ThemedView key={index} style={styles.plateRow}>
                        <ThemedView style={styles.plateInfo}>
                          <View
                            style={[
                              styles.plateColor,
                              { backgroundColor: plate.color, borderColor: colors.text + '30' },
                            ]}
                          />
                          <ThemedText style={styles.plateWeight}>
                            {plate.weight} {unit}
                          </ThemedText>
                        </ThemedView>
                        <ThemedText style={styles.plateCount}>
                          × {plate.count}
                        </ThemedText>
                      </ThemedView>
                    ))}
                  </ThemedView>
                </ThemedView>

                {/* Visual Bar */}
                <ThemedView style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>
                    Bar Loading Order
                  </ThemedText>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <ThemedView style={styles.barVisual}>
                      {/* Left side plates */}
                      {plates.map((plate, index) =>
                        Array.from({ length: plate.count }).map((_, i) => (
                          <View
                            key={`left-${index}-${i}`}
                            style={[
                              styles.visualPlate,
                              {
                                backgroundColor: plate.color,
                                width: plate.weight >= 25 ? 40 : plate.weight >= 10 ? 30 : 20,
                                height: plate.weight >= 25 ? 80 : plate.weight >= 10 ? 60 : 40,
                                borderColor: colors.text + '30',
                              },
                            ]}
                          />
                        ))
                      )}

                      {/* Barbell */}
                      <View style={[styles.barbell, { backgroundColor: colors.text }]} />

                      {/* Right side plates (reversed) */}
                      {[...plates].reverse().map((plate, index) =>
                        Array.from({ length: plate.count }).map((_, i) => (
                          <View
                            key={`right-${index}-${i}`}
                            style={[
                              styles.visualPlate,
                              {
                                backgroundColor: plate.color,
                                width: plate.weight >= 25 ? 40 : plate.weight >= 10 ? 30 : 20,
                                height: plate.weight >= 25 ? 80 : plate.weight >= 10 ? 60 : 40,
                                borderColor: colors.text + '30',
                              },
                            ]}
                          />
                        ))
                      )}
                    </ThemedView>
                  </ScrollView>
                </ThemedView>

                {/* Summary */}
                <ThemedView style={[styles.summary, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}>
                  <ThemedView style={styles.summaryRow}>
                    <ThemedText style={styles.summaryLabel}>Total Weight:</ThemedText>
                    <ThemedText style={styles.summaryValue}>
                      {totalLoaded.toFixed(1)} {unit}
                    </ThemedText>
                  </ThemedView>
                  {Math.abs(difference) > 0.1 && (
                    <ThemedView style={styles.summaryRow}>
                      <ThemedText style={[styles.summaryLabel, { color: '#FF9800' }]}>
                        Difference:
                      </ThemedText>
                      <ThemedText style={[styles.summaryValue, { color: '#FF9800' }]}>
                        {difference > 0 ? '-' : '+'}{Math.abs(difference).toFixed(1)} {unit}
                      </ThemedText>
                    </ThemedView>
                  )}
                </ThemedView>
              </>
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
  barOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  barOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  barOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 18,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  platesList: {
    gap: 12,
  },
  plateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  plateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  plateColor: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
  },
  plateWeight: {
    fontSize: 16,
    fontWeight: '600',
  },
  plateCount: {
    fontSize: 16,
    fontWeight: '700',
  },
  barVisual: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 20,
  },
  visualPlate: {
    borderRadius: 4,
    borderWidth: 2,
  },
  barbell: {
    width: 80,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 8,
  },
  summary: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    marginBottom: 40,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
  },
});
