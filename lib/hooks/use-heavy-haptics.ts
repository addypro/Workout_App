/**
 * useHeavyHaptics - Schwarzenegger Haptics Hook
 * 
 * ASTEROID PROOF: Psychophysical haptics that simulate weight.
 * The phone "gets heavier" as the weight value increases.
 * 
 * Usage:
 * const triggerWeightHaptic = useHeavyHaptics();
 * triggerWeightHaptic(currentWeight); // Call on slider tick
 */

import * as Haptics from 'expo-haptics';
import { useCallback, useRef } from 'react';

// Weight thresholds for different haptic intensities
const WEIGHT_THRESHOLDS = {
    LIGHT: 20,      // < 20kg = no haptics (gliding)
    MEDIUM: 60,     // 20-60kg = Selection haptics
    HEAVY: 100,     // 60-100kg = Impact.Medium
    // > 100kg = Impact.Heavy
};

// Minimum weight change before triggering haptic (prevents spam)
const TICK_INTERVALS = {
    LIGHT: 5,       // Every 5kg for light weights
    MEDIUM: 2.5,    // Every 2.5kg for medium weights
    HEAVY: 1,       // Every 1kg for heavy weights (max feedback)
};

export type WeightHapticCallback = (weight: number) => void;

/**
 * Hook that returns a callback to trigger weight-based haptics.
 * Call this on every slider tick/change.
 */
export function useHeavyHaptics(): WeightHapticCallback {
    const lastTickRef = useRef<number>(0);

    const triggerWeightHaptic = useCallback((weight: number) => {
        // Determine tick interval based on weight
        let tickInterval: number;
        let hapticStyle: Haptics.ImpactFeedbackStyle | 'selection' | 'none';

        if (weight < WEIGHT_THRESHOLDS.LIGHT) {
            // Ultra-light: No haptics (silky smooth)
            hapticStyle = 'none';
            tickInterval = TICK_INTERVALS.LIGHT;
        } else if (weight < WEIGHT_THRESHOLDS.MEDIUM) {
            // Light: Selection haptic every 5kg
            hapticStyle = 'selection';
            tickInterval = TICK_INTERVALS.LIGHT;
        } else if (weight < WEIGHT_THRESHOLDS.HEAVY) {
            // Medium: Impact.Medium every 2.5kg
            hapticStyle = Haptics.ImpactFeedbackStyle.Medium;
            tickInterval = TICK_INTERVALS.MEDIUM;
        } else {
            // Heavy (100kg+): Impact.Heavy every 1kg (THE SCHWARZENEGGER)
            hapticStyle = Haptics.ImpactFeedbackStyle.Heavy;
            tickInterval = TICK_INTERVALS.HEAVY;
        }

        // Check if we've crossed a tick threshold
        const currentTick = Math.floor(weight / tickInterval);
        const lastTick = Math.floor(lastTickRef.current / tickInterval);

        if (currentTick !== lastTick) {
            // Trigger haptic
            if (hapticStyle === 'selection') {
                Haptics.selectionAsync();
            } else if (hapticStyle !== 'none') {
                Haptics.impactAsync(hapticStyle);
            }
        }

        lastTickRef.current = weight;
    }, []);

    return triggerWeightHaptic;
}

export default useHeavyHaptics;
