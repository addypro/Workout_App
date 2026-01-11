/**
 * Set Types Guide
 *
 * Educational component for explaining set types to users.
 * Shows on first workout, with subtle access for future reference.
 */
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInUp, withTiming, Easing } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Shadows, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { SetType } from '@/lib/types/workout-session';

const ONBOARDING_KEY = '@set_types_onboarding_seen';

// Full set type information
export const SET_TYPE_INFO: Record<SetType, {
  label: string;
  shortLabel: string;
  description: string;
  example: string;
  color: string;
}> = {
  warmup: {
    label: 'Warmup',
    shortLabel: 'Warm',
    description: 'Light sets to prepare your muscles and joints. No need to track intensity.',
    example: 'e.g., 2 sets of 12 reps at 50% weight',
    color: '#8E8E93',
  },
  working: {
    label: 'Working Set',
    shortLabel: 'Work',
    description: 'Your standard training sets. These build the foundation of your workout.',
    example: 'e.g., 3 sets of 10 reps at moderate effort',
    color: '#5AC8FA',
  },
  top: {
    label: 'Heavy Top Set',
    shortLabel: 'Top',
    description: 'Your heaviest, most challenging sets. Target RPE 9-10 for maximum strength gains.',
    example: 'e.g., 1 set of 5 reps at near-max weight',
    color: '#FF9500',
  },
  drop: {
    label: 'Drop Set',
    shortLabel: 'Drop',
    description: 'Immediately follow a set by reducing weight and continuing reps. Great for extra volume.',
    example: 'e.g., Drop 20-30% weight, rep to near failure',
    color: '#AF52DE',
  },
  failure: {
    label: 'To Failure',
    shortLabel: 'Fail',
    description: 'Push until you cannot complete another rep with good form. Use sparingly for intensity.',
    example: 'e.g., Final set taken to complete muscular failure',
    color: '#FF3B30',
  },
};

interface SetTypesGuideProps {
  visible: boolean;
  onClose: () => void;
  highlightType?: SetType;
}

export function SetTypesGuide({ visible, onClose, highlightType }: SetTypesGuideProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          entering={SlideInUp.duration(200)}
          style={[styles.container, { backgroundColor: colors.card, ...Shadows.lg }]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <ThemedText style={[styles.title, { color: colors.text }]}>
                  Set Types Explained
                </ThemedText>
                <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
                  Tap any set badge to change its type
                </ThemedText>
              </View>
              <Pressable style={styles.closeButton} onPress={onClose}>
                <IconSymbol name="xmark" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* Set Types List */}
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {(Object.keys(SET_TYPE_INFO) as SetType[]).map((type) => {
                const info = SET_TYPE_INFO[type];
                const isHighlighted = highlightType === type;

                return (
                  <View
                    key={type}
                    style={[
                      styles.typeCard,
                      {
                        backgroundColor: info.color + '12',
                        borderColor: isHighlighted ? info.color : 'transparent',
                        borderWidth: isHighlighted ? 2 : 0,
                      },
                    ]}
                  >
                    <View style={styles.typeHeader}>
                      <View style={[styles.typeBadge, { backgroundColor: info.color + '30', borderColor: info.color }]}>
                        <ThemedText style={[styles.typeBadgeText, { color: info.color }]}>
                          {info.shortLabel}
                        </ThemedText>
                      </View>
                      <ThemedText style={[styles.typeLabel, { color: colors.text }]}>
                        {info.label}
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.typeDescription, { color: colors.textSecondary }]}>
                      {info.description}
                    </ThemedText>
                    <ThemedText style={[styles.typeExample, { color: colors.textTertiary }]}>
                      {info.example}
                    </ThemedText>
                  </View>
                );
              })}
            </ScrollView>

            {/* Got It Button */}
            <Pressable
              style={[styles.gotItButton, { backgroundColor: colors.tint }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onClose();
              }}
            >
              <ThemedText style={styles.gotItText}>Got it!</ThemedText>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// Hook to manage onboarding state
export function useSetTypesOnboarding() {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
      setHasSeenOnboarding(seen === 'true');
    } catch {
      setHasSeenOnboarding(true); // Default to seen on error
    }
  };

  const markOnboardingSeen = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      setHasSeenOnboarding(true);
    } catch {
      // Silently fail
    }
  };

  const triggerOnboarding = useCallback(() => {
    if (hasSeenOnboarding === false) {
      setShowGuide(true);
    }
  }, [hasSeenOnboarding]);

  const openGuide = useCallback(() => {
    setShowGuide(true);
  }, []);

  const closeGuide = useCallback(() => {
    setShowGuide(false);
    if (!hasSeenOnboarding) {
      markOnboardingSeen();
    }
  }, [hasSeenOnboarding]);

  return {
    hasSeenOnboarding,
    showGuide,
    triggerOnboarding,
    openGuide,
    closeGuide,
  };
}

// Compact info button for header
interface SetTypesInfoButtonProps {
  onPress: () => void;
}

export function SetTypesInfoButton({ onPress }: SetTypesInfoButtonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Pressable
      style={[styles.infoButton, { backgroundColor: colors.tintMuted }]}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
    >
      <IconSymbol name="questionmark.circle" size={14} color={colors.tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: Radius.xl,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    maxHeight: 400,
  },
  typeCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  typeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  typeLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  typeDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  typeExample: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  gotItButton: {
    marginTop: Spacing.md,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  gotItText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
