/**
 * Discriminated Union Result Types
 *
 * Provides type-safe result types that eliminate runtime checks.
 * Uses TypeScript discriminated unions to guarantee field presence.
 */

import type { SetType } from '@/lib/types/workout-session';

// ============================================
// PARSE ERROR TYPES
// ============================================

export type ParseErrorCode =
    | 'NO_MATCH'            // No exercise matched
    | 'AMBIGUOUS'           // Multiple possible matches
    | 'INVALID_FORMAT'      // Could not parse input at all
    | 'EMPTY_INPUT'         // Empty or whitespace-only input
    | 'LOW_CONFIDENCE'      // Match found but confidence too low
    | 'NETWORK_ERROR'       // Cloud STT failed
    | 'PERMISSION_DENIED';  // Microphone access denied

export interface ParseError {
    code: ParseErrorCode;
    message: string;
    suggestions?: string[];
    partialData?: {
        rawName?: string;
        possibleMatches?: string[];
    };
}

// ============================================
// PARSED EXERCISE (Refined)
// ============================================

export interface ParsedExercise {
    rawName: string;
    matchedExerciseId: string;  // Always present on success
    matchedExerciseName: string; // Always present on success
    matchConfidence: number;
    sets?: number;
    reps?: number | string;
    weight?: number;
    weightUnit?: 'lbs' | 'kg';
    setType?: SetType;
    restTime?: number;
}

// ============================================
// DISCRIMINATED UNION: VOICE PARSE RESULT
// ============================================

interface BaseParseResult {
    rawTranscript: string;
    processingTier: 1 | 2 | 3;
    cached: boolean;
    timestamp: number;
}

/**
 * Successful parse with guaranteed exercise data
 */
export interface VoiceParseSuccess extends BaseParseResult {
    success: true;
    type: 'add_exercise' | 'add_superset' | 'create_workout';
    confidence: number;

    // Single exercise (guaranteed for 'add_exercise')
    exercise?: ParsedExercise;

    // Superset (guaranteed for 'add_superset')
    superset?: {
        exercises: ParsedExercise[];
        groupId: string;
        restAfterComplete: number;
    };

    // Full workout (guaranteed for 'create_workout')
    workout?: {
        name: string;
        exercises: ParsedExercise[];
    };
}

/**
 * Successful command parse (navigation/control)
 */
export interface VoiceCommandSuccess extends BaseParseResult {
    success: true;
    type: 'navigation' | 'control' | 'modify_set';
    command: string; // Guaranteed for command types
    parameters?: Record<string, unknown>;
}

/**
 * Needs clarification (exercise disambiguation)
 */
export interface VoiceNeedsClarification extends BaseParseResult {
    success: false;
    type: 'needs_clarification';
    clarification: {
        type: 'equipment_variant' | 'exercise_variant' | 'similar_exercise';
        question: string;
        options: Array<{
            id: string;
            label: string;
            description?: string;
            exerciseId?: string;
        }>;
        partialParse?: Partial<ParsedExercise>;
    };
}

/**
 * Parse failed
 */
export interface VoiceParseFailure extends BaseParseResult {
    success: false;
    type: 'error';
    error: ParseError; // Guaranteed for failures
}

/**
 * Discriminated union type
 * 
 * Usage:
 * ```typescript
 * function handleResult(result: VoiceParseResultUnion) {
 *   if (result.success && result.type === 'add_exercise') {
 *     // TypeScript knows result.exercise is defined
 *     console.log(result.exercise.matchedExerciseName);
 *   } else if (!result.success && result.type === 'error') {
 *     // TypeScript knows result.error is defined
 *     console.log(result.error.message);
 *   }
 * }
 * ```
 */
export type VoiceParseResultUnion =
    | VoiceParseSuccess
    | VoiceCommandSuccess
    | VoiceNeedsClarification
    | VoiceParseFailure;

// ============================================
// TYPE GUARDS
// ============================================

export function isParseSuccess(result: VoiceParseResultUnion): result is VoiceParseSuccess {
    return result.success === true &&
        (result.type === 'add_exercise' || result.type === 'add_superset' || result.type === 'create_workout');
}

export function isCommandSuccess(result: VoiceParseResultUnion): result is VoiceCommandSuccess {
    return result.success === true &&
        (result.type === 'navigation' || result.type === 'control' || result.type === 'modify_set');
}

export function needsClarification(result: VoiceParseResultUnion): result is VoiceNeedsClarification {
    return result.success === false && result.type === 'needs_clarification';
}

export function isParseFailure(result: VoiceParseResultUnion): result is VoiceParseFailure {
    return result.success === false && result.type === 'error';
}

// ============================================
// FACTORY FUNCTIONS
// ============================================

export function createSuccessResult(
    type: VoiceParseSuccess['type'],
    data: Omit<VoiceParseSuccess, 'success' | 'type' | 'rawTranscript' | 'processingTier' | 'cached' | 'timestamp'>,
    meta: { rawTranscript: string; processingTier: 1 | 2 | 3; cached: boolean }
): VoiceParseSuccess {
    return {
        success: true,
        type,
        ...data,
        ...meta,
        timestamp: Date.now(),
    };
}

export function createErrorResult(
    error: ParseError,
    rawTranscript: string
): VoiceParseFailure {
    return {
        success: false,
        type: 'error',
        error,
        rawTranscript,
        processingTier: 1,
        cached: false,
        timestamp: Date.now(),
    };
}

export function createClarificationResult(
    clarification: VoiceNeedsClarification['clarification'],
    rawTranscript: string
): VoiceNeedsClarification {
    return {
        success: false,
        type: 'needs_clarification',
        clarification,
        rawTranscript,
        processingTier: 1,
        cached: false,
        timestamp: Date.now(),
    };
}
