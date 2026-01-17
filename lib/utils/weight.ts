/**
 * Weight Unit Branded Types and Conversion
 *
 * Type-safe weight handling with branded types to prevent unit mixing.
 * Uses exhaustive switch to ensure all conversions are handled.
 */

// ============================================
// BRANDED TYPES
// ============================================

declare const __brand: unique symbol;
type Brand<K extends string, T> = T & { readonly [__brand]: K };

/** Weight in pounds - branded for type safety */
export type WeightLbs = Brand<'WeightLbs', number>;

/** Weight in kilograms - branded for type safety */
export type WeightKg = Brand<'WeightKg', number>;

/** Weight unit discriminator */
export type WeightUnit = 'lbs' | 'kg';

/** Tagged weight value with unit */
export type Weight =
    | { unit: 'lbs'; value: WeightLbs }
    | { unit: 'kg'; value: WeightKg };

// ============================================
// CONVERSION CONSTANTS
// ============================================

const LBS_TO_KG = 0.453592;
const KG_TO_LBS = 2.20462;

// ============================================
// SMART CONSTRUCTORS
// ============================================

/**
 * Create a WeightLbs from a number
 */
export function lbs(value: number): WeightLbs {
    if (value < 0) {
        throw new Error(`Weight cannot be negative: ${value}`);
    }
    return value as WeightLbs;
}

/**
 * Create a WeightKg from a number
 */
export function kg(value: number): WeightKg {
    if (value < 0) {
        throw new Error(`Weight cannot be negative: ${value}`);
    }
    return value as WeightKg;
}

/**
 * Create a Weight from value and unit
 */
export function weight(value: number, unit: WeightUnit): Weight {
    switch (unit) {
        case 'lbs':
            return { unit: 'lbs', value: lbs(value) };
        case 'kg':
            return { unit: 'kg', value: kg(value) };
        default:
            // Exhaustive check
            const _exhaustive: never = unit;
            throw new Error(`Unknown unit: ${_exhaustive}`);
    }
}

// ============================================
// CONVERSIONS
// ============================================

/**
 * Convert pounds to kilograms
 */
export function toLbs(weight: WeightKg): WeightLbs {
    return (weight * KG_TO_LBS) as WeightLbs;
}

/**
 * Convert kilograms to pounds
 */
export function toKg(weight: WeightLbs): WeightKg {
    return (weight * LBS_TO_KG) as WeightKg;
}

/**
 * Convert any Weight to pounds
 */
export function toWeightLbs(w: Weight): WeightLbs {
    switch (w.unit) {
        case 'lbs':
            return w.value;
        case 'kg':
            return toLbs(w.value);
        default:
            const _exhaustive: never = w;
            throw new Error(`Unknown weight unit: ${_exhaustive}`);
    }
}

/**
 * Convert any Weight to kilograms
 */
export function toWeightKg(w: Weight): WeightKg {
    switch (w.unit) {
        case 'kg':
            return w.value;
        case 'lbs':
            return toKg(w.value);
        default:
            const _exhaustive: never = w;
            throw new Error(`Unknown weight unit: ${_exhaustive}`);
    }
}

/**
 * Convert to target unit
 */
export function convertTo(w: Weight, targetUnit: WeightUnit): Weight {
    switch (targetUnit) {
        case 'lbs':
            return { unit: 'lbs', value: toWeightLbs(w) };
        case 'kg':
            return { unit: 'kg', value: toWeightKg(w) };
        default:
            const _exhaustive: never = targetUnit;
            throw new Error(`Unknown target unit: ${_exhaustive}`);
    }
}

// ============================================
// FORMATTING
// ============================================

/**
 * Format weight for display
 */
export function formatWeight(w: Weight, decimals: number = 1): string {
    const value = w.unit === 'lbs' ? w.value : w.value;
    return `${value.toFixed(decimals)} ${w.unit}`;
}

/**
 * Format weight in user's preferred unit
 */
export function formatInPreferredUnit(
    w: Weight,
    preferredUnit: WeightUnit,
    decimals: number = 1
): string {
    const converted = convertTo(w, preferredUnit);
    return formatWeight(converted, decimals);
}

// ============================================
// ROUNDING UTILITIES
// ============================================

/**
 * Round to nearest plate increment (2.5 lbs / 1.25 kg)
 */
export function roundToPlate(w: Weight): Weight {
    switch (w.unit) {
        case 'lbs':
            // Round to nearest 2.5 lbs
            const lbsRounded = Math.round(w.value / 2.5) * 2.5;
            return { unit: 'lbs', value: lbs(lbsRounded) };
        case 'kg':
            // Round to nearest 1.25 kg
            const kgRounded = Math.round(w.value / 1.25) * 1.25;
            return { unit: 'kg', value: kg(kgRounded) };
        default:
            const _exhaustive: never = w;
            throw new Error(`Unknown unit: ${_exhaustive}`);
    }
}

// ============================================
// COMPARISON
// ============================================

/**
 * Compare two weights (returns normalized difference in kg)
 */
export function compareWeights(a: Weight, b: Weight): number {
    return toWeightKg(a) - toWeightKg(b);
}

/**
 * Check if weights are equal (within tolerance)
 */
export function weightsEqual(a: Weight, b: Weight, toleranceKg: number = 0.01): boolean {
    return Math.abs(compareWeights(a, b)) < toleranceKg;
}

// ============================================
// ARITHMETIC
// ============================================

/**
 * Add two weights (returns in first weight's unit)
 */
export function addWeights(a: Weight, b: Weight): Weight {
    switch (a.unit) {
        case 'lbs':
            return { unit: 'lbs', value: lbs(a.value + toWeightLbs(b)) };
        case 'kg':
            return { unit: 'kg', value: kg(a.value + toWeightKg(b)) };
        default:
            const _exhaustive: never = a;
            throw new Error(`Unknown unit: ${_exhaustive}`);
    }
}

/**
 * Multiply weight by scalar
 */
export function multiplyWeight(w: Weight, scalar: number): Weight {
    switch (w.unit) {
        case 'lbs':
            return { unit: 'lbs', value: lbs(w.value * scalar) };
        case 'kg':
            return { unit: 'kg', value: kg(w.value * scalar) };
        default:
            const _exhaustive: never = w;
            throw new Error(`Unknown unit: ${_exhaustive}`);
    }
}

// ============================================
// UNSAFE COERCION (for trusted contexts)
// ============================================

export function unsafeCoerceLbs(value: number): WeightLbs {
    return value as WeightLbs;
}

export function unsafeCoerceKg(value: number): WeightKg {
    return value as WeightKg;
}

// ============================================
// E1RM CALCULATIONS (Epley Formula)
// ============================================

/**
 * Calculates estimated one-rep max using the Epley formula.
 * Note: Prefer EWMA e1rm from lift_stats when available.
 *
 * @param weight - The weight lifted (raw number)
 * @param reps - The number of reps performed
 * @returns Estimated 1RM, or the weight itself if reps <= 1
 *
 * @example
 * calculateE1RM(225, 5) // returns ~253
 */
export function calculateE1RM(weight: number, reps: number): number {
    if (reps <= 1) return weight;
    return weight * (1 + reps / 30);
}

/**
 * Derives target weight from E1RM for a given rep count.
 * Inverse of the Epley formula.
 *
 * @param e1rm - The estimated one-rep max
 * @param targetReps - The target number of reps
 * @returns The weight to use for the target reps
 *
 * @example
 * deriveWeightFromE1RM(300, 5) // returns ~259
 */
export function deriveWeightFromE1RM(e1rm: number, targetReps: number): number {
    if (targetReps <= 1) return e1rm;
    return e1rm / (1 + targetReps / 30);
}

// ============================================
// LOAD SUGGESTION UTILITIES
// ============================================

/**
 * Rounds a value to the nearest increment.
 * Essential for suggesting weights that match available plates.
 *
 * @param value - The weight value to round
 * @param increment - The increment to round to (e.g., 5 for lbs, 2.5 for kg)
 * @returns The rounded value
 *
 * @example
 * roundToIncrement(137, 5) // returns 135
 * roundToIncrement(52.3, 2.5) // returns 52.5
 */
export function roundToIncrement(value: number, increment: number): number {
    if (increment <= 0) return value;
    return Math.round(value / increment) * increment;
}

/**
 * Clamps a number between a minimum and maximum value.
 * Used to enforce weight limits (e.g., minimum barbell weight, max gym capacity).
 *
 * @param n - The number to clamp
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns The clamped value
 *
 * @example
 * clamp(25, 45, 500) // returns 45 (enforces minimum barbell weight)
 * clamp(600, 45, 500) // returns 500 (enforces max)
 */
export function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
}

/** Standard weight plate increments */
export const STANDARD_INCREMENTS = {
    lbs: 5,
    kg: 2.5,
} as const;

/**
 * Suggests a working weight rounded to the appropriate increment.
 *
 * @param weight - Raw calculated weight
 * @param unit - The unit system ('lbs' or 'kg')
 * @param customIncrement - Optional custom increment (defaults to standard)
 * @returns Rounded weight suitable for loading
 */
export function suggestWorkingWeight(
    weight: number,
    unit: WeightUnit,
    customIncrement?: number
): number {
    const increment = customIncrement ?? STANDARD_INCREMENTS[unit];
    return roundToIncrement(weight, increment);
}

/**
 * Applies a percentage increase to a weight and rounds appropriately.
 *
 * @param baseWeight - Starting weight
 * @param percentIncrease - Percentage to increase (e.g., 0.025 for 2.5%)
 * @param unit - The unit system
 * @returns New rounded weight
 */
export function applyPercentIncrease(
    baseWeight: number,
    percentIncrease: number,
    unit: WeightUnit
): number {
    const newWeight = baseWeight * (1 + percentIncrease);
    return suggestWorkingWeight(newWeight, unit);
}
