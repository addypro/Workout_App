# XState Workout Machine Rollback Plan

> **Status:** Machine is in PARALLEL RUN mode (observe-only)
> **Last Updated:** January 13, 2026

## Quick Disable (Emergency)

If the XState machine is causing issues during a workout session, you can disable it immediately:

### Option 1: Return `null` from Provider (Recommended)

Edit `lib/context/workout-machine-provider.tsx`:

```typescript
export function useOptionalWorkoutMachine(): UseWorkoutMachineReturn | null {
    // EMERGENCY DISABLE: Return null to fully disable machine
    return null;
    
    // Original:
    // return useContext(WorkoutMachineContext);
}
```

This is the safest option because:
- All code already checks for `null` before using the machine
- Zero code changes needed in `[id].tsx`
- Can be reverted in seconds

### Option 2: Remove Provider from Layout

Edit `app/_layout.tsx` and remove the `WorkoutMachineProvider` wrapper:

```diff
- <WorkoutMachineProvider>
    <Slot />
- </WorkoutMachineProvider>
```

## Divergence Warnings

The workout screen logs warnings when states diverge:

```
[XState DIVERGENCE WARNING] State mismatch detected:
  • status: useState=in_progress vs machine=idle
  • exerciseCount: useState=5 vs machine=3
  See lib/machines/ROLLBACK.md for recovery instructions.
```

### What Causes Divergence

| Scenario | Cause | Severity |
|----------|-------|----------|
| Status mismatch at start | Machine not started when session begins | 🟡 Medium |
| Exercise count mismatch | `addExercise` not sent to machine | 🟡 Medium |
| Completed sets mismatch | `completeSet` not sent to machine | 🟢 Low (expected) |
| Resting state mismatch | Rest timer not synced | 🟢 Low (expected) |

### Expected Divergence (Acceptable)

During the parallel run phase, some divergence is **expected** because:

1. The machine is NOT receiving all events (only `START_WORKOUT`)
2. `completeSet`, `addExercise`, etc. are NOT being sent to machine yet
3. Rest timer is managed by legacy `useState`, not machine

This is by design - we're in "observe mode" before full cutover.

### Unexpected Divergence (Investigate)

If you see divergence in the **status** field, this is concerning:
- Machine thinks workout is `idle` but useState says `in_progress`
- This means `startWorkout()` wasn't called

Check the sync effect in `[id].tsx`:
```typescript
if (session.status === 'in_progress' && workoutMachine.status === 'idle') {
    workoutMachine.startWorkout(session);
}
```

## Recovery Steps

### If Divergence Causes UI Issues

1. **Immediate**: Disable machine using Option 1 above
2. **Deploy**: Push the change to disable machine
3. **Investigate**: Check console logs for divergence warnings
4. **Fix**: Address sync issues in the parallel run sync effect
5. **Re-enable**: Revert the emergency disable

### If Divergence Causes Data Loss

The machine is in observe-only mode, so it should NOT cause data loss. All actual data is stored via:
- `setSession()` → React useState
- `setActiveWorkoutState()` → AsyncStorage

The machine's `context.session` is a **copy**, not the source of truth.

## Full Removal (Nuclear Option)

If you need to completely remove the XState machine:

### Step 1: Remove imports and usage from `[id].tsx`

```diff
- import { useOptionalWorkoutMachine } from '@/lib/context/workout-machine-provider';

// Remove all machine-related code:
- const workoutMachine = useOptionalWorkoutMachine();
- // ... remove both useEffect blocks related to machine ...
```

### Step 2: Remove provider from `_layout.tsx`

```diff
- import { WorkoutMachineProvider } from '@/lib/context/workout-machine-provider';

- <WorkoutMachineProvider>
    <Slot />
- </WorkoutMachineProvider>
```

### Step 3: Delete machine files (optional)

```bash
rm lib/machines/workout-session.machine.ts
rm lib/context/workout-machine-provider.tsx
# Update lib/machines/index.ts to remove exports
```

## Migration Deadline

> **Decision Required By:** [SET DATE]

The parallel run should NOT be permanent. Choose one:

1. **Full Cutover**: Machine becomes source of truth, useState removed
2. **Abort**: Machine removed entirely, useState remains

Indefinite parallel runs create:
- Double maintenance burden
- False confidence in machine behavior
- Cognitive overhead for developers

---

## Files Involved

| File | Purpose |
|------|---------|
| `lib/machines/workout-session.machine.ts` | XState machine definition |
| `lib/machines/use-workout-machine.ts` | React hook wrapper |
| `lib/context/workout-machine-provider.tsx` | Context provider |
| `app/workout/[id].tsx` | Consumer (parallel run sync) |
| `app/_layout.tsx` | Provider wrapper location |

---

*This document is part of the XState migration project. See the Workout Execution Engine KI for full context.*
