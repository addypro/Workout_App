/**
 * Gym Busyness Prompt
 * 
 * A minimal one-tap component that appears on the workout summary screen.
 * Only shows if user has a home gym set.
 * Designed to be dismissible and non-intrusive.
 */

import { supabase } from '@/lib/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface GymBusynessPromptProps {
    gymId: string;
    gymName: string;
    colors: {
        text: string;
        textSecondary: string;
        card: string;
        success?: string;
        [key: string]: string | undefined;
    };
    onDismiss?: () => void;
}

type BusynessLevel = 1 | 2 | 3;

const BUSYNESS_OPTIONS: { level: BusynessLevel; icon: string; label: string; color: string }[] = [
    { level: 1, icon: 'person-outline', label: 'Empty', color: '#4CAF50' },
    { level: 2, icon: 'people-outline', label: 'Moderate', color: '#FF9800' },
    { level: 3, icon: 'people', label: 'Packed', color: '#F44336' },
];

export function GymBusynessPrompt({ gymId, gymName, colors, onDismiss }: GymBusynessPromptProps) {
    const [submitted, setSubmitted] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    const handleSubmit = useCallback(async (busyness: BusynessLevel) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSubmitted(true);

        const now = new Date();

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await supabase.from('gym_busyness_reports').insert({
                gym_id: gymId,
                user_id: user.id,
                busyness,
                day_of_week: now.getDay(),
                hour_of_day: now.getHours(),
            });

            console.log('[Busyness] Reported:', busyness, 'for', gymName);
        } catch (error) {
            console.error('[Busyness] Failed to submit:', error);
        }

        // Auto-dismiss after brief feedback
        setTimeout(() => {
            onDismiss?.();
        }, 1500);
    }, [gymId, gymName, onDismiss]);

    const handleDismiss = useCallback(() => {
        setDismissed(true);
        onDismiss?.();
    }, [onDismiss]);

    if (dismissed) return null;

    if (submitted) {
        return (
            <View style={[styles.container, { backgroundColor: colors.card }]}>
                <Ionicons name="checkmark-circle" size={24} color={colors.success || '#4CAF50'} />
                <Text style={[styles.thankYou, { color: colors.text }]}>Thanks!</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.card }]}>
            <View style={styles.header}>
                <Text style={[styles.question, { color: colors.text }]}>
                    How busy was {gymName.length > 20 ? gymName.slice(0, 20) + '...' : gymName}?
                </Text>
                <Pressable onPress={handleDismiss} hitSlop={12}>
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                </Pressable>
            </View>

            <View style={styles.options}>
                {BUSYNESS_OPTIONS.map((option) => (
                    <Pressable
                        key={option.level}
                        style={[styles.option, { borderColor: option.color }]}
                        onPress={() => handleSubmit(option.level)}
                    >
                        <Ionicons name={option.icon as any} size={24} color={option.color} />
                        <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 12,
        padding: 16,
        marginVertical: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    question: {
        fontSize: 15,
        fontWeight: '500',
        flex: 1,
    },
    options: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    option: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1.5,
        gap: 4,
    },
    optionLabel: {
        fontSize: 12,
        fontWeight: '500',
    },
    thankYou: {
        fontSize: 15,
        fontWeight: '500',
        marginLeft: 8,
    },
});
