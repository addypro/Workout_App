/**
 * Zod Schema Validation for PDF Parsing
 *
 * Validates Claude's JSON output to catch hallucinations and malformed data.
 */

import { z } from 'https://esm.sh/zod@3.22.4';

// ============================================
// Analysis Phase Schemas
// ============================================

export const ProgramOptionSchema = z.object({
  name: z.string().min(1, 'Program name is required'),
  pageStart: z.number().int().min(1).optional(),
  pageEnd: z.number().int().min(1).optional(),
  description: z.string().optional(),
  daysPerWeek: z.number().int().min(1).max(7).optional(),
});

export const PDFAnalysisSchema = z.object({
  isWorkoutProgram: z.boolean(),
  containsMultiplePrograms: z.boolean(),
  programOptions: z.array(ProgramOptionSchema).default([]),
  rejectionReason: z.string().optional(),
  suggestedType: z.string().optional(),
  author: z.string().optional(),
  title: z.string().optional(),
  totalPages: z.number().int().min(1).optional(),
});

// ============================================
// Extraction Phase Schemas
// ============================================

export const ExtractedExerciseSchema = z.object({
  order: z.number().int().min(1),
  nameRaw: z.string().min(1, 'Exercise name is required'),
  sets: z.number().int().min(1).max(20), // Sanity check: max 20 sets
  reps: z.string().min(1), // Can be "8-10", "AMRAP", "failure", etc.
  weight: z.string().optional(),
  restSeconds: z.number().int().min(0).max(600).optional(), // Max 10 min rest
  tempo: z.string().optional(),
  rpe: z.number().min(1).max(10).optional(),
  supersetId: z.string().optional(),
  giantSetId: z.string().optional(),
  isDropSet: z.boolean().optional(),
  technique: z.string().optional(),
  notes: z.string().optional(),
  targetMuscle: z.string().optional(),
});

export const ExtractedWorkoutSchema = z.object({
  dayNumber: z.number().int().min(1).max(7),
  name: z.string().min(1),
  muscleGroups: z.array(z.string()).optional(),
  estimatedDuration: z.number().int().min(5).max(180).optional(), // 5-180 minutes
  exercises: z.array(ExtractedExerciseSchema).min(1, 'Workout must have at least one exercise'),
  notes: z.string().optional(),
});

export const ExtractedWeekSchema = z.object({
  weekNumber: z.number().int().min(1).max(52), // Max 52 weeks
  theme: z.string().optional(),
  workouts: z.array(ExtractedWorkoutSchema).min(1, 'Week must have at least one workout'),
  isDeload: z.boolean().optional(),
  notes: z.string().optional(),
});

export const ExtractedProgramSchema = z.object({
  name: z.string().min(1, 'Program name is required'),
  author: z.string().optional(),
  totalWeeks: z.number().int().min(1).max(52),
  daysPerWeek: z.number().int().min(1).max(7),
  goal: z.string().optional(),
  weeks: z.array(ExtractedWeekSchema).min(1, 'Program must have at least one week'),
  notes: z.string().optional(),
  equipmentRequired: z.array(z.string()).optional(),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
});

// ============================================
// Validation Functions
// ============================================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
  warnings?: string[];
}

/**
 * Validate PDF analysis result from Claude
 */
export function validateAnalysis(data: unknown): ValidationResult<z.infer<typeof PDFAnalysisSchema>> {
  try {
    const result = PDFAnalysisSchema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { success: false, errors: ['Unknown validation error'] };
  }
}

/**
 * Validate extracted program from Claude
 */
export function validateProgram(data: unknown): ValidationResult<z.infer<typeof ExtractedProgramSchema>> {
  const warnings: string[] = [];

  try {
    const result = ExtractedProgramSchema.parse(data);

    // Additional semantic validations
    let totalExercises = 0;
    result.weeks.forEach((week, wi) => {
      week.workouts.forEach((workout, woi) => {
        totalExercises += workout.exercises.length;

        // Check for duplicate exercise orders
        const orders = workout.exercises.map(e => e.order);
        const uniqueOrders = new Set(orders);
        if (orders.length !== uniqueOrders.size) {
          warnings.push(`Week ${wi + 1}, Day ${woi + 1}: Duplicate exercise order numbers`);
        }

        // Check for suspiciously high sets
        workout.exercises.forEach((exercise, ei) => {
          if (exercise.sets > 10) {
            warnings.push(`Week ${wi + 1}, Day ${woi + 1}, Exercise ${ei + 1}: Unusually high sets (${exercise.sets})`);
          }
        });
      });
    });

    // Check total exercise count
    if (totalExercises < 5) {
      warnings.push(`Only ${totalExercises} exercises found - program may be incomplete`);
    }

    return { success: true, data: result, warnings: warnings.length > 0 ? warnings : undefined };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { success: false, errors: ['Unknown validation error'] };
  }
}

/**
 * Attempt to fix common Claude output issues
 */
export function sanitizeProgram(data: any): any {
  if (!data || typeof data !== 'object') return data;

  // Deep clone to avoid mutations
  const sanitized = JSON.parse(JSON.stringify(data));

  // Fix common issues
  if (sanitized.weeks) {
    sanitized.weeks = sanitized.weeks.map((week: any, wi: number) => {
      // Ensure weekNumber is set
      if (!week.weekNumber) {
        week.weekNumber = wi + 1;
      }

      if (week.workouts) {
        week.workouts = week.workouts.map((workout: any, woi: number) => {
          // Ensure dayNumber is set
          if (!workout.dayNumber) {
            workout.dayNumber = woi + 1;
          }

          if (workout.exercises) {
            workout.exercises = workout.exercises.map((exercise: any, ei: number) => {
              // Ensure order is set
              if (!exercise.order) {
                exercise.order = ei + 1;
              }

              // Convert string sets to number
              if (typeof exercise.sets === 'string') {
                exercise.sets = parseInt(exercise.sets, 10) || 3;
              }

              // Ensure reps is a string
              if (typeof exercise.reps === 'number') {
                exercise.reps = String(exercise.reps);
              }

              // Cap unreasonable values
              if (exercise.sets > 20) exercise.sets = 20;
              if (exercise.rpe && exercise.rpe > 10) exercise.rpe = 10;

              return exercise;
            });
          }

          return workout;
        });
      }

      return week;
    });
  }

  // Ensure required fields
  if (!sanitized.totalWeeks && sanitized.weeks) {
    sanitized.totalWeeks = sanitized.weeks.length;
  }

  if (!sanitized.daysPerWeek && sanitized.weeks?.[0]?.workouts) {
    sanitized.daysPerWeek = sanitized.weeks[0].workouts.length;
  }

  return sanitized;
}

// Re-export Zod types for consumers
export type PDFAnalysis = z.infer<typeof PDFAnalysisSchema>;
export type ExtractedProgram = z.infer<typeof ExtractedProgramSchema>;
export type ExtractedWeek = z.infer<typeof ExtractedWeekSchema>;
export type ExtractedWorkout = z.infer<typeof ExtractedWorkoutSchema>;
export type ExtractedExercise = z.infer<typeof ExtractedExerciseSchema>;
