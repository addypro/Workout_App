/**
 * Extractor Service
 *
 * Unified service for extracting workout programs from various file types.
 * Handles CSV, Excel, PDF, and Image files with appropriate strategies.
 */

import { getExerciseDatabase } from '@/lib/services/exercise/database';
import { resolveExerciseName } from '@/lib/services/exercise/resolver';
import { ExerciseMatch, ParsedProgram, ParsedWorkout } from '@/lib/types/program';
import { findBestMatch } from '@/lib/utils/fuzzy';
import { parseExcelFromUri } from './excel';
import { isPDFParsingAvailable, parsePDF } from './pdf';
import type { ExtractedProgram } from './pdf/types';
import { ParseResult } from './types';

// ============================================
// TYPES
// ============================================

export interface UnmatchedExerciseInfo {
  originalName: string;
  location: { week: number; day: number };
  suggestions: ExerciseMatch[];
}

export interface ExtractionResult extends ParseResult {
  unmatchedExercises?: UnmatchedExerciseInfo[];
}

type FileType = 'csv' | 'excel' | 'pdf' | 'image';

// ============================================
// HELPERS
// ============================================

/**
 * Convert ExtractedProgram (from PDF parser) to ParsedProgram (app format)
 */
function convertExtractedToParsed(extracted: ExtractedProgram): ParsedProgram {
  const workouts: ParsedWorkout[] = [];

  for (const week of extracted.weeks) {
    for (const workout of week.workouts) {
      workouts.push({
        week: week.weekNumber,
        day: workout.dayNumber,
        name: workout.name,
        exercises: workout.exercises.map((ex, idx) => ({
          name: ex.nameNormalized || ex.nameRaw,
          originalName: ex.nameNormalized ? ex.nameRaw : undefined,
          sets: ex.sets,
          reps: ex.reps,
          weight: ex.weight,
          restSeconds: ex.restSeconds,
          notes: ex.notes,
          order: idx,
        })),
        order: workouts.length,
      });
    }
  }

  return {
    name: extracted.name,
    description: extracted.goal,
    workouts,
  };
}

// ============================================
// SERVICE
// ============================================

export class ExtractorService {
  private static instance: ExtractorService;
  private exerciseNames: string[] = [];
  private exerciseNamesLoaded = false;

  private constructor() { }

  public static getInstance(): ExtractorService {
    if (!ExtractorService.instance) {
      ExtractorService.instance = new ExtractorService();
    }
    return ExtractorService.instance;
  }

  /**
   * Load exercise names for matching
   */
  private async ensureExerciseNames(): Promise<void> {
    if (this.exerciseNamesLoaded) return;

    try {
      const db = await getExerciseDatabase();
      this.exerciseNames = [];

      for (const ex of db) {
        this.exerciseNames.push(ex.name);
        if (ex.aliases) {
          this.exerciseNames.push(...ex.aliases);
        }
      }

      this.exerciseNamesLoaded = true;
    } catch (error) {
      console.warn('Failed to load exercise names for matching:', error);
    }
  }

  /**
   * Extract workout data from a file using the appropriate strategy
   */
  public async extract(
    fileUri: string,
    fileType: FileType,
    content?: string,
    onProgress?: (stage: string, percent: number) => void
  ): Promise<ExtractionResult> {
    try {
      await this.ensureExerciseNames();

      let result: ParseResult;

      switch (fileType) {
        case 'csv':
          result = await this.extractFromCSV(content || '');
          break;

        case 'excel':
          result = await this.extractFromExcel(fileUri);
          break;

        case 'pdf':
          result = await this.extractFromPDF(fileUri, onProgress);
          break;

        case 'image':
          result = await this.extractFromImage(fileUri, onProgress);
          break;

        default:
          return {
            success: false,
            error: `Unsupported file type: ${fileType}`,
          };
      }

      if (!result.success || !result.data) {
        return result;
      }

      // Post-process: Match exercises and find unmatched ones
      const { program, unmatched } = await this.matchExercises(result.data);

      return {
        success: true,
        data: program,
        metadata: result.metadata,
        unmatchedExercises: unmatched,
      };
    } catch (error) {
      console.error('Extraction failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown extraction error',
      };
    }
  }

  /**
   * Extract from CSV content
   */
  private async extractFromCSV(content: string): Promise<ParseResult> {
    const { parseCSV } = await import('./csv');
    const parsed = await parseCSV(content);
    return {
      success: true,
      data: parsed,
      metadata: { source: 'csv-local' },
    };
  }

  /**
   * Extract from Excel file
   */
  private async extractFromExcel(fileUri: string): Promise<ParseResult> {
    try {
      const result = await parseExcelFromUri(fileUri);
      return {
        success: true,
        data: {
          name: result.name,
          workouts: result.workouts,
        },
        metadata: {
          source: 'excel-local',
          pageCount: result.totalWeeks,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse Excel file',
      };
    }
  }

  /**
   * Extract from PDF using Edge Function
   */
  private async extractFromPDF(
    fileUri: string,
    onProgress?: (stage: string, percent: number) => void
  ): Promise<ParseResult> {
    // Check if PDF parsing is available
    if (!isPDFParsingAvailable()) {
      return {
        success: false,
        error: 'PDF parsing requires an active internet connection and configured Supabase Edge Functions.',
      };
    }

    try {
      const filename = fileUri.split('/').pop() || 'document.pdf';
      const result = await parsePDF(fileUri, filename, onProgress);

      if (result.status === 'error') {
        return {
          success: false,
          error: result.errorMessage || 'Failed to parse PDF',
        };
      }

      if (result.status === 'no_workout_found') {
        return {
          success: false,
          error: result.analysis?.rejectionReason || 'This PDF does not appear to contain a workout program.',
        };
      }

      if (!result.selectedProgram) {
        return {
          success: false,
          error: 'No program data extracted from PDF',
        };
      }

      // Convert ExtractedProgram to ParsedProgram
      const parsedProgram = convertExtractedToParsed(result.selectedProgram);

      return {
        success: true,
        data: parsedProgram,
        metadata: {
          source: 'pdf-ai',
          pageCount: result.metadata?.totalPages,
          processingTimeMs: result.metadata?.processingTimeMs,
        },
      };
    } catch (error) {
      console.error('PDF extraction error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse PDF',
      };
    }
  }

  /**
   * Extract from Image using Edge Function
   */
  private async extractFromImage(
    fileUri: string,
    onProgress?: (stage: string, percent: number) => void
  ): Promise<ParseResult> {
    // For images, we can use the same PDF Edge Function since it supports base64 images
    // Or implement a separate image extraction endpoint

    onProgress?.('Processing image...', 20);

    // For now, use a simplified approach - we'd need to implement image extraction
    // This would call a Supabase Edge Function that uses Claude Vision
    return {
      success: false,
      error: 'Image extraction is not yet implemented. Please use PDF or CSV format.',
    };
  }

  /**
   * Match exercise names against database and return unmatched ones
   */
  private async matchExercises(
    program: ParsedProgram
  ): Promise<{ program: ParsedProgram; unmatched: UnmatchedExerciseInfo[] }> {
    const unmatched: UnmatchedExerciseInfo[] = [];
    const matchCache = new Map<string, string | null>();

    // Process all workouts
    const updatedWorkouts = await Promise.all(
      program.workouts.map(async workout => {
        const updatedExercises = await Promise.all(
          workout.exercises.map(async exercise => {
            const nameLower = exercise.name.toLowerCase();

            // Check cache first
            if (matchCache.has(nameLower)) {
              const cachedMatch = matchCache.get(nameLower);
              if (cachedMatch) {
                return { ...exercise, name: cachedMatch, originalName: exercise.name };
              }
              return exercise;
            }

            // Try to match using canonical resolver
            const resolved = resolveExerciseName(exercise.name);
            const matchedName = resolved.matched ? resolved.name : exercise.name;

            if (matchedName !== exercise.name) {
              // Found a match
              matchCache.set(nameLower, matchedName);
              return { ...exercise, name: matchedName, originalName: exercise.name };
            }

            // No exact match - add to unmatched and get suggestions
            matchCache.set(nameLower, null);

            const suggestions = this.getSuggestions(exercise.name);
            unmatched.push({
              originalName: exercise.name,
              location: { week: workout.week, day: workout.day },
              suggestions,
            });

            return exercise;
          })
        );

        return { ...workout, exercises: updatedExercises };
      })
    );

    return {
      program: { ...program, workouts: updatedWorkouts },
      unmatched,
    };
  }

  /**
   * Get exercise match suggestions for a name
   */
  private getSuggestions(name: string, maxSuggestions = 5): ExerciseMatch[] {
    if (this.exerciseNames.length === 0) return [];

    const suggestions: ExerciseMatch[] = [];
    const nameLower = name.toLowerCase();

    // Score all exercises
    const scored = this.exerciseNames.map(candidate => {
      const candidateLower = candidate.toLowerCase();

      // Exact substring match gets high score
      if (candidateLower.includes(nameLower) || nameLower.includes(candidateLower)) {
        const lengthDiff = Math.abs(candidate.length - name.length);
        return { name: candidate, score: 0.9 - lengthDiff * 0.01 };
      }

      // Use fuzzy match for distance
      const result = findBestMatch(name, [candidate]);
      if (result) {
        // Convert distance to confidence (lower distance = higher confidence)
        const maxLen = Math.max(name.length, candidate.length);
        const confidence = 1 - result.score / maxLen;
        return { name: candidate, score: Math.max(0, confidence) };
      }

      return { name: candidate, score: 0 };
    });

    // Sort by score and take top matches
    scored
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions)
      .filter(s => s.score > 0.3)
      .forEach(s => {
        suggestions.push({
          originalName: name,
          suggestedName: s.name,
          confidence: s.score,
          requiresReview: s.score < 0.8,
        });
      });

    return suggestions;
  }
}

export const extractorService = ExtractorService.getInstance();
