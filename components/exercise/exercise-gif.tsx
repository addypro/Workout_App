/**
 * ExerciseGif Component
 * 
 * Displays animated GIF thumbnail from ExerciseDB with loading/error states.
 * Uses static cache for zero API calls.
 */

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { memo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

interface ExerciseGifProps {
    /** Exercise name from taxonomy */
    exerciseName: string;
    /** Direct GIF URL (if already have it) */
    gifUrl?: string;
    /** Size of the GIF thumbnail */
    size?: 'small' | 'medium' | 'large';
    /** Show loading skeleton */
    showLoading?: boolean;
}

const SIZES = {
    small: 40,
    medium: 56,
    large: 80,
};

function ExerciseGifComponent({
    exerciseName,
    gifUrl,
    size = 'medium',
    showLoading = true,
}: ExerciseGifProps) {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    const dimension = SIZES[size];

    // No URL provided - show fallback
    if (!gifUrl) {
        return (
            <View style={[
                styles.container,
                styles.fallback,
                {
                    width: dimension,
                    height: dimension,
                    backgroundColor: colors.tintMuted,
                },
            ]}>
                <IconSymbol
                    name="figure.strengthtraining.traditional"
                    size={dimension * 0.5}
                    color={colors.tint}
                />
            </View>
        );
    }

    // Error loading GIF - show fallback
    if (hasError) {
        return (
            <View style={[
                styles.container,
                styles.fallback,
                {
                    width: dimension,
                    height: dimension,
                    backgroundColor: colors.tintMuted,
                },
            ]}>
                <IconSymbol
                    name="dumbbell"
                    size={dimension * 0.4}
                    color={colors.textTertiary}
                />
            </View>
        );
    }

    return (
        <View style={[
            styles.container,
            {
                width: dimension,
                height: dimension,
                backgroundColor: colors.card,
            },
        ]}>
            {/* Loading indicator */}
            {isLoading && showLoading && (
                <View style={[styles.loadingOverlay, { backgroundColor: colors.card }]}>
                    <ActivityIndicator size="small" color={colors.tint} />
                </View>
            )}

            {/* GIF Image */}
            <Image
                source={{ uri: gifUrl }}
                style={[styles.gif, { width: dimension, height: dimension }]}
                resizeMode="cover"
                onLoadStart={() => setIsLoading(true)}
                onLoadEnd={() => setIsLoading(false)}
                onError={() => {
                    setHasError(true);
                    setIsLoading(false);
                }}
            />
        </View>
    );
}

export const ExerciseGif = memo(ExerciseGifComponent);

const styles = StyleSheet.create({
    container: {
        borderRadius: Radius.md,
        overflow: 'hidden',
        position: 'relative',
    },
    fallback: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
    gif: {
        borderRadius: Radius.md,
    },
});
