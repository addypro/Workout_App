/**
 * PDF Analyze Edge Function
 *
 * Phase 1 of the vision-first PDF parsing pipeline.
 * Analyzes PDF structure and detects program options.
 * Includes caching to avoid re-parsing identical PDFs.
 * Features: Pre-filtering, Schema validation, Caching
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { callClaude, extractJSON } from '../_shared/claude.ts';
import { generatePDFHash } from '../_shared/hash.ts';
import { getCachedAnalysis, cacheAnalysis } from '../_shared/cache.ts';
import { prefilterPDF } from '../_shared/prefilter.ts';
import { validateAnalysis, type PDFAnalysis } from '../_shared/schema.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANALYSIS_SYSTEM_PROMPT = `You are an expert fitness program analyst. Your task is to analyze PDF documents to determine if they contain workout programs and identify their structure.

IMPORTANT: You must respond ONLY with valid JSON matching the exact schema below. Do not include any other text, explanations, or markdown formatting.

JSON Schema:
{
  "isWorkoutProgram": boolean,
  "containsMultiplePrograms": boolean,
  "programOptions": [
    {
      "name": string,
      "pageStart": number,
      "pageEnd": number,
      "description": string,
      "daysPerWeek": number (optional)
    }
  ],
  "rejectionReason": string (only if isWorkoutProgram is false),
  "suggestedType": string (e.g., "nutrition_guide", "recipe_book", "general_fitness"),
  "author": string (if detected),
  "title": string (if detected),
  "totalPages": number
}

Rules:
1. isWorkoutProgram = true ONLY if the document contains structured workout routines with exercises, sets, and reps
2. If the document has multiple program variations (e.g., "3-Day Split" vs "5-Day Split"), set containsMultiplePrograms = true and list each as a separate programOption
3. Look for table of contents or section headers to identify program boundaries
4. Nutrition guides, recipe books, and motivational content are NOT workout programs
5. If you find exercises but no structured program (just exercise demonstrations), set isWorkoutProgram = false

Examples of workout programs:
- "Week 1, Day 1: Bench Press 4x8, Squat 3x10"
- Structured training blocks with exercises, sets, reps
- Progressive overload schemes

Examples of NON-workout programs:
- Nutrition guides with macros and meal plans
- Exercise encyclopedias (demonstrations only)
- Motivational or lifestyle content`;

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { pdfBase64, filename, fileSize } = await req.json();

    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'No PDF provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Generate content hash for caching
    const contentHash = await generatePDFHash(pdfBase64, fileSize);

    // Check cache first
    const cached = await getCachedAnalysis(contentHash);
    if (cached.found) {
      console.log(`Cache HIT for PDF: ${filename} (hash: ${contentHash.slice(0, 8)}...)`);
      return new Response(
        JSON.stringify({
          success: true,
          analysis: cached.analysis,
          contentHash,
          cached: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Cache MISS for PDF: ${filename} (hash: ${contentHash.slice(0, 8)}...) - checking prefilter`);

    // Pre-filter: Quick keyword check before expensive Claude call
    const prefilterResult = prefilterPDF(pdfBase64);
    console.log(`Prefilter result: ${prefilterResult.recommendation} (confidence: ${prefilterResult.confidence})`);

    // If prefilter strongly suggests non-workout, return early (saves API tokens)
    if (prefilterResult.recommendation === 'reject' && prefilterResult.confidence === 'none') {
      const rejectionAnalysis: PDFAnalysis = {
        isWorkoutProgram: false,
        containsMultiplePrograms: false,
        programOptions: [],
        rejectionReason: prefilterResult.reason || 'Document does not appear to be a workout program',
        suggestedType: 'non_workout',
      };

      // Still cache the rejection to avoid re-checking
      await cacheAnalysis(contentHash, filename, fileSize || null, rejectionAnalysis);

      return new Response(
        JSON.stringify({
          success: true,
          analysis: rejectionAnalysis,
          contentHash,
          cached: false,
          prefiltered: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Prefilter passed - calling Claude Vision`);

    // Call Claude Vision to analyze the PDF
    const response = await callClaude(
      ANALYSIS_SYSTEM_PROMPT,
      [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this PDF document titled "${filename}". Examine the first 10-15 pages thoroughly including any table of contents. Determine if this is a workout program and identify its structure. Respond with JSON only.`,
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
      2048
    );

    // Parse the JSON response
    const rawAnalysis = extractJSON<PDFAnalysis>(response);

    // Validate with Zod schema
    const validationResult = validateAnalysis(rawAnalysis);

    if (!validationResult.success) {
      console.warn('Analysis validation warnings:', validationResult.errors);
      // Still proceed with raw data, but log the issues
    }

    const analysis = validationResult.data || rawAnalysis;

    // Cache the result for future requests
    await cacheAnalysis(contentHash, filename, fileSize || null, analysis);
    console.log(`Cached analysis for PDF: ${filename}`);

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        contentHash,
        cached: false,
        validationWarnings: validationResult.errors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Analysis error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
