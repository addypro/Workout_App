/**
 * PDF Extract Edge Function
 *
 * Phase 2 of the vision-first PDF parsing pipeline.
 * Extracts structured workout data from the selected program pages.
 * Includes caching to avoid re-parsing identical programs.
 * Features: Schema validation with auto-sanitization, Caching
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { callClaude, extractJSON } from '../_shared/claude.ts';
import { generatePDFHash } from '../_shared/hash.ts';
import { getCachedExtraction, cacheExtraction } from '../_shared/cache.ts';
import { validateProgram, sanitizeProgram, type ExtractedProgram } from '../_shared/schema.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXTRACTION_SYSTEM_PROMPT = `You are an expert fitness program parser. Your task is to extract structured workout data from PDF pages.

IMPORTANT: You must respond ONLY with valid JSON matching the exact schema below. Do not include any other text.

JSON Schema:
{
  "name": string,
  "author": string (optional),
  "totalWeeks": number,
  "daysPerWeek": number,
  "goal": string (optional),
  "experienceLevel": "beginner" | "intermediate" | "advanced" (optional),
  "equipmentRequired": string[] (optional),
  "notes": string (optional),
  "weeks": [
    {
      "weekNumber": number,
      "theme": string (optional, e.g., "Base Volume", "Intensity"),
      "isDeload": boolean,
      "notes": string (optional),
      "workouts": [
        {
          "dayNumber": number,
          "name": string,
          "muscleGroups": string[] (optional),
          "estimatedDuration": number (optional, in minutes),
          "notes": string (optional),
          "exercises": [
            {
              "order": number,
              "nameRaw": string (exact name as written in PDF),
              "sets": number,
              "reps": string (e.g., "8-10", "12", "AMRAP"),
              "weight": string (optional, e.g., "135 lbs", "70% 1RM"),
              "restSeconds": number (optional),
              "tempo": string (optional, e.g., "3-1-2-0"),
              "rpe": number (optional, 1-10),
              "supersetId": string (optional, use "SS_01", "SS_02" etc for exercises done together),
              "giantSetId": string (optional),
              "isDropSet": boolean (optional),
              "technique": string (optional, e.g., "Pause at bottom", "Slow negative"),
              "notes": string (optional),
              "targetMuscle": string (optional)
            }
          ]
        }
      ]
    }
  ]
}

Parsing Rules:
1. Extract EVERY exercise mentioned, even if formatting is inconsistent
2. For rep ranges like "8-10", keep as string
3. For supersets/giant sets, assign matching IDs (SS_01, SS_02, etc.)
4. Include all coaching notes and technique instructions in the "notes" or "technique" fields
5. If weeks follow the same pattern, still list each week separately
6. Preserve exact exercise names as written (we normalize later)
7. Handle variations like:
   - "3 sets of 8-10 reps" → sets: 3, reps: "8-10"
   - "4x12" → sets: 4, reps: "12"
   - "AMRAP" → reps: "AMRAP"
   - "To failure" → reps: "failure"

Common abbreviations to preserve (do NOT expand):
- DB = Dumbbell
- BB = Barbell
- EZ = EZ Bar
- Inc = Incline
- Dec = Decline
- RDL = Romanian Deadlift
- OHP = Overhead Press

Drop Set indicators:
- "Drop set", "DS", "strip set", "run the rack"

Superset indicators:
- "Superset with", "SS", "A1/A2", "paired with"`;

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { pdfBase64, selectedOption, knownExercises, contentHash, fileSize } = await req.json();

    if (!pdfBase64 || !selectedOption) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Use provided hash or generate one
    const pdfHash = contentHash || await generatePDFHash(pdfBase64, fileSize);
    const programName = selectedOption.name;

    // Check cache first
    const cached = await getCachedExtraction(pdfHash, programName);
    if (cached.found) {
      console.log(`Cache HIT for program: ${programName} (hash: ${pdfHash.slice(0, 8)}...)`);

      // Still compute unmatched exercises against current known list
      const unmatchedExercises: string[] = [];
      if (knownExercises?.length && cached.program) {
        const knownLower = new Set(knownExercises.map((e: string) => e.toLowerCase()));
        cached.program.weeks?.forEach((week: any) => {
          week.workouts?.forEach((workout: any) => {
            workout.exercises?.forEach((exercise: any) => {
              if (!knownLower.has(exercise.nameRaw?.toLowerCase())) {
                if (!unmatchedExercises.includes(exercise.nameRaw)) {
                  unmatchedExercises.push(exercise.nameRaw);
                }
              }
            });
          });
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          program: cached.program,
          unmatchedExercises,
          cached: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Cache MISS for program: ${programName} (hash: ${pdfHash.slice(0, 8)}...) - calling Claude`);

    const pageHint = selectedOption.pageStart && selectedOption.pageEnd
      ? `Focus on pages ${selectedOption.pageStart} to ${selectedOption.pageEnd}.`
      : '';

    const exerciseHint = knownExercises?.length
      ? `\n\nKnown exercises in our database (for reference when parsing): ${knownExercises.slice(0, 50).join(', ')}`
      : '';

    // Call Claude Vision to extract the program
    const response = await callClaude(
      EXTRACTION_SYSTEM_PROMPT,
      [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract the workout program "${selectedOption.name}" from this PDF. ${pageHint}

Parse all workouts, exercises, sets, reps, and notes. Be thorough - don't skip any exercises.
${exerciseHint}

Respond with JSON only.`,
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
          ],
        },
      ],
      8192 // Higher token limit for full extraction
    );

    // Parse the JSON response
    const rawProgram = extractJSON<any>(response);

    // Sanitize common Claude output issues (missing order numbers, string sets, etc.)
    const sanitizedProgram = sanitizeProgram(rawProgram);

    // Validate with Zod schema
    const validationResult = validateProgram(sanitizedProgram);

    const warnings: string[] = [];

    if (!validationResult.success) {
      console.warn('Program validation errors:', validationResult.errors);
      // Include validation errors as warnings but still try to use the data
      warnings.push(...(validationResult.errors || []));
    }

    if (validationResult.warnings) {
      warnings.push(...validationResult.warnings);
    }

    // Use validated data if available, otherwise fall back to sanitized
    const program = validationResult.data || sanitizedProgram;

    // Additional content validation
    if (!program.weeks || program.weeks.length === 0) {
      warnings.push('No weeks found in program');
    }

    const totalExercises = program.weeks?.reduce(
      (acc: number, week: any) =>
        acc +
        (week.workouts?.reduce(
          (wacc: number, workout: any) => wacc + (workout.exercises?.length || 0),
          0
        ) || 0),
      0
    ) || 0;

    if (totalExercises === 0) {
      warnings.push('No exercises found in program');
    } else {
      console.log(`Extracted ${totalExercises} exercises from ${program.weeks?.length || 0} weeks`);
    }

    // Find unmatched exercises (those not in known list)
    const unmatchedExercises: string[] = [];
    if (knownExercises?.length) {
      const knownLower = new Set(knownExercises.map((e: string) => e.toLowerCase()));
      program.weeks?.forEach((week: any) => {
        week.workouts?.forEach((workout: any) => {
          workout.exercises?.forEach((exercise: any) => {
            if (!knownLower.has(exercise.nameRaw?.toLowerCase())) {
              if (!unmatchedExercises.includes(exercise.nameRaw)) {
                unmatchedExercises.push(exercise.nameRaw);
              }
            }
          });
        });
      });
    }

    // Cache the extracted program for future requests
    await cacheExtraction(pdfHash, programName, program);
    console.log(`Cached extraction for program: ${programName}`);

    return new Response(
      JSON.stringify({
        success: true,
        program,
        unmatchedExercises,
        warnings: warnings.length > 0 ? warnings : undefined,
        cached: false,
        validated: validationResult.success,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Extraction error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
