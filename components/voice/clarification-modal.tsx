/**
 * Clarification Modal
 *
 * Bottom sheet modal for disambiguating voice commands.
 * Appears when multiple exercises match a voice input.
 */

import { useCallback } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ClarificationRequest, ClarificationOption } from '@/lib/services/voice/types';

// Extended option type with UFIRE data
interface UFIREClarificationOption extends ClarificationOption {
  ufireScore?: number;
  breakdown?: {
    semantic: number;
    frequency: number;
    popularity: number;
    contextual: number;
  };
}

/**
 * Get color for UFIRE score bar based on confidence level
 */
function getScoreColor(score: number, tintColor: string): string {
  if (score >= 0.7) return '#22C55E'; // Green - high confidence
  if (score >= 0.5) return tintColor; // Tint - medium confidence
  if (score >= 0.3) return '#F59E0B'; // Orange - low-medium
  return '#EF4444'; // Red - low confidence
}

interface ClarificationModalProps {
  visible: boolean;
  request: ClarificationRequest | null;
  onSelect: (optionId: string) => void;
  onDismiss: () => void;
}

export function ClarificationModal({
  visible,
  request,
  onSelect,
  onDismiss,
}: ClarificationModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleSelect = useCallback(
    (option: ClarificationOption) => {
      Haptics.selectionAsync();
      onSelect(option.id);
    },
    [onSelect]
  );

  if (!visible || !request) return null;

  const getIcon = () => {
    switch (request.type) {
      case 'equipment_variant':
        return 'dumbbell.fill';
      case 'exercise_variant':
        return 'arrow.triangle.branch';
      case 'superset_confirm':
        return 'link';
      default:
        return 'questionmark.circle';
    }
  };

  const getTitle = () => {
    switch (request.type) {
      case 'equipment_variant':
        return 'Choose Equipment';
      case 'exercise_variant':
        return 'Choose Variation';
      case 'superset_confirm':
        return 'Confirm Superset';
      default:
        return 'Did you mean...';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        style={styles.backdrop}
      >
        <Pressable style={styles.backdropTouchable} onPress={onDismiss} />

        <Animated.View
          entering={SlideInUp.duration(200)}
          style={[styles.container, { backgroundColor: colors.card }]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: colors.tint + '20' }]}>
              <IconSymbol name={getIcon() as any} size={24} color={colors.tint} />
            </View>
            <View style={styles.headerText}>
              <ThemedText style={styles.title}>{getTitle()}</ThemedText>
              <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
                {request.question}
              </ThemedText>
            </View>
            <Pressable onPress={onDismiss} style={styles.closeButton}>
              <IconSymbol name="xmark" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Context */}
          {request.context?.originalTranscript && (
            <View style={[styles.contextBox, { backgroundColor: colors.background }]}>
              <IconSymbol name="waveform" size={14} color={colors.textTertiary} />
              <ThemedText style={[styles.contextText, { color: colors.textSecondary }]}>
                "{request.context.originalTranscript}"
              </ThemedText>
            </View>
          )}

          {/* Options */}
          <ScrollView
            style={styles.optionsContainer}
            showsVerticalScrollIndicator={false}
          >
            {request.options.map((option, index) => {
              const ufireOption = option as UFIREClarificationOption;
              const ufireScore = ufireOption.ufireScore;
              const hasUfireScore = typeof ufireScore === 'number';
              const scorePercentage = hasUfireScore ? Math.round(ufireScore * 100) : 0;

              return (
                <Pressable
                  key={option.id}
                  onPress={() => handleSelect(option)}
                  style={({ pressed }) => [
                    styles.optionCard,
                    {
                      backgroundColor: pressed
                        ? colors.tint + '10'
                        : colors.background,
                      borderColor: option.isDefault ? colors.tint : colors.separator,
                      borderWidth: option.isDefault ? 2 : 1,
                    },
                  ]}
                >
                  <View style={styles.optionContent}>
                    <View style={styles.optionHeader}>
                      <ThemedText style={styles.optionLabel}>{option.label}</ThemedText>
                      {option.isDefault && (
                        <View style={[styles.recommendedBadge, { backgroundColor: colors.tint }]}>
                          <ThemedText style={styles.recommendedText}>Best Match</ThemedText>
                        </View>
                      )}
                    </View>
                    {option.description && (
                      <ThemedText
                        style={[styles.optionDescription, { color: colors.textSecondary }]}
                      >
                        {option.description}
                      </ThemedText>
                    )}
                    {/* UFIRE Score Indicator */}
                    {hasUfireScore && ufireScore !== undefined && (
                      <View style={styles.scoreContainer}>
                        <View style={[styles.scoreBar, { backgroundColor: colors.separator }]}>
                          <View
                            style={[
                              styles.scoreBarFill,
                              {
                                width: `${scorePercentage}%`,
                                backgroundColor: getScoreColor(ufireScore, colors.tint),
                              },
                            ]}
                          />
                        </View>
                        <ThemedText style={[styles.scoreText, { color: colors.textTertiary }]}>
                          {scorePercentage}%
                        </ThemedText>
                      </View>
                    )}
                    {/* UFIRE Breakdown Pills */}
                    {ufireOption.breakdown && (
                      <View style={styles.breakdownContainer}>
                        {ufireOption.breakdown.frequency > 0.3 && (
                          <View style={[styles.breakdownPill, { backgroundColor: colors.success + '20' }]}>
                            <ThemedText style={[styles.breakdownPillText, { color: colors.success }]}>
                              Done often
                            </ThemedText>
                          </View>
                        )}
                        {ufireOption.breakdown.contextual > 0.6 && (
                          <View style={[styles.breakdownPill, { backgroundColor: colors.tint + '20' }]}>
                            <ThemedText style={[styles.breakdownPillText, { color: colors.tint }]}>
                              Fits workout
                            </ThemedText>
                          </View>
                        )}
                        {ufireOption.breakdown.popularity > 0.7 && (
                          <View style={[styles.breakdownPill, { backgroundColor: colors.warning + '20' }]}>
                            <ThemedText style={[styles.breakdownPillText, { color: colors.warning }]}>
                              Popular
                            </ThemedText>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                  <IconSymbol
                    name="chevron.right"
                    size={16}
                    color={colors.textTertiary}
                  />
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Footer hint */}
          <View style={styles.footer}>
            <ThemedText style={[styles.footerText, { color: colors.textTertiary }]}>
              Tap an option or swipe down to dismiss
            </ThemedText>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  backdropTouchable: {
    flex: 1,
  },
  container: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '70%',
    paddingBottom: 34, // Safe area
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  contextBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  contextText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  optionsContainer: {
    paddingHorizontal: Spacing.md,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    marginBottom: Spacing.sm,
  },
  optionContent: {
    flex: 1,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  recommendedBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  recommendedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  optionDescription: {
    fontSize: 13,
    marginTop: 4,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  scoreBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: '600',
    minWidth: 32,
    textAlign: 'right',
  },
  breakdownContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  breakdownPill: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  breakdownPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  footerText: {
    fontSize: 12,
  },
});
