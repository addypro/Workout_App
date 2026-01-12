/**
 * Branded Types
 *
 * Provides compile-time type safety for ID types that are strings at runtime.
 * Prevents accidental mixing of different ID types (e.g., passing ExerciseId where ProgramId expected).
 *
 * @example
 * const exerciseId = parseExerciseId('ex-abc123');
 * const programId = parseProgramId('prog-xyz789');
 *
 * function getExercise(id: ExerciseId) { ... }
 * getExercise(exerciseId); // ✅ Works
 * getExercise(programId);  // ❌ Compile error: ProgramId not assignable to ExerciseId
 */

// ============================================
// BRAND UTILITY TYPE
// ============================================

/**
 * Creates a nominal/branded type from a base type.
 * Uses a unique symbol to create incompatible types at compile time.
 */
declare const __brand: unique symbol;

type Brand<K extends string, T> = T & { readonly [__brand]: K };

// ============================================
// ID TYPES
// ============================================

/** Unique identifier for an exercise definition */
export type ExerciseId = Brand<'ExerciseId', string>;

/** Unique identifier for a workout program */
export type ProgramId = Brand<'ProgramId', string>;

/** Unique identifier for a workout session instance */
export type WorkoutSessionId = Brand<'WorkoutSessionId', string>;

/** Unique identifier for a workout set */
export type SetId = Brand<'SetId', string>;

/** Unique identifier for an exercise within a workout */
export type WorkoutExerciseId = Brand<'WorkoutExerciseId', string>;

/** Unique identifier for a superset group */
export type SupersetGroupId = Brand<'SupersetGroupId', string>;

/** Unique identifier for a user */
export type UserId = Brand<'UserId', string>;

/** Unique identifier for a coach profile */
export type CoachId = Brand<'CoachId', string>;

/** Unique identifier for an athlete relationship */
export type AthleteId = Brand<'AthleteId', string>;

// ============================================
// ID VALIDATION
// ============================================

/**
 * ID format patterns for validation
 * Supports nanoid, uuid, and prefix-based IDs
 */
const ID_PATTERNS = {
    // Nanoid-style: 21 alphanumeric chars
    nanoid: /^[A-Za-z0-9_-]{21}$/,
    // UUID v4: 8-4-4-4-12 hex
    uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    // Prefixed ID: prefix-timestamp-random (our current format)
    prefixed: /^[a-z]{2,4}-\d+-[a-z0-9]{9}$/,
    // Simple prefix: any prefix followed by alphanumeric
    simple: /^[a-z]+-.+$/i,
} as const;

function isValidIdFormat(id: unknown): id is string {
    if (typeof id !== 'string') return false;
    if (id.length === 0 || id.length > 100) return false;

    // Accept any of the common formats
    return (
        ID_PATTERNS.nanoid.test(id) ||
        ID_PATTERNS.uuid.test(id) ||
        ID_PATTERNS.prefixed.test(id) ||
        ID_PATTERNS.simple.test(id)
    );
}

// ============================================
// SMART CONSTRUCTORS (PARSE FUNCTIONS)
// ============================================

export class InvalidIdError extends Error {
    constructor(type: string, value: unknown) {
        super(`Invalid ${type}: ${String(value)}`);
        this.name = 'InvalidIdError';
    }
}

/**
 * Parse and validate an ExerciseId
 * @throws InvalidIdError if the format is invalid
 */
export function parseExerciseId(id: string): ExerciseId {
    if (!isValidIdFormat(id)) {
        throw new InvalidIdError('ExerciseId', id);
    }
    return id as ExerciseId;
}

/**
 * Parse and validate a ProgramId
 * @throws InvalidIdError if the format is invalid
 */
export function parseProgramId(id: string): ProgramId {
    if (!isValidIdFormat(id)) {
        throw new InvalidIdError('ProgramId', id);
    }
    return id as ProgramId;
}

/**
 * Parse and validate a WorkoutSessionId
 * @throws InvalidIdError if the format is invalid
 */
export function parseWorkoutSessionId(id: string): WorkoutSessionId {
    if (!isValidIdFormat(id)) {
        throw new InvalidIdError('WorkoutSessionId', id);
    }
    return id as WorkoutSessionId;
}

/**
 * Parse and validate a SetId
 * @throws InvalidIdError if the format is invalid
 */
export function parseSetId(id: string): SetId {
    if (!isValidIdFormat(id)) {
        throw new InvalidIdError('SetId', id);
    }
    return id as SetId;
}

/**
 * Parse and validate a WorkoutExerciseId
 * @throws InvalidIdError if the format is invalid
 */
export function parseWorkoutExerciseId(id: string): WorkoutExerciseId {
    if (!isValidIdFormat(id)) {
        throw new InvalidIdError('WorkoutExerciseId', id);
    }
    return id as WorkoutExerciseId;
}

/**
 * Parse and validate a SupersetGroupId
 * @throws InvalidIdError if the format is invalid
 */
export function parseSupersetGroupId(id: string): SupersetGroupId {
    if (!isValidIdFormat(id)) {
        throw new InvalidIdError('SupersetGroupId', id);
    }
    return id as SupersetGroupId;
}

/**
 * Parse and validate a UserId (UUID format typically from Supabase)
 * @throws InvalidIdError if the format is invalid
 */
export function parseUserId(id: string): UserId {
    if (!isValidIdFormat(id)) {
        throw new InvalidIdError('UserId', id);
    }
    return id as UserId;
}

/**
 * Parse and validate a CoachId
 * @throws InvalidIdError if the format is invalid
 */
export function parseCoachId(id: string): CoachId {
    if (!isValidIdFormat(id)) {
        throw new InvalidIdError('CoachId', id);
    }
    return id as CoachId;
}

/**
 * Parse and validate an AthleteId
 * @throws InvalidIdError if the format is invalid
 */
export function parseAthleteId(id: string): AthleteId {
    if (!isValidIdFormat(id)) {
        throw new InvalidIdError('AthleteId', id);
    }
    return id as AthleteId;
}

// ============================================
// SAFE PARSE (RESULT TYPE)
// ============================================

type ParseResult<T> = { success: true; value: T } | { success: false; error: InvalidIdError };

/**
 * Safely parse an ID without throwing
 * @returns Result object with success flag
 */
export function safeParseExerciseId(id: string): ParseResult<ExerciseId> {
    try {
        return { success: true, value: parseExerciseId(id) };
    } catch (error) {
        return { success: false, error: error as InvalidIdError };
    }
}

export function safeParseProgramId(id: string): ParseResult<ProgramId> {
    try {
        return { success: true, value: parseProgramId(id) };
    } catch (error) {
        return { success: false, error: error as InvalidIdError };
    }
}

export function safeParseWorkoutSessionId(id: string): ParseResult<WorkoutSessionId> {
    try {
        return { success: true, value: parseWorkoutSessionId(id) };
    } catch (error) {
        return { success: false, error: error as InvalidIdError };
    }
}

// ============================================
// ID GENERATORS
// ============================================

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createExerciseId(): ExerciseId {
    return `ex-${generateId()}` as ExerciseId;
}

export function createProgramId(): ProgramId {
    return `prog-${generateId()}` as ProgramId;
}

export function createWorkoutSessionId(): WorkoutSessionId {
    return `ws-${generateId()}` as WorkoutSessionId;
}

export function createSetId(): SetId {
    return `set-${generateId()}` as SetId;
}

export function createWorkoutExerciseId(): WorkoutExerciseId {
    return `wex-${generateId()}` as WorkoutExerciseId;
}

export function createSupersetGroupId(): SupersetGroupId {
    return `ss-${generateId()}` as SupersetGroupId;
}

// ============================================
// TYPE GUARD HELPERS
// ============================================

/**
 * Check if a value is a valid ID string (runtime check only)
 */
export function isValidId(value: unknown): value is string {
    return isValidIdFormat(value);
}

/**
 * Unsafe cast for trusted contexts (e.g., database reads)
 * Use only when you're certain the value is already validated
 */
export function unsafeCoerceExerciseId(id: string): ExerciseId {
    return id as ExerciseId;
}

export function unsafeCoerceProgramId(id: string): ProgramId {
    return id as ProgramId;
}

export function unsafeCoerceWorkoutSessionId(id: string): WorkoutSessionId {
    return id as WorkoutSessionId;
}

export function unsafeCoerceSetId(id: string): SetId {
    return id as SetId;
}

export function unsafeCoerceWorkoutExerciseId(id: string): WorkoutExerciseId {
    return id as WorkoutExerciseId;
}

export function unsafeCoerceSupersetGroupId(id: string): SupersetGroupId {
    return id as SupersetGroupId;
}
