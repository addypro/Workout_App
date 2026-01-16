/**
 * Screener Wizard Component
 *
 * 3-question wizard for challenge recommendation when Ghost Scan
 * doesn't have enough data to make a confident recommendation.
 */

import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInRight, SlideOutLeft } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ChallengeRecommendation } from '@/lib/services/challenges';
import { getWizardRecommendation, type EquipmentAccess, type FitnessGoal, type WizardAnswers } from '@/lib/services/recommendations';

// ============================================
// TYPES
// ============================================

interface ScreenerWizardProps {
    onComplete: (recommendation: ChallengeRecommendation) => void;
    onCancel: () => void;
}

interface QuestionOption<T> {
    value: T;
    label: string;
    icon: string;
    description?: string;
}

// ============================================
// QUESTIONS CONFIG
// ============================================

const QUESTIONS = {
    goal: {
        title: "What's your main goal?",
        options: [
            { value: 'look_good' as FitnessGoal, label: 'Look Good', icon: 'person.fill', description: 'Build muscle, lose fat' },
            { value: 'be_strong' as FitnessGoal, label: 'Be Strong', icon: 'dumbbell.fill', description: 'Lift heavy, get powerful' },
            { value: 'move_fast' as FitnessGoal, label: 'Move Fast', icon: 'figure.run', description: 'Build endurance' },
        ],
    },
    fitness: {
        title: 'Can you do 10 push-ups?',
        options: [
            { value: true, label: 'Yes', icon: 'checkmark.circle.fill', description: 'No problem' },
            { value: false, label: 'Not yet', icon: 'xmark.circle.fill', description: 'Working on it' },
        ],
    },
    equipment: {
        title: 'What equipment do you have?',
        options: [
            { value: 'full_gym' as EquipmentAccess, label: 'Full Gym', icon: 'building.2.fill', description: 'All the equipment' },
            { value: 'home' as EquipmentAccess, label: 'Home Setup', icon: 'house.fill', description: 'Dumbbells, bands, etc.' },
            { value: 'bodyweight' as EquipmentAccess, label: 'Bodyweight Only', icon: 'figure.stand', description: 'Just me' },
        ],
    },
};

// ============================================
// COMPONENT
// ============================================

export function ScreenerWizard({ onComplete, onCancel }: ScreenerWizardProps) {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState<Partial<WizardAnswers>>({});

    const handleSelect = <T extends FitnessGoal | boolean | EquipmentAccess>(
        key: keyof WizardAnswers,
        value: T
    ) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const newAnswers = { ...answers, [key]: value };
        setAnswers(newAnswers);

        // Move to next step or complete
        if (step < 2) {
            setTimeout(() => setStep(step + 1), 300);
        } else {
            // All questions answered - get recommendation
            const fullAnswers: WizardAnswers = {
                goal: newAnswers.goal as FitnessGoal,
                canDo10Pushups: newAnswers.canDo10Pushups as boolean,
                equipment: newAnswers.equipment as EquipmentAccess,
            };
            const recommendation = getWizardRecommendation(fullAnswers);
            onComplete(recommendation);
        }
    };

    const handleBack = () => {
        if (step > 0) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setStep(step - 1);
        } else {
            onCancel();
        }
    };

    const renderQuestion = () => {
        switch (step) {
            case 0:
                return (
                    <QuestionStep
                        title={QUESTIONS.goal.title}
                        options={QUESTIONS.goal.options}
                        onSelect={(value) => handleSelect('goal', value)}
                        colors={colors}
                    />
                );
            case 1:
                return (
                    <QuestionStep
                        title={QUESTIONS.fitness.title}
                        options={QUESTIONS.fitness.options}
                        onSelect={(value) => handleSelect('canDo10Pushups', value)}
                        colors={colors}
                    />
                );
            case 2:
                return (
                    <QuestionStep
                        title={QUESTIONS.equipment.title}
                        options={QUESTIONS.equipment.options}
                        onSelect={(value) => handleSelect('equipment', value)}
                        colors={colors}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={handleBack} style={styles.backButton}>
                    <IconSymbol name="chevron.left" size={20} color={colors.tint} />
                    <ThemedText style={[styles.backText, { color: colors.tint }]}>
                        {step === 0 ? 'Cancel' : 'Back'}
                    </ThemedText>
                </Pressable>

                {/* Progress */}
                <View style={styles.progressContainer}>
                    {[0, 1, 2].map((i) => (
                        <View
                            key={i}
                            style={[
                                styles.progressDot,
                                {
                                    backgroundColor: i <= step ? colors.tint : colors.tintMuted,
                                },
                            ]}
                        />
                    ))}
                </View>
            </View>

            {/* Question */}
            <Animated.View
                key={step}
                entering={SlideInRight.duration(300)}
                exiting={SlideOutLeft.duration(200)}
                style={styles.questionContainer}
            >
                {renderQuestion()}
            </Animated.View>
        </View>
    );
}

// ============================================
// QUESTION STEP COMPONENT
// ============================================

interface QuestionStepProps<T> {
    title: string;
    options: QuestionOption<T>[];
    onSelect: (value: T) => void;
    colors: typeof Colors.light;
}

function QuestionStep<T>({ title, options, onSelect, colors }: QuestionStepProps<T>) {
    return (
        <View style={styles.questionContent}>
            <ThemedText style={styles.questionTitle}>{title}</ThemedText>

            <View style={styles.optionsContainer}>
                {options.map((option, index) => (
                    <Animated.View
                        key={String(option.value)}
                        entering={FadeIn.delay(100 * index).duration(300)}
                    >
                        <Pressable
                            style={({ pressed }) => [
                                styles.optionCard,
                                {
                                    backgroundColor: colors.groupedBackground,
                                    transform: [{ scale: pressed ? 0.98 : 1 }],
                                },
                            ]}
                            onPress={() => onSelect(option.value)}
                        >
                            <View style={[styles.optionIcon, { backgroundColor: colors.tint + '20' }]}>
                                <IconSymbol name={option.icon as any} size={24} color={colors.tint} />
                            </View>
                            <View style={styles.optionText}>
                                <ThemedText style={styles.optionLabel}>{option.label}</ThemedText>
                                {option.description && (
                                    <ThemedText style={[styles.optionDescription, { color: colors.textSecondary }]}>
                                        {option.description}
                                    </ThemedText>
                                )}
                            </View>
                            <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
                        </Pressable>
                    </Animated.View>
                ))}
            </View>
        </View>
    );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: Spacing.lg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Spacing.lg,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    backText: {
        fontSize: 16,
        fontWeight: '500',
    },
    progressContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    progressDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    questionContainer: {
        flex: 1,
        paddingTop: Spacing.xl,
    },
    questionContent: {
        gap: Spacing.xl,
    },
    questionTitle: {
        fontSize: 28,
        fontWeight: '700',
        textAlign: 'center',
    },
    optionsContainer: {
        gap: Spacing.md,
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.lg,
        borderRadius: Radius.lg,
        gap: Spacing.md,
    },
    optionIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionText: {
        flex: 1,
    },
    optionLabel: {
        fontSize: 17,
        fontWeight: '600',
    },
    optionDescription: {
        fontSize: 14,
        marginTop: 2,
    },
});
