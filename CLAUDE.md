# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference

```bash
# Start development server (Expo)
npm start                    # Start with increased heap for large JSON files
npx expo start --clear       # Clear cache and start

# Run on device/simulator
npx expo run:ios             # iOS
npx expo run:android         # Android

# Linting
npm run lint                 # ESLint check

# Tests
npm test                     # Run integration tests
npm run test:watch           # Watch mode

# Database operations
npx prisma generate          # Generate Prisma client
npx prisma db push           # Push schema changes
npx supabase db push         # Push Supabase migrations
```

## Architecture Overview

This is a **React Native/Expo fitness app** using file-based routing (expo-router). Key architectural decisions:

### Layered Architecture

```
app/                    → Screens (expo-router pages)
components/             → Reusable UI components
lib/
  ├── context/         → React Context providers (auth, sync, preferences)
  ├── services/        → Business logic layer
  │   ├── exercise/    → Exercise database & search
  │   ├── programs/    → Program catalog management
  │   ├── voice/       → Voice command processing
  │   ├── coach/       → Coach workflow system
  │   └── sync/        → Supabase synchronization
  ├── machines/        → XState state machines (workout sessions)
  ├── hooks/           → Custom React hooks
  └── db/              → AsyncStorage persistence
constants/              → Design tokens (theme.ts)
supabase/
  ├── migrations/      → SQL migrations
  └── functions/       → Edge functions (Deno)
```

### State Management

The app uses a **layered state management** approach - no Redux/Zustand:

#### 1. XState Machines (Complex Workflows)

**Workout Sessions** (`lib/machines/workout-session.machine.ts`):
```
States: idle → active.exercising ⇄ active.resting → paused → finished
```

Events: `START_WORKOUT`, `COMPLETE_SET`, `START_REST`, `SKIP_REST`, `PAUSE`, `RESUME`, `FINISH_WORKOUT`, `CANCEL_WORKOUT`

Access via hook:
```typescript
import { useWorkoutMachineContext } from '@/lib/context/workout-machine-provider';

const { session, isResting, completeSet, startRest, skipRest } = useWorkoutMachineContext();
```

Other machines:
- `voice-builder.machine.ts` - Voice workout construction
- `voice-coordinator.machine.ts` - Voice session orchestration
- `sync-item.machine.ts` - Individual sync item state
- `superset.machine.ts` - Superset exercise flow

#### 2. React Context Providers (Global State)

All providers wrap app in `app/_layout.tsx`:

| Provider | Location | Purpose | Key Hook |
|----------|----------|---------|----------|
| `AuthProvider` | `lib/context/auth-context.tsx` | User auth, role, guest mode | `useAuth()`, `useUserId()` |
| `SyncProvider` | `lib/context/sync-context.tsx` | Supabase sync queue | `useSync()`, `useSyncStatus()` |
| `PreferencesProvider` | `lib/context/preferences-context.tsx` | Weight units, home gym | `usePreferences()` |
| `WorkoutMachineProvider` | `lib/context/workout-machine-provider.tsx` | XState machine | `useWorkoutMachineContext()` |
| `ModeProvider` | `lib/context/mode-context.tsx` | HOME/GYM/JURY mode | `useMode()` |
| `TabContextProvider` | `lib/context/tab-context.tsx` | Tab state, filters | `useTabContext()` |

#### 3. AsyncStorage Persistence (Local Data)

Storage layer in `lib/db/storage.ts`. Key prefixes:
```typescript
@workout_programs              // Saved programs
@workout_program_templates:*   // User customizations
@active_workout:*              // In-progress session (resume support)
@unified_workout_history       // Completed workout records
@workout_history:*             // Per-program completion tracking
```

Key functions:
```typescript
// Programs
getPrograms(), saveProgram(), updateProgram(), deleteProgram()

// Active workout (resume)
getActiveWorkoutState(userId, programId)
setActiveWorkoutState(userId, programId, state)
clearActiveWorkoutState(userId, programId)

// History
getUnifiedHistory(userId)
saveWorkoutToHistory(record)
getWorkoutStats(userId)  // totalWorkouts, thisWeek, currentStreak
```

#### 4. Sync Service (Remote Persistence)

`lib/services/sync/` handles Supabase synchronization:
- Queues workouts for sync when saved
- Retries with exponential backoff
- Offline support with pending queue
- Auto-syncs on auth state change

#### Data Flow Example (Completing a Set)
```
UI tap → useWorkoutMachineContext().completeSet()
       → XState sends COMPLETE_SET event
       → Machine updates context.session
       → React re-renders with new state
       → Periodically: setActiveWorkoutState() to AsyncStorage (crash recovery)
       → On finish: saveWorkoutToHistory() → syncService.queueWorkout()
```

### Navigation (expo-router)

Routes map directly to file structure:
- `app/(tabs)/` - Bottom tab screens (home, browse, explore)
- `app/(auth)/` - Auth flow (login, role selection)
- `app/coach/` - Coach-specific screens
- `app/workout/[id].tsx` - Active workout session
- `app/workout/[id]/summary.tsx` - Workout completion

The root layout (`app/_layout.tsx`) wraps the app in providers:
```
GestureHandlerRootView → AuthProvider → SyncProvider → PreferencesProvider → WorkoutMachineProvider
```

## Important Patterns

### Exercise Database

Exercises are loaded from bundled JSON (`data/hevy_complete_database.json`). The search system in `lib/services/exercise/` includes:
- Fuzzy matching with aliases
- Semantic search capabilities
- Category/equipment filtering

### Voice Processing

Voice commands flow through `lib/services/voice/`:
- `voice-direct-service.ts` - Main intent processing
- `modifier-matcher.ts` - Exercise modifiers (incline, close-grip)
- `vocabulary.ts` - Domain-specific vocabulary

### Supabase Integration

- Client: `lib/supabase/client.ts` (uses SecureStore for tokens)
- Edge functions: `supabase/functions/` (Deno runtime)
- Migrations: `supabase/migrations/` (run with `npx supabase db push`)

Environment variables:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### Theming

Design tokens in `constants/theme.ts`:
- `Colors.light` / `Colors.dark` - iOS system colors
- `Typography` - iOS HIG type scale
- `Spacing`, `Radius`, `Shadows` - Layout tokens

Access in components:
```typescript
const colorScheme = useColorScheme();
const colors = Colors[colorScheme ?? 'light'];
```

## Testing

Tests are in `__tests__/integration/`. The project uses Jest with ts-jest:
- Property-based tests (`.pbt.ts`) are excluded by default
- Module path ignores `continuous-claude/` to avoid collisions

## Path Alias

Use `@/` for absolute imports from project root:
```typescript
import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/context/auth-context';
```

## Key Files

- `app/_layout.tsx` - Root providers and navigation setup
- `lib/machines/workout-session.machine.ts` - Workout state machine
- `lib/context/auth-context.tsx` - Authentication state
- `lib/services/exercise/database.ts` - Exercise data access
- `constants/theme.ts` - Design system tokens
