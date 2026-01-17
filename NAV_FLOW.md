# Workout App - Navigation & Data Flow Map

**Generated:** 2026-01-16
**Branch:** audit/2026-01-16-workoutkey
**Purpose:** Verified route map, dataflow, and source discrimination call-sites

---

## 1. WORKOUT ENTRY POINTS (Routes)

### 1.1 Self Workouts (source: 'self')

| Entry Point | Route | File:Line | Notes |
|-------------|-------|-----------|-------|
| **Quick Workout** | `/workout/quick` | `app/workout/quick.tsx` | Voice or manual, no program |
| **Voice Builder** | `/workout/voice-builder` | `app/workout/voice-builder.tsx` | Streaming voice input |
| **Program Start** | `/workout/[id]/preview` → `/workout/[id]` | `app/workout/[id]/preview.tsx` | From browse tab |
| **Resume Self** | `/workout/[programId]?source=self` | `components/workout/resume-hero-card.tsx:67` | Resume hero card (✅ FIXED) |

### 1.2 Assigned Workouts (source: 'assigned')

| Entry Point | Route | File:Line | Notes |
|-------------|-------|-----------|-------|
| **Coach Assigns** | `/coach/assign-workout` → athlete sees in feed | `app/coach/assign-workout.tsx` | One-off workout |
| **Program Assignment** | `/coach/assign-program` → athlete sees program | `app/coach/assign-program.tsx` | Full program |
| **Resume Assigned** | `/workout/[assignedId]?source=assigned&assignedWorkoutId=[assignedId]` | `components/workout/resume-hero-card.tsx:64` | Resume hero card (✅ FIXED) |

### 1.3 Route Parameters (Workout Screen)

**Expected params** (`app/workout/[id].tsx:89`):
```typescript
const { id, week, day, quick, repeatFrom, source, assignedWorkoutId } = useLocalSearchParams();
const sourceParam = Array.isArray(source) ? source[0] : source;
const isAssignedWorkout = sourceParam === 'assigned';
```

**Route shapes:**
- Self: `/workout/[programId]?source=self`
- Assigned: `/workout/[assignedWorkoutId]?source=assigned&assignedWorkoutId=[assignedWorkoutId]`

---

## 2. ACTIVE SESSION STORAGE (AsyncStorage)

### 2.1 Storage Key Structure (Namespaced by Source)

**Function:** `activeWorkoutKey(userId: string, source: WorkoutSource, workoutKey: string)`
**Location:** `lib/db/storage.ts:865`

```typescript
return `@active_workout:${userId}:${source}:${workoutKey}`;
```

**Examples:**
- Self: `@active_workout:user-123:self:program-abc`
- Assigned: `@active_workout:user-123:assigned:assigned-workout-xyz`

**Migration Strategy:** Backward-compatible lazy migration
- **Read:** Try new format → fallback to legacy `@active_workout:{userId}:{workoutKey}` → migrate immediately
- **Write:** Always use new format with source namespace
- **Clear:** Clears both new and legacy formats (if they exist)

**Collision Prevention:** Same UUID can exist as both self and assigned without collision

### 2.2 Session Persistence

**When saved:** `app/workout/[id].tsx:1269-1271`

```typescript
const stored: StoredWorkoutSession = {
  ...session,
  source: isAssignedWorkout ? 'assigned' : 'self',
  assignedWorkoutId: isAssignedWorkout ? resolvedAssignedId : undefined,
  workoutKey,
  programId: isAssignedWorkout ? undefined : session.programId ?? String(id),
  startTime: session.startTime.toISOString(),
  exercises: [...],
};
const source = isAssignedWorkout ? 'assigned' : 'self';
await setActiveWorkoutState(programUserId, source, workoutKey, { session: stored, ... });
```

**Type:** `StoredWorkoutSession` (`lib/db/storage.ts:220-233`)

```typescript
export type StoredWorkoutSession = {
  id: string;
  programId?: string;
  source?: 'self' | 'assigned';  // ✅ Slice 0: removed 'class'
  assignedWorkoutId?: string;
  workoutKey?: string;
  workoutName: string;
  exercises: StoredWorkoutExercise[];
  startTime: string;
  status: 'in_progress' | 'paused' | 'completed' | 'cancelled';
};
```

---

## 3. RESUME HERO FLOW (Pending Workout Detection)

### 3.1 Detection Hook

**Hook:** `usePendingWorkout()`
**Location:** `lib/hooks/use-pending-workout.ts:42`

**Flow:**
1. `getLatestActiveWorkoutState(userId)` → finds most recent active session
2. Extracts `source` from session: `session.source ?? 'self'` (line 73)
3. Constructs `PendingWorkout` object:

```typescript
const source = session.source ?? 'self';
const assignedWorkoutId =
  source === 'assigned' ? (session.assignedWorkoutId ?? workoutKey) : undefined;

setPendingWorkout({
  id: workoutKey,
  workoutKey,
  programId: source === 'self' ? (session.programId ?? workoutKey) : session.programId,
  source,
  assignedWorkoutId,
  ...
});
```

**Type:** `PendingWorkout` (`lib/hooks/use-pending-workout.ts:18-31`)

```typescript
export interface PendingWorkout {
  id: string;
  workoutKey: string;
  programId?: string;
  source: 'self' | 'assigned';  // ✅ Slice 0: removed 'class'
  assignedWorkoutId?: string;
  // ... progress fields
}
```

### 3.2 Resume Routing (✅ FIXED in Slice 1)

**Component:** `ResumeHeroCard`
**Location:** `components/workout/resume-hero-card.tsx:58-69`

```typescript
const handleResume = useCallback(() => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

  // Route based on workout source
  if (pendingWorkout.source === 'assigned') {
    const assignedId = pendingWorkout.assignedWorkoutId ?? pendingWorkout.workoutKey;
    router.push(`/workout/${assignedId}?source=assigned&assignedWorkoutId=${assignedId}` as any);
  } else {
    const programId = pendingWorkout.programId ?? pendingWorkout.workoutKey;
    router.push(`/workout/${programId}?source=self` as any);
  }
}, [pendingWorkout.source, pendingWorkout.assignedWorkoutId, pendingWorkout.programId, pendingWorkout.workoutKey, router]);
```

**Alternate Resume Location:** `app/(tabs)/_layout.tsx:165-171`

```typescript
if (pendingWorkout.source === 'assigned') {
  const assignedId = pendingWorkout.assignedWorkoutId ?? pendingWorkout.workoutKey;
  router.push(`/workout/${assignedId}?source=assigned&assignedWorkoutId=${assignedId}` as any);
  return;
}
const programId = pendingWorkout.programId ?? pendingWorkout.workoutKey;
router.push(`/workout/${programId}?source=self` as any);
```

---

## 4. WORKOUT EXECUTION → COMPLETION DATAFLOW

### 4.1 Finish Button Flow

**Location:** `app/workout/[id].tsx` → Finish button pressed

**Navigates to:** `/workout/[id]/summary?duration=${durationSeconds}&source=${source}&workoutId=${workoutId}`

**Parameters passed:**
- `duration`: Elapsed time in seconds
- `source`: 'self' or 'assigned'
- `workoutId`: assignedWorkoutId (if assigned) or programId (if self)

### 4.2 Summary Screen Save Flow

**Location:** `app/workout/[id]/summary.tsx:258-430`

**Flow:**

```
handleSave()
  ↓
1. Mark program workout complete (self only)
   └─ markWorkoutCompleted(programId, week, day, duration)
  ↓
2. Save to unified history
   └─ saveWorkoutToHistory({ source: 'assigned' | 'self', ... })
      ├─ Stores in local SQLite (unified_workout_history)
      └─ Triggers sync callback (self only)
  ↓
3. Complete assigned workout (assigned only)
   └─ completeWorkout(workoutId, results, feedback, rating)
      ├─ Updates assigned_workouts.status = 'COMPLETED'
      ├─ Sends coach notification
      └─ Calls handleWorkoutCompleted(source: 'assigned')
  ↓
4. Paths progression (both)
   └─ handleWorkoutCompleted(event)
```

---

## 5. COMPLETION HANDLERS (Call-Site Map)

### 5.1 Self Workout Completion

**Entry Point 1:** `lib/services/sync/workout-sync.ts:122-148`

```typescript
// SAFETY: This is the ONLY call site for 'self' source.
const event = buildWorkoutCompletedEvent({
  userId,
  workoutId: workout.localId,  // hist-XXXXX
  source: 'self',
  originTable: 'workout_logs',
  completedAt: new Date(workout.completedAt),
  exercises: [...],
});

const pathsResult = await handleWorkoutCompleted(event);
```

**Trigger:** Sync service processes workout from unified history

### 5.2 Assigned Workout Completion

**Entry Point 1:** `lib/services/coach/programs.ts:825-853`

```typescript
// SAFETY: This is the ONLY call site for 'assigned' source.
const event = buildWorkoutCompletedEvent({
  userId: user.id,
  workoutId,  // assigned_workouts.id (UUID)
  source: 'assigned',
  originTable: 'assigned_workouts',
  completedAt,
  exercises: [...],
});

const pathsResult = await handleWorkoutCompleted(event);
```

**Trigger:** `completeWorkout()` called from summary screen (assigned only)

**Entry Point 2:** `app/workout/[id]/summary.tsx:385-405`

```typescript
// Fallback if completeWorkout() fails (offline)
const event = buildWorkoutCompletedEvent({
  userId,
  workoutId: assignedKey,
  source: 'assigned',
  originTable: 'assigned_workouts',
  completedAt,
  exercises: [...],
});
await handleWorkoutCompleted(event);
```

---

## 6. PATHS PROGRESSION SYSTEM

### 6.1 Unified Handler

**Function:** `handleWorkoutCompleted(event: WorkoutCompletedEvent)`
**Location:** `lib/services/paths/handle-workout-completed.ts:74`

**Event Type:** `WorkoutCompletedEvent` (`lib/services/paths/types.ts`)

```typescript
export interface WorkoutCompletedEvent {
  userId: string;
  workoutId: string;  // UUID (not prefixed)
  source: 'assigned' | 'self';
  originTable: 'assigned_workouts' | 'workout_logs';
  completedAt: Date;
  exercises: NormalizedExercise[];
}
```

### 6.2 Idempotency Guard

**Table:** `processed_workouts`
**Migration:** `supabase/migrations/20260116_paths_progression.sql:84-91`

```sql
CREATE TABLE IF NOT EXISTS processed_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id UUID NOT NULL,
  source TEXT CHECK (source IN ('assigned','self')) NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now(),
  xp_awarded INT DEFAULT 0,
  UNIQUE(user_id, workout_id, source)
);
```

**Check:** `lib/services/paths/handle-workout-completed.ts:83`

```typescript
const insertResult = await insertProcessedWorkout(userId, workoutId, source);

if (!insertResult.data?.inserted) {
  // Already processed - return cached result
  return getLastResultCache(workoutId, source);
}
```

### 6.3 Processing Flow

**Location:** `lib/services/paths/handle-workout-completed.ts:177-184`

```typescript
const result = processWorkoutCompleted(
  event,
  existingStats,      // lift stats (e1RM, training max)
  activePathInstance, // current path enrollment
  nodeProgress,       // path node states
  processedIds        // already-processed workouts
);
```

**Returns:**
- `xpGained`: Number
- `nodesCompleted`: string[] (node IDs unlocked)
- `updatedStats`: Map<exerciseKey, UserLiftStats>
- `planDeltas`: PlanDelta[] (adaptation recommendations)

### 6.4 Cache & Supabase Write

**Cache First (Offline-first):**

```typescript
// 1. Add to processed set
await addProcessedWorkoutCache(userId, workoutId, source);

// 2. Merge lift stats
await mergeLiftStatsCache(userId, result.updatedStats);

// 3. Update path progress
await updatePathProgressCache(userId, result.xpGained, result.nodesCompleted, activePathInstance);

// 4. Cache result for idempotency
await setLastResultCache(workoutId, source, { xpGained, nodesCompleted, planDelta });
```

**Supabase Write (with fallback):**

```typescript
const supabaseSuccess = await writeToSupabase(...);

if (!supabaseSuccess) {
  // Enqueue for later retry
  await enqueuePathsSync({
    userId,
    workoutId,
    source,  // ← Preserved in queue
    xpAwarded: result.xpGained,
    updatedStats: Object.fromEntries(...),
    nodesCompleted: result.nodesCompleted,
    pathInstanceId: activePathInstance?.id ?? null,
    planDelta,
  });
}
```

---

## 7. SYNC SERVICE (Self Workouts Only)

### 7.1 Sync Callback

**Location:** `lib/db/storage.ts:1425-1434`

```typescript
if (syncCallback && newRecord.source === 'self') {
  try {
    const syncableWorkout = convertToSyncableWorkout(newRecord);
    await syncCallback(syncableWorkout);
  } catch (syncError) {
    console.warn('[Storage] Sync callback failed:', syncError);
  }
} else if (newRecord.source === 'self') {
  console.warn('[Storage] No sync callback registered - workout will not sync to Supabase');
}
```

**Note:** Only 'self' workouts go through sync callback. Assigned workouts sync via `completeWorkout()` instead.

### 7.2 Sync Queue

**Type:** `PathsSyncPayload` (`lib/services/sync/types.ts:31-39`)

```typescript
export interface PathsSyncPayload {
  userId: string;
  workoutId: string;
  source: 'assigned' | 'self';  // ✅ Preserved in queue
  xpAwarded: number;
  updatedStats: Record<string, any>;
  nodesCompleted: string[];
  pathInstanceId: string | null;
  planDelta: any | null;
}
```

**Storage:** `@paths_sync_queue_v1` (AsyncStorage)
**Retry:** Up to 5 attempts with exponential backoff

---

## 8. SOURCE DISCRIMINATION CALL-SITES

### 8.1 Route Level

| File | Line | Code | Purpose |
|------|------|------|---------|
| `app/workout/[id].tsx` | 93 | `const sourceParam = Array.isArray(source) ? source[0] : source;` | Parse query param |
| `app/workout/[id].tsx` | 96 | `const isAssignedWorkout = sourceParam === 'assigned';` | Discriminate flow |
| `app/workout/[id]/summary.tsx` | 61 | `const sourceParam = Array.isArray(source) ? source[0] : source;` | Parse query param |
| `app/workout/[id]/summary.tsx` | 63 | `const isAssignedWorkout = sourceParam === 'assigned';` | Discriminate flow |

### 8.2 Storage Level

| File | Line | Code | Purpose |
|------|------|------|---------|
| `lib/db/storage.ts` | 1425 | `if (syncCallback && newRecord.source === 'self')` | Sync self workouts only |
| `lib/db/storage.ts` | 1434 | `else if (newRecord.source === 'self')` | Warn on missing callback |

### 8.3 Hooks Level

| File | Line | Code | Purpose |
|------|------|------|---------|
| `lib/hooks/use-pending-workout.ts` | 73 | `const source = session.source ?? 'self';` | Extract source |
| `lib/hooks/use-pending-workout.ts` | 76 | `source === 'assigned' ? (...) : undefined` | Resolve assignedWorkoutId |
| `lib/hooks/use-pending-workout.ts` | 81 | `source === 'self' ? (...) : (...)` | Resolve programId |

### 8.4 UI Level (✅ FIXED)

| File | Line | Code | Purpose |
|------|------|------|---------|
| `components/workout/resume-hero-card.tsx` | 62 | `if (pendingWorkout.source === 'assigned')` | Route to assigned workout |
| `app/(tabs)/_layout.tsx` | 165 | `if (pendingWorkout.source === 'assigned')` | Alternate resume path |

---

## 9. SUMMARY SCREEN SOURCE AWARENESS (✅ CORRECT)

### 9.1 Program Loading Guard

**Location:** `app/workout/[id]/summary.tsx:263`

```typescript
const program = isAssignedWorkout ? null : await getProgram(String(id));
```

**Other guards:**
- Line 551: `if (isAssignedWorkout)` early return in handleDiscard
- Line 564: `if (isAssignedWorkout) return;` in applyEditsToTemplate

**Verification:** ✅ Summary screen does NOT depend on local programs for assigned workouts.

---

## 10. TYPE CONSISTENCY (Slice 0 Results)

### 10.1 Canonical Type

**Location:** `lib/services/paths/types.ts:153`

```typescript
export type WorkoutSource = 'assigned' | 'self';
```

### 10.2 Aligned Types (✅ After Slice 0)

| Type | Location | Definition |
|------|----------|------------|
| `WorkoutSource` | `lib/services/paths/types.ts:153` | `'assigned' \| 'self'` |
| `StoredWorkoutSession.source` | `lib/db/storage.ts:223` | `'self' \| 'assigned'` ✅ |
| `UnifiedWorkoutRecord.source` | `lib/db/storage.ts:1169` | `'self' \| 'assigned'` ✅ |
| `PendingWorkout.source` | `lib/hooks/use-pending-workout.ts:30` | `'self' \| 'assigned'` ✅ |
| `PathsSyncPayload.source` | `lib/services/sync/types.ts:33` | `'assigned' \| 'self'` ✅ |

### 10.3 Database Schema

**Table:** `processed_workouts`

```sql
source TEXT CHECK (source IN ('assigned','self')) NOT NULL,
```

**Table:** `plan_deltas`

```sql
source TEXT CHECK (source IN ('assigned','self')) DEFAULT 'self',
```

**Note:** 'class' source type is FROZEN (removed from types, not in DB schema).

---

## 11. REMAINING ISSUES (Out of Scope)

### 11.1 WorkoutKey Not Prefixed (Invariant #1)

**Current:** Plain strings used everywhere
- Example: `"program-abc-123"`, `"assigned-workout-xyz-456"`

**Target (not implemented):**
- Self: `"self:program-abc-123"`
- Assigned: `"assigned:assigned-workout-xyz-456"`

**Impact:** Type safety relies on separate `source` field. Cannot determine source from key alone.

### 11.2 Class Workouts Not Implemented (Invariant #6)

**Status:** 'class' type frozen, not in database schema
- No UI restrictions for athlete editing
- No assignment flow for class workouts
- Type exists in code but not functional

---

## 12. VERIFICATION CHECKLIST

### ✅ Completed
- [x] Resume hero routes correctly for assigned workouts (Slice 1)
- [x] Resume hero routes correctly for self workouts (Slice 1)
- [x] Types consistent across storage, hooks, paths (Slice 0)
- [x] Assigned completions don't double-log as self (verified)
- [x] Summary screen doesn't load local programs for assigned (verified)
- [x] Offline queueing preserves source field (verified)

### ❌ Not Implemented
- [ ] WorkoutKey prefixing (self:*, assigned:*, class:*)
- [ ] Class workout feature (assignments, restrictions, completion)

---

## APPENDIX: Key File References

### Navigation
- `app/_layout.tsx` - Root layout with auth check
- `app/(tabs)/_layout.tsx` - Bottom tab navigator (home, browse, explore, coach, you)
- `app/workout/[id].tsx` - Active workout execution screen
- `app/workout/[id]/summary.tsx` - Post-workout summary & save

### State Management
- `lib/hooks/use-pending-workout.ts` - Resume hero detection logic
- `lib/db/storage.ts` - AsyncStorage persistence layer
- `lib/context/auth-context.tsx` - User authentication state

### Services
- `lib/services/coach/programs.ts` - Assigned workout completion
- `lib/services/sync/workout-sync.ts` - Self workout sync to Supabase
- `lib/services/paths/handle-workout-completed.ts` - Unified progression handler
- `lib/services/paths/progress-controller.ts` - Pure XP calculation logic
- `lib/services/sync/paths-sync.ts` - Offline queue for paths updates

### Components
- `components/workout/resume-hero-card.tsx` - Resume workout UI
- `components/workout/swipeable-set-row.tsx` - Set logging UI

### Database
- `supabase/migrations/20260116_paths_progression.sql` - Paths tables & constraints

---

**End of NAV_FLOW.md**
