# Voice Integration: Deep Dive & Strategy

## 1. Current State Evaluation
**Status**: Non-existent.
- A codebase scan for `voice`, `speech`, `audio`, `recording` returned 0 results.
- **Opportunity**: Green field implementation allows us to choose the optimal modern architecture without technical debt.

## 2. Strategic "Ultrathink": Efficiency & Performance
The user requirement emphasizes **energy efficiency** ("unplugged datacenters") and **cost**.

### Feature Comparison

| Feature | Option A: Standard Pipeline | Option B: "Ultrathink" (Gemini Flash) |
| :--- | :--- | :--- |
| **Architecture** | Audio -> Whisper API (STT) -> Text -> LLM (Intent) | Audio -> Gemini 1.5 Flash (Multimodal) |
| **API Calls** | 2 (Double latency overhead) | 1 (Single network request) |
| **Cost (per hour)** | ~$0.36 (Whisper) + LLM Input Tokens | ~$0.007 (Gemini Flash Audio Tokens) |
| **Energy** | Higher (Multiple hops, JSON parsing x2) | Lowest (Direct A-to-Z processing) |
| **Context** | Lost between STT and LLM often | Preserved (Tone, urgency, nuances) |

### The Winner: Direct Multimodal Intent
We will **not** use Whisper.
While Whisper is the gold standard for *transcription*, our goal is *extraction* (data entry).
Gemini 1.5 Flash natively understands audio signals. Sending the audio file directly to Gemini to extract JSON skips the text extraction step entirely.
- **50x Cheaper**: Audio tokens on Flash are negligibly priced compared to dedicated STT APIs.
- **Faster**: Removes the intermediate network hop and text decoding step.
- **Smarter**: Can interpret non-verbal cues or messy audio better in context of the instruction.

## 3. Implementation Plan

### Phase 1: Expo Go Audio Recorder (`app/features/voice`)
We need a robust recorder that works in Expo Go.
- **Library**: `expo-av` (Native compatibility confirmed).
- **Format**: `MPEG-4 AAC` (`.m4a`).
    - *Why?* High compression (small upload size = fast/cheap) with good enough quality for AI.
    - WAV is too large (energy hog on upload).
- **UX**: "Hold to Speak" or "Tap to Toggle".
- **Visuals**: Simple waveform visualization or pulsing indicator.

### Phase 2: Supabase Edge Function (`extract-workout-voice`)
Extend the existing Edge Function architecture.
- **Endpoint**: `functions/extract-workout-data` (Make it polymorphic).
- **Input**: Accept `audio/m4a` mimetype.
- **Logic**:
    - If Image/PDF -> parsing prompt.
    - If Audio -> transcription + parsing prompt.
    - *Prompt Engineering*: "You are an expert fitness tracker. Listen to this user log their workout. They might be out of breath. Extract the following exercises..."

### Phase 3: Frontend Integration
- Add a microphone button to the "Log Workout" screen.
- On finish, upload -> await JSON -> pre-fill the workout form.

### 3.1 Caching Strategy (Cost Optimization)
To address "similar enough things" and lower costs further:
1.  **Request Deduplication (Exact Match)**: 
    - Compute SHA-256 hash of the audio/image file on the Edge Function.
    - Check Supabase DB for existing `extraction_logs` with this hash.
    - If found, return stored JSON immediately (Cost: $0).
2.  **Context Caching (Gemini)**:
    - The System Prompt (which includes the schema and rules) is static.
    - Use **Gemini Context Caching** for the system instruction part.
    - *Benefit*: Reduces the cost of repeated large system prompts by ~50% for high-volume usage.


## 4. Risks & Mitigations
- **Audio File Size**: Restrict to 2 mins max (approx 1-2MB AAC).
- **Accents/Noise**: Gemini is robust, but we will add a fallback "Edit Text" intermediate step if confidence is low.
- **Privacy**: Audio is processed ephemerally in the Edge Function and not stored permanently unless requested.

## 5. Cost Analysis (1000 Workouts)
- **Whisper + GPT-4o**: $6.00+
- **Gemini Flash (Standard)**: $0.10
- **Gemini Flash (Cached)**: ~$0.05 (assuming high reuse of generic system prompt and some duplicate uploads).
- **Result**: **>99% Cost Reduction vs Standard.**

This is the "Air-tight" plan.
