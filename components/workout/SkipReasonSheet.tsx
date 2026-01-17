import { ThemedText } from '@/components/themed-text';
import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

type SkipReasonCode = 'unwell' | 'alternative' | 'no_time' | 'gym_closed' | 'other';

const REASONS: Array<{
  code: SkipReasonCode;
  label: string;
  icon: IconSymbolName;
}> = [
    { code: 'unwell', label: 'Feeling unwell', icon: 'cross.case.fill' },
    { code: 'alternative', label: 'Did alternative training', icon: 'figure.run' },
    { code: 'no_time', label: 'No time today', icon: 'clock.fill' },
    { code: 'gym_closed', label: 'Gym closed/unavailable', icon: 'lock.fill' },
    { code: 'other', label: 'Other', icon: 'pencil' },
  ];

interface SkipReasonSheetProps {
  visible: boolean;
  onSkip: (code: SkipReasonCode, text?: string) => void;
  onCancel: () => void;
}

export function SkipReasonSheet({ visible, onSkip, onCancel }: SkipReasonSheetProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [selected, setSelected] = useState<SkipReasonCode | null>(null);
  const [otherText, setOtherText] = useState('');

  useEffect(() => {
    if (!visible) {
      setSelected(null);
      setOtherText('');
    }
  }, [visible]);

  const isOther = selected === 'other';
  const canConfirm = !!selected && (!isOther || otherText.trim().length > 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheet, { backgroundColor: colors.card }]}>
              <ThemedText style={[styles.title, { color: colors.text }]}>
                Skip workout
              </ThemedText>
              <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
                Why are you skipping this session?
              </ThemedText>

              <View style={styles.reasonList}>
                {REASONS.map((reason) => {
                  const isSelected = selected === reason.code;
                  return (
                    <Pressable
                      key={reason.code}
                      style={[
                        styles.reasonRow,
                        {
                          backgroundColor: isSelected ? colors.tint + '15' : colors.groupedBackground,
                          borderColor: isSelected ? colors.tint : colors.separator,
                        },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelected(reason.code);
                      }}
                    >
                      <View style={[styles.reasonIcon, { backgroundColor: colors.tint + '1A' }]}>
                        <IconSymbol name={reason.icon} size={16} color={colors.tint} />
                      </View>
                      <ThemedText style={[styles.reasonText, { color: colors.text }]}>
                        {reason.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              {isOther && (
                <TextInput
                  style={[
                    styles.otherInput,
                    { borderColor: colors.separator, color: colors.text, backgroundColor: colors.groupedBackground },
                  ]}
                  placeholder="Tell us more"
                  placeholderTextColor={colors.textTertiary}
                  value={otherText}
                  onChangeText={setOtherText}
                  multiline
                />
              )}

              <View style={styles.actions}>
                <Pressable
                  style={[styles.actionButton, { borderColor: colors.separator }]}
                  onPress={onCancel}
                >
                  <ThemedText style={[styles.actionText, { color: colors.textSecondary }]}>
                    Cancel
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[
                    styles.actionButton,
                    styles.primaryButton,
                    { backgroundColor: colors.tint, opacity: canConfirm ? 1 : 0.5 },
                  ]}
                  onPress={() => {
                    if (!selected) return;
                    onSkip(selected, isOther ? otherText.trim() : undefined);
                  }}
                  disabled={!canConfirm}
                >
                  <ThemedText style={styles.primaryActionText}>Confirm</ThemedText>
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    padding: Spacing.lg,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: Spacing.md,
  },
  reasonList: {
    gap: Spacing.sm,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  reasonIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  otherInput: {
    marginTop: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionButton: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  primaryButton: {
    borderWidth: 0,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
