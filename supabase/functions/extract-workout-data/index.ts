/**
 * Extract Workout Data - Unified Edge Function
 *
 * Polymorphic endpoint that handles:
 * - Images (PNG, JPG) - Visual workout extraction (Gemini)
 * - PDFs - Document parsing (Gemini)
 * - Audio (M4A, AAC) - Voice logging via Groq Whisper + Llama 3
 *
 * GROQ PIPELINE FOR AUDIO (Fast & Free):
 * 1. Audio -> Groq Whisper (transcription)
 * 2. Transcription -> Groq Llama 3.3 (extraction)
 *
 * This is extremely fast (sub-second) and has a generous free tier.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// PROMPTS
// ============================================

const IMAGE_PDF_PROMPT = `
You are an expert fitness data extractor. Extract a structured workout program from this image/PDF.

RETURN JSON ONLY. NO MARKDOWN BLOCKS.

Structure:
{
  "name": "Program Name",
  "weeks": [
    {
      "weekNumber": 1,
      "days": [
        {
          "dayNumber": 1,
          "name": "Leg Day",
          "exercises": [
            {
              "name": "Squat",
              "sets": 3,
              "reps": "5",
              "weight": "135 lbs",
              "restSeconds": 90,
              "notes": "Deep"
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- Infer explicit sets/reps. If a range (8-12), keep as string.
- If multiple weeks are present, extract them all.
- If weight is specified, include it.
- Ignore non-workout text (ads, intros).
`;

/**
 * Prompt for Llama 3 to extract workout data from transcribed text
 */
const AUDIO_EXTRACTION_PROMPT = `You are an expert fitness AI that extracts structured workout data from voice transcriptions.

TRANSCRIPTION:
"""
{TRANSCRIPTION}
"""

TASK: Parse the voice transcription and return a clean, normalized JSON structure.

===== OUTPUT FORMAT =====
RETURN JSON ONLY. NO MARKDOWN. NO EXPLANATIONS.

{
  "confidence": 0.95,
  "workoutName": "Push Day",
  "exercises": [
    {
      "nameRaw": "Bench Press",
      "sets": 3,
      "reps": "8",
      "weight": 135,
      "weightUnit": "lbs",
      "perSetDetails": [
        {"reps": "8", "weight": 135},
        {"reps": "8", "weight": 135},
        {"reps": "8", "weight": 135}
      ],
      "order": 1
    }
  ],
  "supersets": []
}

===== CRITICAL RULES =====

1. ALWAYS POPULATE perSetDetails ARRAY
   - perSetDetails must ALWAYS have exactly "sets" number of entries
   - Each entry needs: {"reps": "X", "weight": Y}
   - This is REQUIRED, never null

2. AUTOFILL MISSING DATA
   - If user says "5 sets at 135" → all 5 entries get weight: 135
   - If user says "135, 155, 175" for 5 sets → first 3 get those weights, sets 4-5 get 175 (last mentioned)
   - If user says "3 sets of 8, 6, 4 reps" → reps are 8, 6, 4 respectively
   - If only some reps mentioned → autofill remaining with the last mentioned rep count
   - If no weight mentioned → weight: null for all sets

3. NORMALIZE EXERCISE NAMES
   - "bench" → "Bench Press"
   - "squats" → "Barbell Squat"
   - "deads" → "Deadlift"
   - "OHP" → "Overhead Press"
   - "rows" → "Barbell Row"
   - "curls" → "Bicep Curl"
   - "RDLs" → "Romanian Deadlift"
   - "pullups" → "Pull Up"
   - "pushups" → "Push Up"
   - "hip thrust" → "Hip Thrust"
   - "lunges" → "Lunges"

4. WEIGHT UNIT INFERENCE
   - Default to "lbs" (US standard)
   - "60 kilos", "60 kg", "60 kgs" → weightUnit: "kg"
   - "bodyweight", "BW" → weight: null for each set

5. SETS/REPS DEFAULTS
   - If sets not mentioned → assume 3
   - If reps not mentioned → assume 10

6. SUPERSET DETECTION (CRITICAL!)
   - When user says "superset", "super set", "paired with", "back to back" → exercises are a superset
   - Add a "supersets" array with the exercise orders that are grouped together
   - Format: {"type": "superset", "exerciseOrders": [1, 2]}
   - The exerciseOrders correspond to the "order" field of exercises
   - "superset A with B" → group exercises A and B
   - "giant set" or 3+ exercises together → {"type": "giant_set", "exerciseOrders": [1, 2, 3]}

===== SUPERSET EXAMPLES =====

User: "I did a super set. First exercise was hip thrust 135 pounds for 10 reps, then lunges 10 lunges on each leg. Three total sets"
→ {
  "exercises": [
    {"nameRaw": "Hip Thrust", "sets": 3, "reps": "10", "weight": 135, "order": 1, "perSetDetails": [...]},
    {"nameRaw": "Lunges", "sets": 3, "reps": "10", "weight": null, "order": 2, "perSetDetails": [...]}
  ],
  "supersets": [{"type": "superset", "exerciseOrders": [1, 2]}]
}

User: "Superset bench press with dumbbell flies, 3 sets each"
→ {
  "exercises": [
    {"nameRaw": "Bench Press", "sets": 3, "order": 1, ...},
    {"nameRaw": "Dumbbell Fly", "sets": 3, "order": 2, ...}
  ],
  "supersets": [{"type": "superset", "exerciseOrders": [1, 2]}]
}

User: "Giant set: curls, skull crushers, and hammer curls"
→ {
  "exercises": [
    {"nameRaw": "Bicep Curl", "order": 1, ...},
    {"nameRaw": "Skull Crusher", "order": 2, ...},
    {"nameRaw": "Hammer Curl", "order": 3, ...}
  ],
  "supersets": [{"type": "giant_set", "exerciseOrders": [1, 2, 3]}]
}

===== OTHER EXAMPLES =====

User: "Bench press 3 sets at 135"
→ perSetDetails: [{"reps":"10","weight":135},{"reps":"10","weight":135},{"reps":"10","weight":135}]

User: "Squats 135, 185, 225, 275, 315 for 5 reps each"
→ perSetDetails: [{"reps":"5","weight":135},{"reps":"5","weight":185},{"reps":"5","weight":225},{"reps":"5","weight":275},{"reps":"5","weight":315}]

User: "Did some pull ups, 3 sets"
→ perSetDetails: [{"reps":"10","weight":null},{"reps":"10","weight":null},{"reps":"10","weight":null}]

===== FINAL CHECKLIST =====
✓ perSetDetails has exactly "sets" entries
✓ Each entry has reps and weight (weight can be null)
✓ Missing data is autofilled using last known value
✓ Exercise names are normalized to full names
✓ Weight unit defaults to "lbs"
✓ Supersets array populated when exercises are grouped together
✓ Return valid JSON only`;

// ============================================
// CACHING
// ============================================

async function hashContent(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkCache(supabase: any, hash: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('extraction_cache')
      .select('result, hit_count')
      .eq('content_hash', hash)
      .single();

    if (error || !data) return null;

    await supabase
      .from('extraction_cache')
      .update({
        hit_count: (data.hit_count || 0) + 1,
        last_accessed_at: new Date().toISOString(),
      })
      .eq('content_hash', hash);

    console.log(`Cache HIT for hash ${hash.slice(0, 8)}...`);
    return data.result;
  } catch {
    return null;
  }
}

async function saveToCache(supabase: any, hash: string, mimeType: string, result: any): Promise<void> {
  try {
    await supabase.from('extraction_cache').upsert({
      content_hash: hash,
      mime_type: mimeType,
      result,
      hit_count: 1,
      created_at: new Date().toISOString(),
      last_accessed_at: new Date().toISOString(),
    });
    console.log(`Cached result for hash ${hash.slice(0, 8)}...`);
  } catch (err) {
    console.warn('Failed to cache result:', err);
  }
}

// ============================================
// MIME TYPE DETECTION
// ============================================

type ContentCategory = 'audio' | 'image' | 'pdf' | 'unknown';

function categorizeContent(mimeType: string): ContentCategory {
  const normalized = mimeType.toLowerCase();

  if (normalized.startsWith('audio/') ||
    normalized.includes('m4a') ||
    normalized.includes('aac') ||
    normalized.includes('mp4') && normalized.includes('audio')) {
    return 'audio';
  }

  if (normalized.startsWith('image/') ||
    normalized.includes('png') ||
    normalized.includes('jpeg') ||
    normalized.includes('jpg') ||
    normalized.includes('webp')) {
    return 'image';
  }

  if (normalized.includes('pdf')) {
    return 'pdf';
  }

  return 'unknown';
}

// ============================================
// GROQ API FUNCTIONS
// ============================================

/**
 * Transcribe audio using Groq's Whisper API
 */
async function transcribeWithGroqWhisper(
  audioData: Uint8Array,
  mimeType: string,
  groqApiKey: string
): Promise<string> {
  // Create form data with the audio file
  const formData = new FormData();

  // Determine file extension from mime type
  let extension = 'm4a';
  if (mimeType.includes('webm')) extension = 'webm';
  else if (mimeType.includes('wav')) extension = 'wav';
  else if (mimeType.includes('mp3')) extension = 'mp3';

  const blob = new Blob([audioData], { type: mimeType });
  formData.append('file', blob, `audio.${extension}`);
  formData.append('model', 'whisper-large-v3');
  formData.append('response_format', 'text');
  formData.append('language', 'en');

  console.log('Calling Groq Whisper for transcription...');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqApiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Groq Whisper error:', errorText);
    throw new Error(`Whisper transcription failed: ${response.status} - ${errorText}`);
  }

  const transcription = await response.text();
  console.log('Transcription:', transcription.slice(0, 100) + '...');

  return transcription;
}

/**
 * Extract workout data from transcription using Groq Llama 3
 */
async function extractWithGroqLlama(
  transcription: string,
  context: any,
  groqApiKey: string
): Promise<any> {
  // Build prompt with transcription
  let prompt = AUDIO_EXTRACTION_PROMPT.replace('{TRANSCRIPTION}', transcription);

  // Add context if provided
  if (context?.workoutName) {
    prompt += `\n\nCONTEXT: User is logging "${context.workoutName}"`;
  }
  if (context?.previousExercises?.length) {
    prompt += `\nPrevious exercises in this session: ${context.previousExercises.join(', ')}`;
  }
  if (context?.weightUnit) {
    prompt += `\nUser prefers ${context.weightUnit} for weights.`;
  }

  console.log('Calling Groq Llama 3.3 for extraction...');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are an expert fitness data extractor. Return valid JSON only, no markdown.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Groq Llama error:', errorText);
    throw new Error(`Llama extraction failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || '';

  // Parse JSON from response
  const cleanJson = content
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  return JSON.parse(cleanJson);
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // 1. Get API keys
    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    const geminiKey = Deno.env.get('GEMINI_API_KEY');

    if (!groqApiKey) {
      throw new Error('Missing GROQ_API_KEY configuration');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = supabaseUrl && supabaseKey
      ? createClient(supabaseUrl, supabaseKey)
      : null;

    // 2. Parse request
    const contentType = req.headers.get('content-type') || '';
    let fileData: Uint8Array;
    let mimeType: string;
    let context: any = {};

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file');

      if (!file || !(file instanceof File)) {
        throw new Error('No file uploaded');
      }

      fileData = new Uint8Array(await file.arrayBuffer());
      mimeType = file.type || 'application/octet-stream';

      const contextStr = formData.get('context');
      if (contextStr && typeof contextStr === 'string') {
        try {
          context = JSON.parse(contextStr);
        } catch { }
      }
    } else if (contentType.includes('application/json')) {
      const json = await req.json();
      if (json.base64 && json.type) {
        fileData = Uint8Array.from(atob(json.base64), c => c.charCodeAt(0));
        mimeType = json.type;
        context = json.context || {};
      } else {
        throw new Error('Invalid JSON format. Expected { base64, type, context? }');
      }
    } else {
      throw new Error('Unsupported content type. Use multipart/form-data or application/json');
    }

    // 3. Categorize content
    const category = categorizeContent(mimeType);
    console.log(`Processing ${category} content (${mimeType}, ${fileData.length} bytes)`);

    if (category === 'unknown') {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }

    // 4. Check cache
    const contentHash = await hashContent(fileData);
    if (supabase) {
      const cached = await checkCache(supabase, contentHash);
      if (cached) {
        return new Response(
          JSON.stringify({
            ...cached,
            metadata: {
              ...cached.metadata,
              cached: true,
              processingTimeMs: Date.now() - startTime,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    let parsedData: any;
    let tokensUsed = 0;

    // 5. Process based on content type
    if (category === 'audio') {
      // GROQ PIPELINE: Whisper -> Llama 3
      const transcription = await transcribeWithGroqWhisper(fileData, mimeType, groqApiKey);

      if (!transcription || transcription.trim().length === 0) {
        throw new Error('No speech detected in audio. Please try again.');
      }

      parsedData = await extractWithGroqLlama(transcription, context, groqApiKey);
      parsedData.transcription = transcription; // Include for debugging

    } else {
      // IMAGE/PDF: Use Gemini (if available)
      if (!geminiKey) {
        throw new Error('Missing GEMINI_API_KEY for image/PDF processing');
      }

      // Dynamic import for Gemini
      const { GoogleGenerativeAI } = await import('npm:@google/generative-ai');
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash-001',
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      });

      // Convert to base64 (chunk-based to avoid stack overflow)
      function uint8ToBase64(bytes: Uint8Array): string {
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize);
          for (let j = 0; j < chunk.length; j++) {
            binary += String.fromCharCode(chunk[j]);
          }
        }
        return btoa(binary);
      }
      const base64Data = uint8ToBase64(fileData);

      const result = await model.generateContent([
        IMAGE_PDF_PROMPT,
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
      ]);

      const responseText = result.response.text();
      tokensUsed = result.response.usageMetadata?.totalTokenCount || 0;

      const cleanJson = responseText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      parsedData = JSON.parse(cleanJson);
    }

    // 6. Validate exercises for audio
    if (category === 'audio' && (!parsedData.exercises || parsedData.exercises.length === 0)) {
      throw new Error('No exercises were detected. Please try again and clearly state your exercises.');
    }

    // 7. Add metadata
    const finalResult = {
      ...parsedData,
      metadata: {
        contentType: category,
        mimeType,
        tokensUsed,
        processingTimeMs: Date.now() - startTime,
        cached: false,
        provider: category === 'audio' ? 'groq' : 'gemini',
      },
    };

    // 8. Cache result
    if (supabase) {
      await saveToCache(supabase, contentHash, mimeType, finalResult);
    }

    // 9. Return response
    return new Response(JSON.stringify(finalResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Extraction error:', error);

    const errorResponse = {
      success: false,
      error: {
        code: 'extraction_failed',
        message: error.message || 'Unknown error',
        recoverable: true,
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
