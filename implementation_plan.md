# Implementation Plan: WorkoutKey Storage Namespacing (Option 2)

**Date:** 2026-01-16
**Branch:** audit/2026-01-16-workoutkey
**Goal:** Prevent AsyncStorage/SQLite collisions between self/assigned workouts by namespacing storage keys with source

---

## AUDIT FINDINGS

### Current Storage Structure

**AsyncStorage Key Format:**
```typescript
// Current: lib/db/storage.ts:864
function activeWorkoutKey(userId: string, workoutKey: string) {
  return `@active_workout:${userId}:${workoutKey}`;
}
```

**Example keys:**
- `@active_workout:user-123:program-abc` (self)
- `@active_workout:user-123:assigned-workout-xyz` (assigned)

**Problem:** If a self program and assigned workout share the same UUID (`program-abc`), they collide:
- Self: `@active_workout:user-123:program-abc`
- Assigned: `@active_workout:user-123:program-abc` ← **COLLISION**

### SQLite Schema

**Table:** `active_workout_state` (`lib/db/sqlite.ts:96-104`)

```sql
CREATE TABLE IF NOT EXISTS active_workout_state (
  id TEXT PRIMARY KEY NOT NULL,           -- activeWorkoutRowId(userId, workoutKey)
  user_id TEXT NOT NULL,
  program_id TEXT NOT NULL,               -- workoutKey (no source discrimination)
  state_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_active_workout_state_user_program
  ON active_workout_state(user_id, program_id);
```

**Problem:** UNIQUE INDEX on `(user_id, program_id)` allows only ONE active workout per workoutKey, regardless of source.

### Call Site Analysis (22 total references)

#### Storage Functions (lib/db/storage.ts)
| Function | Line | Parameters | Returns |
|----------|------|------------|---------|
| `activeWorkoutKey()` | 863 | `(userId, workoutKey)` | AsyncStorage key string |
| `activeWorkoutRowId()` | 867 | `(userId, workoutKey)` | SQLite row id |
| `setActiveWorkoutState()` | 871 | `(userId, workoutKey, state)` | void |
| `getActiveWorkoutState()` | 900 | `(userId, workoutKey)` | ActiveWorkoutState \| null |
| `clearActiveWorkoutState()` | 944 | `(userId, workoutKey)` | void |
| `getLatestActiveWorkoutState()` | 964 | `(userId)` | {workoutKey, state} \| null |

#### Call Sites with Source Available

**app/workout/[id].tsx** (Source: `isAssignedWorkout` from line 96)
- Line 803: `getActiveWorkoutState(userId, workoutKey)` - ✓ Has `isAssignedWorkout`
- Line 911: `getActiveWorkoutState(program.userId, workoutKey)` - ✓ Has `isAssignedWorkout`
- Line 1267: `setActiveWorkoutState(programUserId, workoutKey, {...})` - ✓ Has `isAssignedWorkout`
- Line 1755: `clearActiveWorkoutState(programUserId, workoutKey)` - ✓ Has `isAssignedWorkout`

**app/workout/[id]/summary.tsx** (Source: `isAssignedWorkout` from line 63)
- Line 121: `getActiveWorkoutState(userId, workoutKey)` - ✓ Has `isAssignedWorkout`
- Line 187: `getActiveWorkoutState(program.userId, program.id)` - ✓ NOT assigned (self flow)
- Line 469: `clearActiveWorkoutState(userId, workoutKey)` - ✓ Has `isAssignedWorkout`
- Line 471: `clearActiveWorkoutState(program.userId, program.id)` - ✓ NOT assigned (self flow)
- Line 551-555: `clearActiveWorkoutState(...)` - ✓ Has `isAssignedWorkout` check

**lib/hooks/use-pending-workout.ts** (Source: Available from session)
- Line 48: `getLatestActiveWorkoutState(userId)` - ⚠️ Returns ALL active workouts (needs multi-source support)
- Line 104: `clearActiveWorkoutState(pendingWorkout.userId, pendingWorkout.workoutKey)` - ✓ Has `pendingWorkout.source`

**app/(tabs)/index.tsx** (Source: NOT available directly)
- Line 293: `clearActiveWorkoutState(userId, program.id)` - ✗ Self-only context (always self)

**lib/context/mode-context.tsx** (Source: NOT available)
- Line 130: `getLatestActiveWorkoutState(userId)` - ⚠️ Needs multi-source support

---

## IMPLEMENTATION PLAN

### Phase 1: Update Storage Functions (lib/db/storage.ts)

#### 1.1 Update Key Generation Functions

**Before:**
```typescript
// Line 863
function activeWorkoutKey(userId: string, workoutKey: string) {
  return `@active_workout:${userId}:${workoutKey}`;
}

// Line 867
function activeWorkoutRowId(userId: string, workoutKey: string) {
  return `aws-${userId}-${workoutKey}`;
}
```

**After:**
```typescript
// Line 863
function activeWorkoutKey(userId: string, source: WorkoutSource, workoutKey: string) {
  return `@active_workout:${userId}:${source}:${workoutKey}`;
}

// Line 867
function activeWorkoutRowId(userId: string, source: WorkoutSource, workoutKey: string) {
  return `aws-${userId}-${source}-${workoutKey}`;
}

// NEW: Backward-compat helper
function legacyActiveWorkoutKey(userId: string, workoutKey: string) {
  return `@active_workout:${userId}:${workoutKey}`;
}
```

**New key format examples:**
- Self: `@active_workout:user-123:self:program-abc`
- Assigned: `@active_workout:user-123:assigned:program-abc`

#### 1.2 Update setActiveWorkoutState()

**Current signature (line 871):**
```typescript
export async function setActiveWorkoutState(
  userId: string,
  workoutKey: string,
  state: ActiveWorkoutState
): Promise<void>
```

**New signature:**
```typescript
export async function setActiveWorkoutState(
  userId: string,
  source: WorkoutSource,
  workoutKey: string,
  state: ActiveWorkoutState
): Promise<void>
```

**Changes:**
- Line 880: Update to `activeWorkoutRowId(userId, source, workoutKey)`
- Line 882: Update column `program_id` → store `${source}:${workoutKey}` composite
- Line 894: Update to `activeWorkoutKey(userId, source, workoutKey)`

**Implementation:**
```typescript
export async function setActiveWorkoutState(
  userId: string,
  source: WorkoutSource,
  workoutKey: string,
  state: ActiveWorkoutState
): Promise<void> {
  const db = await getStorageDb();
  if (db) {
    try {
      await db.runAsync(
        `INSERT OR REPLACE INTO active_workout_state (
          id, user_id, program_id, state_json, updated_at
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          activeWorkoutRowId(userId, source, workoutKey),
          userId,
          `${source}:${workoutKey}`,  // ← Namespace with source
          JSON.stringify(state),
          new Date().toISOString(),
        ]
      );
      return;
    } catch (error) {
      console.error('Error saving active workout state:', error);
    }
  }

  try {
    await AsyncStorage.setItem(
      activeWorkoutKey(userId, source, workoutKey),
      JSON.stringify(state)
    );
  } catch (error) {
    console.error('Error saving active workout state:', error);
  }
}
```

#### 1.3 Update getActiveWorkoutState()

**Current signature (line 900):**
```typescript
export async function getActiveWorkoutState(
  userId: string,
  workoutKey: string
): Promise<ActiveWorkoutState | null>
```

**New signature:**
```typescript
export async function getActiveWorkoutState(
  userId: string,
  source: WorkoutSource,
  workoutKey: string
): Promise<ActiveWorkoutState | null>
```

**Backward-compatible read strategy:**
1. Try new format: `@active_workout:{userId}:{source}:{workoutKey}`
2. If not found, try legacy format: `@active_workout:{userId}:{workoutKey}`
3. If found in legacy, migrate to new format on next write

**Implementation:**
```typescript
export async function getActiveWorkoutState(
  userId: string,
  source: WorkoutSource,
  workoutKey: string
): Promise<ActiveWorkoutState | null> {
  const db = await getStorageDb();
  if (db) {
    try {
      // Try new format first
      const compositeKey = `${source}:${workoutKey}`;
      const row = await db.getFirstAsync<ActiveWorkoutRow>(
        'SELECT state_json FROM active_workout_state WHERE user_id = ? AND program_id = ?',
        [userId, compositeKey]
      );

      if (row) {
        return JSON.parse(row.state_json);
      }

      // Fallback to legacy format (backward compat)
      const legacyRow = await db.getFirstAsync<ActiveWorkoutRow>(
        'SELECT state_json FROM active_workout_state WHERE user_id = ? AND program_id = ?',
        [userId, workoutKey]
      );

      if (legacyRow) {
        console.log('[Migration] Found legacy active workout, will migrate on next write');
        return JSON.parse(legacyRow.state_json);
      }

      // Try AsyncStorage new format
      const data = await AsyncStorage.getItem(activeWorkoutKey(userId, source, workoutKey));
      if (data) {
        const parsed = JSON.parse(data);
        // Migrate to SQLite
        await db.runAsync(
          `INSERT OR REPLACE INTO active_workout_state (
            id, user_id, program_id, state_json, updated_at
          ) VALUES (?, ?, ?, ?, ?)`,
          [
            activeWorkoutRowId(userId, source, workoutKey),
            userId,
            compositeKey,
            data,
            new Date().toISOString(),
          ]
        );
        return parsed;
      }

      // Fallback to AsyncStorage legacy format
      const legacyData = await AsyncStorage.getItem(legacyActiveWorkoutKey(userId, workoutKey));
      if (legacyData) {
        console.log('[Migration] Found legacy AsyncStorage workout, will migrate on next write');
        return JSON.parse(legacyData);
      }

      return null;
    } catch (error) {
      console.error('Error loading active workout state:', error);
    }
  }

  // Fallback to AsyncStorage only
  try {
    const data = await AsyncStorage.getItem(activeWorkoutKey(userId, source, workoutKey));
    if (data) return JSON.parse(data);

    // Try legacy format
    const legacyData = await AsyncStorage.getItem(legacyActiveWorkoutKey(userId, workoutKey));
    if (legacyData) {
      console.log('[Migration] Found legacy AsyncStorage workout');
      return JSON.parse(legacyData);
    }

    return null;
  } catch (error) {
    console.error('Error loading active workout state:', error);
    return null;
  }
}
```

#### 1.4 Update clearActiveWorkoutState()

**Current signature (line 944):**
```typescript
export async function clearActiveWorkoutState(
  userId: string,
  workoutKey: string
): Promise<void>
```

**New signature:**
```typescript
export async function clearActiveWorkoutState(
  userId: string,
  source: WorkoutSource,
  workoutKey: string
): Promise<void>
```

**Implementation (clear both new and legacy keys):**
```typescript
export async function clearActiveWorkoutState(
  userId: string,
  source: WorkoutSource,
  workoutKey: string
): Promise<void> {
  const db = await getStorageDb();
  if (db) {
    try {
      // Clear new format
      await db.runAsync(
        'DELETE FROM active_workout_state WHERE user_id = ? AND program_id = ?',
        [userId, `${source}:${workoutKey}`]
      );

      // Clear legacy format (if exists)
      await db.runAsync(
        'DELETE FROM active_workout_state WHERE user_id = ? AND program_id = ?',
        [userId, workoutKey]
      );
    } catch (error) {
      console.error('Error clearing active workout state:', error);
    }
  }

  try {
    // Clear new format
    await AsyncStorage.removeItem(activeWorkoutKey(userId, source, workoutKey));

    // Clear legacy format (if exists)
    await AsyncStorage.removeItem(legacyActiveWorkoutKey(userId, workoutKey));
  } catch (error) {
    console.error('Error clearing active workout state:', error);
  }
}
```

#### 1.5 Update getLatestActiveWorkoutState()

**Current signature (line 964):**
```typescript
export async function getLatestActiveWorkoutState(userId: string): Promise<{
  workoutKey: string;
  state: ActiveWorkoutState;
} | null>
```

**New return type (includes source):**
```typescript
export async function getLatestActiveWorkoutState(userId: string): Promise<{
  workoutKey: string;
  source: WorkoutSource;
  state: ActiveWorkoutState;
} | null>
```

**Implementation (parse source from composite key):**
```typescript
export async function getLatestActiveWorkoutState(userId: string): Promise<{
  workoutKey: string;
  source: WorkoutSource;
  state: ActiveWorkoutState;
} | null> {
  const db = await getStorageDb();
  if (db) {
    try {
      const rows = await db.getAllAsync<ActiveWorkoutListRow>(
        'SELECT program_id, state_json, updated_at FROM active_workout_state WHERE user_id = ? ORDER BY updated_at DESC',
        [userId]
      );

      for (const row of rows) {
        try {
          const parsed = JSON.parse(row.state_json) as ActiveWorkoutState;
          const status = parsed?.session?.status;

          if (status !== 'in_progress' && status !== 'paused') {
            continue;
          }

          // Parse composite key: "source:workoutKey" or legacy "workoutKey"
          let source: WorkoutSource;
          let workoutKey: string;

          if (row.program_id.includes(':')) {
            const [sourceStr, ...keyParts] = row.program_id.split(':');
            source = sourceStr as WorkoutSource;
            workoutKey = keyParts.join(':');
          } else {
            // Legacy format - infer source from session
            source = parsed.session?.source ?? 'self';
            workoutKey = row.program_id;
          }

          return { workoutKey, source, state: parsed };
        } catch (parseError) {
          console.warn('[getLatestActiveWorkoutState] Failed to parse row:', parseError);
          continue;
        }
      }
    } catch (error) {
      console.error('[getLatestActiveWorkoutState] DB error:', error);
    }
  }

  // Fallback to AsyncStorage scan
  try {
    const prefix = `${ACTIVE_WORKOUT_KEY_PREFIX}${userId}:`;
    const keys = await AsyncStorage.getAllKeys();
    const activeWorkoutKeys = keys.filter(k => k.startsWith(prefix));

    for (const key of activeWorkoutKeys) {
      const data = await AsyncStorage.getItem(key);
      if (!data) continue;

      try {
        const parsed = JSON.parse(data) as ActiveWorkoutState;
        const status = parsed?.session?.status;

        if (status !== 'in_progress' && status !== 'paused') {
          continue;
        }

        // Parse key: @active_workout:userId:source:workoutKey or legacy @active_workout:userId:workoutKey
        const parts = key.replace(prefix, '').split(':');
        let source: WorkoutSource;
        let workoutKey: string;

        if (parts.length > 1) {
          source = parts[0] as WorkoutSource;
          workoutKey = parts.slice(1).join(':');
        } else {
          // Legacy format
          source = parsed.session?.source ?? 'self';
          workoutKey = parts[0];
        }

        return { workoutKey, source, state: parsed };
      } catch (parseError) {
        console.warn('[getLatestActiveWorkoutState] Failed to parse AsyncStorage:', parseError);
        continue;
      }
    }
  } catch (error) {
    console.error('[getLatestActiveWorkoutState] AsyncStorage error:', error);
  }

  return null;
}
```

---

### Phase 2: Update All Call Sites

#### 2.1 app/workout/[id].tsx (4 call sites)

**Context:** `isAssignedWorkout` available from line 96

**Line 803:**
```typescript
// Before
const existing = await getActiveWorkoutState(userId, workoutKey);

// After
const source: WorkoutSource = isAssignedWorkout ? 'assigned' : 'self';
const existing = await getActiveWorkoutState(userId, source, workoutKey);
```

**Line 911:**
```typescript
// Before
const existing = await getActiveWorkoutState(program.userId, workoutKey);

// After
const source: WorkoutSource = isAssignedWorkout ? 'assigned' : 'self';
const existing = await getActiveWorkoutState(program.userId, source, workoutKey);
```

**Line 1267:**
```typescript
// Before
setActiveWorkoutState(programUserId, workoutKey, { session: stored, elapsedSeconds, lastUpdatedAt: Date.now() });

// After
const source: WorkoutSource = isAssignedWorkout ? 'assigned' : 'self';
setActiveWorkoutState(programUserId, source, workoutKey, { session: stored, elapsedSeconds, lastUpdatedAt: Date.now() });
```

**Line 1755:**
```typescript
// Before
await clearActiveWorkoutState(programUserId, workoutKey);

// After
const source: WorkoutSource = isAssignedWorkout ? 'assigned' : 'self';
await clearActiveWorkoutState(programUserId, source, workoutKey);
```

#### 2.2 app/workout/[id]/summary.tsx (7 call sites)

**Context:** `isAssignedWorkout` available from line 63

**Line 121:**
```typescript
// Before
const activeState = await getActiveWorkoutState(userId, workoutKey);

// After
const source: WorkoutSource = isAssignedWorkout ? 'assigned' : 'self';
const activeState = await getActiveWorkoutState(userId, source, workoutKey);
```

**Line 187:**
```typescript
// Before (self flow)
const activeState = await getActiveWorkoutState(program.userId, program.id);

// After
const activeState = await getActiveWorkoutState(program.userId, 'self', program.id);
```

**Line 469:**
```typescript
// Before
await clearActiveWorkoutState(userId, workoutKey);

// After
const source: WorkoutSource = isAssignedWorkout ? 'assigned' : 'self';
await clearActiveWorkoutState(userId, source, workoutKey);
```

**Line 471:**
```typescript
// Before (self flow)
await clearActiveWorkoutState(program.userId, program.id);

// After
await clearActiveWorkoutState(program.userId, 'self', program.id);
```

**Lines 551-555:**
```typescript
// Before
if (isAssignedWorkout) {
  await clearActiveWorkoutState(userId, workoutKey);
} else {
  await clearActiveWorkoutState(program.userId, program.id);
  ...
}

// After
if (isAssignedWorkout) {
  await clearActiveWorkoutState(userId, 'assigned', workoutKey);
} else {
  await clearActiveWorkoutState(program.userId, 'self', program.id);
  ...
}
```

#### 2.3 lib/hooks/use-pending-workout.ts (2 call sites)

**Line 48:**
```typescript
// Before
const latest = await getLatestActiveWorkoutState(userId);

// After (no change - function now returns source)
const latest = await getLatestActiveWorkoutState(userId);
```

**Line 104:**
```typescript
// Before
await clearActiveWorkoutState(pendingWorkout.userId, pendingWorkout.workoutKey);

// After
await clearActiveWorkoutState(
  pendingWorkout.userId,
  pendingWorkout.source,
  pendingWorkout.workoutKey
);
```

#### 2.4 app/(tabs)/index.tsx (1 call site)

**Line 293:**
```typescript
// Before (self-only context)
await clearActiveWorkoutState(userId, program.id);

// After
await clearActiveWorkoutState(userId, 'self', program.id);
```

#### 2.5 lib/context/mode-context.tsx (1 call site)

**Line 130:**
```typescript
// Before
const latest = await getLatestActiveWorkoutState(userId);

// After (no change - function now returns source)
const latest = await getLatestActiveWorkoutState(userId);
```

---

### Phase 3: Update SQLite Schema (Optional Migration)

**Current index:** `idx_active_workout_state_user_program` on `(user_id, program_id)`

**No schema change needed** - `program_id` column will now store `"source:workoutKey"` composite string.

**Migration query (if needed to clean up legacy entries):**
```sql
-- Run after all clients updated
DELETE FROM active_workout_state WHERE program_id NOT LIKE '%:%';
```

---

## VERIFICATION STEPS

### Step 1: TypeScript Compilation
```bash
npx tsc --noEmit
```
**Expected:** No new type errors (127 pre-existing Supabase/icon errors remain)

### Step 2: Unit/Integration Tests
```bash
npm test -- __tests__/integration/workout-flow.test.tsx
```
**Expected:** 16/16 tests passing

### Step 3: Manual QA - Resume Self Workout
1. Start a self workout from Programs tab
2. Complete 2-3 sets
3. Force close app
4. Relaunch app
5. **VERIFY:** Resume hero shows correct workout
6. Tap Resume
7. **VERIFY:** Navigates to `/workout/[programId]?source=self`
8. **VERIFY:** Workout state restored correctly

### Step 4: Manual QA - Resume Assigned Workout
1. Have coach assign a workout
2. Start assigned workout
3. Complete 2-3 sets
4. Force close app
5. Relaunch app
6. **VERIFY:** Resume hero shows assigned workout
7. Tap Resume
8. **VERIFY:** Navigates to `/workout/[assignedId]?source=assigned&assignedWorkoutId=[assignedId]`
9. **VERIFY:** Assigned workout state restored (not local program)

### Step 5: Manual QA - Collision Prevention (Critical Test)
1. Create a UUID collision scenario:
   - Start self workout with programId `test-collision-123`
   - Force close app
   - Have coach assign workout with ID `test-collision-123`
   - Start assigned workout
   - Force close app
2. Relaunch app
3. **VERIFY:** Resume hero shows assigned workout (most recent)
4. Check AsyncStorage keys:
   ```
   @active_workout:user-123:self:test-collision-123
   @active_workout:user-123:assigned:test-collision-123
   ```
5. **VERIFY:** Both keys exist (no collision)
6. Tap Resume
7. **VERIFY:** Loads assigned workout (correct one)

### Step 6: Backward Compatibility Test
1. Before updating code, create a legacy active workout:
   ```typescript
   // Old format key
   await AsyncStorage.setItem(
     '@active_workout:user-123:legacy-program-id',
     JSON.stringify({...})
   );
   ```
2. Update code to new version
3. Launch app
4. **VERIFY:** Resume hero still shows legacy workout
5. Tap Resume
6. **VERIFY:** Workout loads correctly
7. Complete a set (triggers write)
8. Force close and relaunch
9. **VERIFY:** Workout now uses new key format
10. **VERIFY:** Old key cleaned up on clear

---

## ROLLBACK PLAN

If issues occur after deployment:

1. **Immediate:** Revert storage function signatures (backward compatible read logic allows old clients to work)
2. **Data:** Legacy keys remain accessible - no data loss
3. **Migration:** Gradual - old keys auto-migrate on next write

---

## FILES TO MODIFY (Summary)

| File | Lines | Changes |
|------|-------|---------|
| `lib/db/storage.ts` | 863, 867, 871-941, 964-1005 | Update 6 functions, add legacy helper |
| `app/workout/[id].tsx` | 803, 911, 1267, 1755 | Add source param (4 calls) |
| `app/workout/[id]/summary.tsx` | 121, 187, 469, 471, 551-555 | Add source param (7 calls) |
| `lib/hooks/use-pending-workout.ts` | 104 | Add source param (1 call) |
| `app/(tabs)/index.tsx` | 293 | Add source param (1 call) |
| `lib/context/mode-context.tsx` | 130 | No change (function signature updated) |

**Total:** 6 files, ~20 call sites, no breaking changes to external APIs

---

## IMPLEMENTATION NOTES

1. **Source Parameter Position:** Added as 2nd parameter (after userId, before workoutKey) for consistency
2. **Migration Strategy:** Lazy migration - read legacy format, write new format, clean on next clear
3. **Backward Compatibility:** Old clients can still read new format (graceful degradation)
4. **Testing:** Focus on collision scenario and legacy migration
5. **Performance:** No impact - same number of AsyncStorage/SQLite operations

---

## BLOCKEDONUSER

**Status:** ✋ **BLOCKED ON USER REVIEW**

**Next Step:** Review this implementation plan. If approved, proceed with Phase 1 (storage functions).

**Questions for User:**
1. Approve migration strategy (lazy migration vs immediate migration)?
2. Should we add telemetry to track legacy key cleanup rate?
3. Timeline for deprecating legacy format support?
