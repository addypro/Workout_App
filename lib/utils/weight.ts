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
