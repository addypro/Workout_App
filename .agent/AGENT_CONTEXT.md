# Workout App - Agent Quick Context

> **Purpose**: Get a new Claude agent up to speed on this codebase in under 2 minutes.

---
Stack: Expo + Expo Router, npm, Jest.

Existing: Program templates exist, program import exists.

Path integration surfaces: /explore, /challenges, /workout/[id]/summary, /leagues, /onboarding/screener.

## What Is This App?

A **React Native/Expo fitness app** with:

- **Voice-powered workout logging** (say "bench press 3 sets of 10 at 135")
- **Coach/Athlete dual roles** (coaches create programs, athletes follow them)
- **Offline-first sync** to Supabase
- **XState machines** for complex workout state management

---

## Tech Stack At A Glance

| Layer | Tech |
|-------|------|
| Framework | Expo SDK 54, React Native 0.81 |
| Routing | Expo Router (file-based) |
| State | XState v5 + React Context |
| Backend | Supabase (Postgres + Edge Functions) |
| Voice | expo-speech-recognition + AI parsing |
| Styling | React Native StyleSheet (no Tailwind) |

---

## Directory Quick Reference

```
app/                 # Screens (Expo Router - file = route)
├── (tabs)/          # Bottom tab screens (Home, Browse, Coach, Tools)
├── (auth)/          # Login, role selection
├── workout/         # Active workout, summary, voice builder
├── coach/           # Coach dashboard, program builder, athletes
└── settings/        # App settings

components/          # Reusable UI components
├── workout/         # Set rows, superset cards, PR celebration
├── exercise/        # Exercise cards, GIFs, disambiguation
├── voice/           # Recording UI, voice modal
└── ui/              # Generic cards, inputs, skeletons

lib/                 # Core business logic (THE IMPORTANT STUFF)
├── machines/        # XState state machines ⭐
├── services/        # Domain services ⭐
├── context/         # React Context providers
├── types/           # TypeScript types
└── hooks/           # Custom React hooks

data/                # Static JSON databases (exercises, programs)
supabase/            # Edge functions & migrations
```

---

## Key Files You'll Work With

### State Machines (lib/machines/)

| File | Purpose |
|------|---------|
| `workout-session.machine.ts` | Main workout flow (start → exercise → rest → finish) |
| `rest-timer.actor.ts` | Rest period countdown |
| `voice-builder.machine.ts` | Voice-controlled workout creation |
| `use-workout-machine.ts` | React hook to use workout machine |

### Services (lib/services/)

| Directory | Purpose |
|-----------|---------|
| `exercise/` | Search, match, resolve exercise names |
| `voice/` | STT, parsing, UFIRE scoring |
| `sync/` | Offline queue, Supabase sync |
| `programs/` | Program CRUD, Kaggle data |
| `coach/` | Coach-athlete relationships |

### Contexts (lib/context/)

| File | Key Hook |
|------|----------|
| `auth-context.tsx` | `useAuth()`, `useUserId()` |
| `preferences-context.tsx` | `usePreferences()` (weight unit, home gym) |
| `sync-context.tsx` | `useSync()`, `useSyncStatus()` |
| `mode-context.tsx` | `useMode()` (workout vs rest mode) |
| `workout-machine-provider.tsx` | `useWorkoutMachineContext()` |

---

## Exercise Service Architecture

The exercise system has multiple layers for matching user input to exercises:

```
User Input: "incline bench"
    ↓
1. database.ts       → Exact name lookup
    ↓
2. search.ts         → Advanced search with filters
    ↓
3. semantic-search.ts → Fuzzy/embedding matching
    ↓
4. matcher.ts        → Name resolution
    ↓
5. resolver.ts       → Canonical name + scoring
```

**Key functions:**

- `searchExercisesAdvanced()` - Main search entry point
- `resolveExercise()` - Get best match with confidence
- `matchExerciseName()` - Fuzzy match a name

---

## Voice Service Architecture

Voice input flows through multiple processing stages:

```
Speech → STT → Enhanced Parser → UFIRE Scoring → Result
```

**UFIRE = User Frequency, Intent, Recency, Experience**

| Component | File | Purpose |
|-----------|------|---------|
| Recording | `voice-direct-service.ts` | Native STT |
| Parsing | `enhanced-parser.ts` | Extract exercise + sets + weight |
| Scoring | `ufire/scoring-engine.ts` | Rank matches by user history |
| Context | `ufire/contextual-flow.ts` | Predict next exercise based on workout |

---

## Type System Conventions

### Branded IDs (lib/types/brands.ts)

IDs are branded to prevent mixing them up:

```typescript
type ExerciseId = string & { __brand: 'ExerciseId' }
type ProgramId = string & { __brand: 'ProgramId' }

// Create with:
createExerciseId()  // generates nanoid
parseExerciseId("abc123")  // validates existing

// NEVER do: exercise.id = "abc123" (loses brand)
```

### Result Types (lib/types/result-types.ts)

Voice parsing uses discriminated unions:

```typescript
type ParseResult =
  | { type: 'success', data: Exercise }
  | { type: 'clarification', options: Exercise[] }
  | { type: 'failure', error: string }
```

---

## Common Patterns

### Adding an exercise to workout

```typescript
const { addExercise } = useWorkoutMachineContext();
addExercise({
  exerciseId: parseExerciseId(id),
  name: "Bench Press",
  sets: [createWorkoutSet()]
});
```

### Searching exercises

```typescript
import { searchExercisesAdvanced } from '@/lib/services/exercise/search';

const results = await searchExercisesAdvanced(
  "bench press",
  { equipment: ['barbell'], bodyRegion: 'chest' }
);
```

### Using voice input

```typescript
import { parseVoiceCommand } from '@/lib/services/voice/enhanced-parser';

const result = await parseVoiceCommand("bench 3 sets 10 reps 135 pounds");
if (result.type === 'success') {
  // Add to workout
} else if (result.type === 'clarification') {
  // Show options to user
}
```

---

## Database / Data Sources

| Source | Location | Content |
|--------|----------|---------|
| Hevy Primary | `data/hevy-primary-database.json` | Main exercise DB |
| ExerciseDB | `data/exercisedb-cache.json` | GIF demos |
| Programs | `lib/services/programs/data/` | Built-in programs |
| Supabase | Remote | User data, workouts, sync |

---

## Environment & Running

```bash
# Install
npm install

# Run iOS
npm run ios

# Run Android
npm run android

# Run tests
npm test
```

**Supabase**: Requires `.env` with `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

---

## Current Git State

Branch: `2025-12-15-86q0` (feature branch off `master`)

Key recent changes:

- Ghost Mode + Location-based Gym Picker + PR Detection
- Coach Workflow System (Phase 1-6)
- Voice logging improvements
- Browse screen filtering enhancements

---

## Quick Debugging Tips

1. **Workout not starting?** Check `workout-session.machine.ts` state transitions
2. **Exercise not found?** Check `searchExercisesAdvanced()` in `search.ts`
3. **Voice not recognizing?** Check `enhanced-parser.ts` and UFIRE scoring
4. **Sync failing?** Check `sync-context.tsx` and `workout-sync.ts`
5. **Auth issues?** Check `auth-context.tsx` and Supabase auth

---

## Related Documentation

- [ARCHITECTURE_MAP.md](.agent/ARCHITECTURE_MAP.md) - Visual code architecture
- [NAVIGATION_MAP.md](.agent/NAVIGATION_MAP.md) - Screen navigation flows
- [VOICE_PLAN.md](VOICE_PLAN.md) - Voice feature roadmap
- [DEAD_CODE_REPORT.md](DEAD_CODE_REPORT.md) - Cleanup targets

---

## Need More Context?

Run these commands:

```bash
# Get code structure
tldr structure lib/services/exercise --lang typescript

# Get function details
tldr extract lib/services/exercise/search.ts

# Find usages
tldr impact searchExercisesAdvanced lib/
```
