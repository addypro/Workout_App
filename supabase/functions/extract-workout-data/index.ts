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
// CHUNK SESSION STORAGE
// ============================================

/**
 * In-memory storage for chunk upload sessions.
 * Each session collects base64 chunks that are concatenated on final request.
 * Sessions expire after 5 minutes.
 */
interface ChunkSession {
  chunks: Map<number, string>; // chunkIndex -> base64 data
  mimeType: string;
  context: any;
  createdAt: number;
  totalChunks?: number;
}

const chunkSessions = new Map<string, ChunkSession>();
const CHUNK_SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Clean up expired sessions
 */
function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [sessionId, session] of chunkSessions.entries()) {
    if (now - session.createdAt > CHUNK_SESSION_TTL_MS) {
      chunkSessions.delete(sessionId);
      console.log(`[Chunks] Expired session ${sessionId}`);
    }
  }
}

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

3. EXERCISE NAME HANDLING - USE HEVY FORMAT!
   
   OUTPUT FORMAT: "Exercise Name (Equipment)" - Equipment in parentheses at end
   
   A. CONVERT TO HEVY FORMAT:
      Examples:
      - "alternating dumbbell curl bicep" → "Bicep Curl - Alternating (Dumbbell)"
      - "seated cable row back" → "Seated Row (Cable)"  
      - "incline press dumbbell" → "Incline Press (Dumbbell)"
      - "lat pulldown cable" → "Lat Pulldown (Cable)"
      - "chest fly machine" → "Chest Fly (Machine)"
      - "barbell curl standing" → "Bicep Curl (Barbell)"
      - "bench press" → "Bench Press (Barbell)"
      - "dumbbell row" → "Row (Dumbbell)"
   
   B. EXPAND ABBREVIATIONS:
      - "bench" → "Bench Press (Barbell)"
      - "deads" → "Deadlift (Barbell)"
      - "OHP" → "Overhead Press (Barbell)"
      - "RDLs" → "Romanian Deadlift (Barbell)"
      - "pullups" / "pull ups" → "Pull Up"
      - "pushups" / "push ups" → "Push Up"
      - "db" → "(Dumbbell)"
      - "bb" → "(Barbell)"
      
   C. PRESERVE SPECIFIC EXERCISE NAMES:
      - "Meadows Row" → "Meadows Row (Barbell)"
      - "Pendlay Row" → "Pendlay Row (Barbell)"
      - "T-Bar Row" → "T-Bar Row"
      - "Hammer Curl" → "Hammer Curl (Dumbbell)"
      - "Preacher Curl" → "Preacher Curl (Barbell)"
      - "Spider Curl" → "Spider Curl (Dumbbell)"
      
   D. INFER EQUIPMENT FROM CONTEXT:
      - If user says "chest press machine" → "Chest Press (Machine)"
      - If user says just "chest press" → "Chest Press" (keep ambiguous)
      - If user says "bench press 135" → "Bench Press (Barbell)" (heavy = barbell)
      - If user says "bench press 25s" → "Bench Press (Dumbbell)" (25s = per hand)
      
   E. BODYWEIGHT EXERCISES - NO EQUIPMENT SUFFIX:
      - "Pull Up", "Push Up", "Dip", "Plank" (no parentheses)
      - "Squat Row" (bodyweight full-body movement)

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

===== COMPLEX PER-SET EXAMPLES =====

User: "Deadlift: first set 135 for 10, second set 225 for 8, third set 315 for 5, fourth set 365 for 3"
→ sets: 4, perSetDetails: [{"reps":"10","weight":135},{"reps":"8","weight":225},{"reps":"5","weight":315},{"reps":"3","weight":365}]

User: "Squats: 135 for 12, 185 for 10, 225 for 8, 275 for 6, 315 for 4, 365 for 2"
→ sets: 6, perSetDetails: [{"reps":"12","weight":135},{"reps":"10","weight":185},{"reps":"8","weight":225},{"reps":"6","weight":275},{"reps":"4","weight":315},{"reps":"2","weight":365}]

User: "Bench: 135 times 10, 155 times 8, 175 times 6, 185 times 4"
→ sets: 4, perSetDetails: [{"reps":"10","weight":135},{"reps":"8","weight":155},{"reps":"6","weight":175},{"reps":"4","weight":185}]

User: "I did 5 sets of squats. 135 for 8, then 185 for 8, 225 for 6, 275 for 4, and 315 for 2"
→ sets: 5, perSetDetails: [{"reps":"8","weight":135},{"reps":"8","weight":185},{"reps":"6","weight":225},{"reps":"4","weight":275},{"reps":"2","weight":315}]

User: "Leg press: 4 plates for 15, 6 plates for 12, 8 plates for 10, back down to 4 plates for 20"
→ sets: 4, perSetDetails: [{"reps":"15","weight":180},{"reps":"12","weight":270},{"reps":"10","weight":360},{"reps":"20","weight":180}]
(Note: Convert plate count to weight: 1 plate = 45lbs per side = 90lbs total, so "4 plates" = 180lbs)

User: "Rows: 95 for 12, 115 for 10, 135 for 8"
→ sets: 3, perSetDetails: [{"reps":"12","weight":95},{"reps":"10","weight":115},{"reps":"8","weight":135}]

===== KEY PARSING PATTERNS =====

Pattern 1 - "WEIGHT for REPS": "135 for 10" → {"reps":"10","weight":135}
Pattern 2 - "WEIGHT times REPS": "185 times 8" → {"reps":"8","weight":185}
Pattern 3 - "REPS at WEIGHT": "10 reps at 135" → {"reps":"10","weight":135}
Pattern 4 - "REPS WEIGHT": "8 at 225" → {"reps":"8","weight":225}
Pattern 5 - Ordinal: "first set 135 for 10, second set 185 for 8" → two entries

===== FINAL CHECKLIST =====
✓ perSetDetails has exactly "sets" entries
✓ Each entry has reps and weight (weight can be null)
✓ Listen for EACH set described - don't collapse to single weight
✓ Count the number of weight/rep pairs mentioned to determine sets
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

function sniffAudioMimeType(data: Uint8Array): string | null {
  if (data.length < 12) return null;

  // WAV: "RIFF" .... "WAVE"
  if (
    data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
    data[8] === 0x57 && data[9] === 0x41 && data[10] === 0x56 && data[11] === 0x45
  ) {
    return 'audio/wav';
  }

  // MP3: "ID3" or frame sync 0xFF 0xFB/0xF3/0xF2
  if (
    (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) ||
    (data[0] === 0xff && (data[1] & 0xe0) === 0xe0)
  ) {
    return 'audio/mpeg';
  }

  // WebM/Matroska: EBML header
  if (data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3) {
    return 'audio/webm';
  }

  // MP4/M4A: "ftyp" at offset 4
  if (data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70) {
    return 'audio/mp4';
  }

  return null;
}

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
 * Transcribe audio using Deepgram API (fallback when Groq rate limited)
 * 45 hrs/month free tier
 */
async function transcribeWithDeepgram(
  audioData: Uint8Array,
  mimeType: string,
  deepgramApiKey: string
): Promise<string> {
  // Determine encoding from mime type
  let encoding = 'mp4';
  if (mimeType.includes('webm')) encoding = 'webm';
  else if (mimeType.includes('wav')) encoding = 'wav';
  else if (mimeType.includes('mp3')) encoding = 'mp3';
  else if (mimeType.includes('m4a')) encoding = 'mp4';

  console.log('Calling Deepgram for transcription (fallback)...');

  const response = await fetch(
    'https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&language=en',
    {
      method: 'POST',
      headers: {
        'Authorization': `Token ${deepgramApiKey}`,
        'Content-Type': mimeType,
      },
      body: audioData,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Deepgram error:', errorText);
    throw new Error(`Deepgram transcription failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const transcription = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
  console.log('Deepgram Transcription:', transcription.slice(0, 100) + '...');

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

  const parsed = JSON.parse(cleanJson);

  // Detailed logging for debugging
  console.log('=== EXTRACTION RESULT ===');
  console.log('Exercises found:', parsed.exercises?.length || 0);
  if (parsed.exercises) {
    parsed.exercises.forEach((ex: any, i: number) => {
      console.log(`  [${i + 1}] ${ex.nameRaw}: ${ex.sets} sets`);
      if (ex.perSetDetails) {
        console.log(`      perSetDetails (${ex.perSetDetails.length} entries):`);
        ex.perSetDetails.forEach((sd: any, j: number) => {
          console.log(`        Set ${j + 1}: ${sd.reps} reps @ ${sd.weight ?? 'bodyweight'}`);
        });
      } else {
        console.log(`      weight: ${ex.weight}, reps: ${ex.reps}`);
      }
    });
  }
  if (parsed.supersets?.length) {
    console.log('Supersets:', JSON.stringify(parsed.supersets));
  }
  console.log('=========================');

  return parsed;
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

      // CHUNK MODE: Collect chunks for parallel upload
      if (json.mode === 'chunk') {
        const { sessionId, chunkIndex, base64, type, context: chunkContext, isFinal, totalChunks } = json;

        if (!sessionId || chunkIndex === undefined || !base64) {
          throw new Error('Chunk mode requires: sessionId, chunkIndex, base64');
        }

        // Clean up expired sessions periodically
        cleanupExpiredSessions();

        // Get or create session
        let session = chunkSessions.get(sessionId);
        if (!session) {
          session = {
            chunks: new Map(),
            mimeType: type || 'audio/mp4',
            context: chunkContext || {},
            createdAt: Date.now(),
            totalChunks,
          };
          chunkSessions.set(sessionId, session);
          console.log(`[Chunks] New session ${sessionId}`);
        }

        // Store chunk
        session.chunks.set(chunkIndex, base64);
        console.log(`[Chunks] Session ${sessionId}: chunk ${chunkIndex} received (${session.chunks.size}/${totalChunks || '?'} chunks)`);

        // If not final, return acknowledgment
        if (!isFinal) {
          return new Response(
            JSON.stringify({
              success: true,
              mode: 'chunk',
              sessionId,
              chunkIndex,
              chunksReceived: session.chunks.size,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // FINAL: Concatenate all chunks in order
        console.log(`[Chunks] Session ${sessionId}: final chunk received, concatenating ${session.chunks.size} chunks`);
        const sortedIndices = [...session.chunks.keys()].sort((a, b) => a - b);
        const fullBase64 = sortedIndices.map(i => session!.chunks.get(i)).join('');

        fileData = Uint8Array.from(atob(fullBase64), c => c.charCodeAt(0));
        mimeType = session.mimeType;
        context = session.context;

        // Clean up session
        chunkSessions.delete(sessionId);
        console.log(`[Chunks] Session ${sessionId}: complete, ${fileData.length} bytes`);

      } else if (json.base64 && json.type) {
        // STANDARD MODE: Single upload
        fileData = Uint8Array.from(atob(json.base64), c => c.charCodeAt(0));
        mimeType = json.type;
        context = json.context || {};
      } else {
        throw new Error('Invalid JSON format. Expected { base64, type, context? } or { mode: "chunk", ... }');
      }
    } else {
      throw new Error('Unsupported content type. Use multipart/form-data or application/json');
    }

    const sniffedMime = sniffAudioMimeType(fileData);
    if (sniffedMime && sniffedMime !== mimeType) {
      console.log(`[Mime] Sniffed ${sniffedMime} (was ${mimeType})`);
      mimeType = sniffedMime;
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
      // API KEYS: Primary + Secondary Groq, Deepgram fallback
      const groqApiKey2 = Deno.env.get('GROQ_API_KEY_2');
      const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY');

      // TRANSCRIPTION: Try Groq Key1 → Key2 → Deepgram
      let transcription: string;
      let usedGroqKey = groqApiKey; // Track which key worked

      try {
        // Primary: Groq Whisper Key 1
        console.log('Trying Groq Whisper (Key 1)...');
        transcription = await transcribeWithGroqWhisper(fileData, mimeType, groqApiKey);
      } catch (groqError1: any) {
        console.warn('Groq Key 1 failed:', groqError1.message);

        // Try Key 2
        if (groqApiKey2) {
          try {
            console.log('Trying Groq Whisper (Key 2)...');
            transcription = await transcribeWithGroqWhisper(fileData, mimeType, groqApiKey2);
            usedGroqKey = groqApiKey2; // Use Key 2 for Llama too
          } catch (groqError2: any) {
            console.warn('Groq Key 2 failed:', groqError2.message);

            // Final fallback: Deepgram
            if (!deepgramApiKey) {
              throw new Error('All Groq keys rate limited and no DEEPGRAM_API_KEY configured');
            }
            console.log('Using Deepgram Nova-3 fallback...');
            transcription = await transcribeWithDeepgram(fileData, mimeType, deepgramApiKey);
          }
        } else {
          // No Key 2, try Deepgram
          if (!deepgramApiKey) {
            throw new Error('Groq rate limited and no fallback configured');
          }
          console.log('Using Deepgram Nova-3 fallback...');
          transcription = await transcribeWithDeepgram(fileData, mimeType, deepgramApiKey);
        }
      }

      if (!transcription || transcription.trim().length === 0) {
        throw new Error('No speech detected in audio. Please try again.');
      }

      // EXTRACTION: Try Groq Llama (with working key) → Gemini Flash fallback
      try {
        console.log('Extracting with Groq Llama 3.3...');
        parsedData = await extractWithGroqLlama(transcription, context, usedGroqKey);
      } catch (llamaError: any) {
        console.warn('Groq Llama failed, trying Gemini Flash:', llamaError.message);

        // Fallback to Gemini Flash for extraction
        if (!geminiKey) {
          throw new Error('Groq Llama rate limited and no GEMINI_API_KEY configured');
        }

        const { GoogleGenerativeAI } = await import('npm:@google/generative-ai');
        const genAI = new GoogleGenerativeAI(geminiKey);
        const geminiModel = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash-001',
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
        });

        // Build prompt for Gemini
        let geminiPrompt = AUDIO_EXTRACTION_PROMPT.replace('{TRANSCRIPTION}', transcription);
        if (context?.workoutName) {
          geminiPrompt += `\n\nCONTEXT: User is logging "${context.workoutName}"`;
        }

        console.log('Extracting with Gemini Flash...');
        const geminiResult = await geminiModel.generateContent(geminiPrompt);
        const geminiText = geminiResult.response?.text() || '{}';
        parsedData = parseJSONSafely(geminiText);
      }

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
