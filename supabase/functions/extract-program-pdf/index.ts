/**
 * Extract Program PDF - Edge Function
 * 
 * Research-backed architecture using native PDF processing:
 * 1. Cache Check - SHA-256 hash lookup
 * 2. Claude 3.5 Sonnet (PRIMARY) - Native PDF understanding
 * 3. Gemini 2.5 Flash (FALLBACK) - Page images at 200 DPI
 * 
 * Claude native PDF is "10x better than OCR" per 2024 research
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// EXTRACTION PROMPT (shared across providers)
// ============================================

const EXTRACTION_PROMPT = `Analyze this PDF document. First determine if it's a workout/training program, then extract its contents.

STEP 1: Classification
- Is this a workout/training program with exercises, sets, and reps?
- Nutrition guides, meal plans, and theory-only content are NOT workout programs

STEP 2: If it IS a workout program, extract the complete structure

Return JSON ONLY (no markdown, no explanation):

{
  "isWorkoutProgram": boolean,
  "confidence": 0.0 to 1.0,
  "reason": "brief classification explanation",
  "program": {
    "name": "Program Name",
    "description": "Brief program description",
    "durationWeeks": number,
    "daysPerWeek": number,
    "weeks": [
      {
        "weekNumber": 1,
        "days": [
          {
            "dayNumber": 1,
            "name": "Push Day",
            "focus": "Chest, Shoulders, Triceps",
            "exercises": [
              {
                "name": "Bench Press",
                "sets": 4,
                "reps": "6-8",
                "restSeconds": 180,
                "notes": "Pause at bottom",
                "isSuperset": false
              }
            ]
          }
        ]
      }
    ],
    "notes": "Any program-level notes"
  }
}

If NOT a workout program, return:
{
  "isWorkoutProgram": false,
  "confidence": 0.9,
  "reason": "This is a nutrition guide / ebook about training theory / etc",
  "program": null
}

EXTRACTION RULES:
- Extract ALL weeks if multiple exist
- Keep rep ranges as strings (e.g., "8-12")
- Include rest periods if specified
- Include any exercise notes or cues
- Ignore: nutrition info, supplement recommendations, intro text`;

// ============================================
// HELPER FUNCTIONS
// ============================================

async function hashContent(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function parseJSONSafely(text: string): any {
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        console.error('JSON parse error:', e);
        return null;
    }
}

// ============================================
// CLAUDE API (Primary - Native PDF Support)
// ============================================

async function extractWithClaude(base64: string, mimeType: string, apiKey: string): Promise<any> {
    console.log('[Claude] Processing PDF natively...');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 8192,
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'document',
                        source: {
                            type: 'base64',
                            media_type: mimeType || 'application/pdf',
                            data: base64,
                        },
                    },
                    {
                        type: 'text',
                        text: EXTRACTION_PROMPT,
                    },
                ],
            }],
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API error ${response.status}: ${error}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '{}';

    console.log('[Claude] Response received, parsing...');
    return {
        result: parseJSONSafely(text),
        tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        provider: 'claude',
    };
}

// ============================================
// GEMINI API (Fallback - Page Images)
// ============================================

async function extractWithGemini(base64: string, mimeType: string, apiKey: string): Promise<any> {
    console.log('[Gemini] Processing as multimodal...');

    const GEMINI_MODEL = 'gemini-2.5-flash';  // Correct model name
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: EXTRACTION_PROMPT },
                    {
                        inline_data: {
                            mime_type: mimeType || 'application/pdf',
                            data: base64,
                        },
                    },
                ],
            }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${error}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    console.log('[Gemini] Response received, parsing...');
    return {
        result: parseJSONSafely(text),
        tokensUsed: data.usageMetadata?.totalTokenCount || 5000,
        provider: 'gemini',
    };
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    const startTime = Date.now();

    try {
        const { base64, filename, mimeType } = await req.json();

        if (!base64) {
            return new Response(
                JSON.stringify({ success: false, error: 'Missing PDF data' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
        }

        const pdfBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        const fileSize = pdfBytes.length;

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // ============================================
        // STAGE 1: CACHE CHECK
        // ============================================

        const contentHash = await hashContent(pdfBytes);
        console.log(`[Stage 1] Cache check: ${contentHash.slice(0, 16)}...`);

        const { data: cachedResult } = await supabase
            .from('pdf_extraction_cache')
            .select('*')
            .eq('content_hash', contentHash)
            .single();

        if (cachedResult) {
            console.log('[Stage 1] Cache HIT - 0 tokens');
            return new Response(
                JSON.stringify({
                    success: cachedResult.extracted_program !== null,
                    cached: true,
                    classification: cachedResult.classification,
                    program: cachedResult.extracted_program,
                    processingTimeMs: Date.now() - startTime,
                    tokensUsed: 0,
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log('[Stage 1] Cache MISS');

        // ============================================
        // STAGE 2: LLM EXTRACTION (Claude primary, Gemini fallback)
        // ============================================

        const claudeKey = Deno.env.get('ANTHROPIC_API_KEY');
        const geminiKey = Deno.env.get('GEMINI_API_KEY');

        let extraction: any = null;

        // Try Claude first (native PDF, highest accuracy)
        if (claudeKey) {
            try {
                extraction = await extractWithClaude(base64, mimeType, claudeKey);
            } catch (claudeError: any) {
                console.error('[Claude] Failed:', claudeError.message);
            }
        }

        // Fallback to Gemini
        if (!extraction && geminiKey) {
            try {
                extraction = await extractWithGemini(base64, mimeType, geminiKey);
            } catch (geminiError: any) {
                console.error('[Gemini] Failed:', geminiError.message);
            }
        }

        if (!extraction || !extraction.result) {
            throw new Error('All LLM providers failed');
        }

        const { result, tokensUsed, provider } = extraction;

        // Handle rejection
        if (!result.isWorkoutProgram || result.confidence < 0.5) {
            await supabase.from('pdf_extraction_cache').insert({
                content_hash: contentHash,
                file_size: fileSize,
                source_filename: filename,
                classification: { isWorkoutProgram: result.isWorkoutProgram, confidence: result.confidence, reason: result.reason },
                extracted_program: null,
                tokens_used: tokensUsed,
                processing_time_ms: Date.now() - startTime,
            });

            return new Response(
                JSON.stringify({
                    success: false,
                    rejected: true,
                    reason: result.reason || 'Not a workout program',
                    classification: { isWorkoutProgram: result.isWorkoutProgram, confidence: result.confidence },
                    provider,
                    processingTimeMs: Date.now() - startTime,
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Calculate stats
        const program = result.program;
        const totalExercises = program?.weeks?.reduce((sum: number, week: any) =>
            sum + (week.days?.reduce((daySum: number, day: any) =>
                daySum + (day.exercises?.length || 0), 0) || 0), 0) || 0;

        console.log(`[Success] ${provider}: ${program?.name}, ${totalExercises} exercises`);

        // Cache result
        await supabase.from('pdf_extraction_cache').insert({
            content_hash: contentHash,
            file_size: fileSize,
            source_filename: filename,
            classification: { isWorkoutProgram: true, confidence: result.confidence, reason: result.reason },
            extracted_program: program,
            tokens_used: tokensUsed,
            processing_time_ms: Date.now() - startTime,
        });

        return new Response(
            JSON.stringify({
                success: true,
                cached: false,
                provider,
                classification: { isWorkoutProgram: true, confidence: result.confidence },
                program,
                stats: {
                    totalExercises,
                    weeks: program?.weeks?.length || 0,
                    daysPerWeek: program?.daysPerWeek || 0,
                },
                processingTimeMs: Date.now() - startTime,
                tokensUsed,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error('PDF extraction error:', error);
        return new Response(
            JSON.stringify({ success: false, error: error.message || 'Failed to extract program' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }
});
