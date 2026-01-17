# Refactor Operating System

This document defines the rules and structure for the **Workout_App** modularisation project.  Treat it as the constitution of your refactor: agents must obey it without deviation.  The goal is to refactor the codebase into clean layers and feature slices while guaranteeing that the app behaves identically for end users.

## Non‑Negotiable Principles

1. **Proof over prose** – A change is only valid if `bash ci/verify.sh` exits with status 0.  Everything else is commentary.
2. **One atomic task per iteration** – Work on the first unchecked task in `TASK_QUEUE.md` only.  No mixing tasks, no “while you’re here” fixes.
3. **Strangler pattern** – For each refactor:
   - Create a new module in the target boundary.
   - Expose the same API surface via a thin adapter in the old location.
   - Migrate call sites incrementally.
   - Remove old code only after all call sites are migrated and verification passes.
4. **Repo stores memory** – Do not rely on model memory.  Persist learnings in `BEST_PRACTICES.md` and architecture choices in `DECISIONS.md`.  The prompt stays short; agents read these files at runtime.
5. **Enforce best‑practices updates** – A task is not complete unless `BEST_PRACTICES.md` contains at least one new bullet for that task.  Verification scripts may check this condition.
6. **Least‑token discipline** – Use search tools to locate symbols and open only small slices of files (≤200 lines).  Do not paste large files into the prompt.
7. **Document all durable decisions** – When you create a new boundary, naming convention, or contract, write a short entry to `DECISIONS.md`.

## Architectural Target

### Layers

- **UI** – `app/` and `components/` contain routes, screens, and presentational components.  No network calls, database access, or business logic.
- **Domain** – `lib/domain/` holds pure business logic: workout parsing, program progression, sync rules, and entities.  These modules are deterministic and side‑effect free (no React, no Supabase, no storage).
- **Infrastructure** – `lib/services/`, `lib/db/`, `lib/supabase/`, `lib/importers/`, `lib/voice/` implement I/O: network requests, storage, Supabase wrappers, import parsers, voice SDK adapters.
- **Adapters** – Provide backward‑compatible surfaces when moving code.  They live alongside old modules or in dedicated adapter directories, delegating calls to new domain or infrastructure modules.

### Dependency Rules

1. UI → may import Domain and Infrastructure via stable service interfaces.
2. Domain → must not import UI, Supabase clients, AsyncStorage, or any external I/O.
3. Infrastructure → may import Domain to compose use‑cases; no other direction.
4. Adapters → may depend on both old and new modules but should not be permanent; remove them once call sites are migrated.

## Verification Gate – `ci/verify.sh`

Create a deterministic shell script at `ci/verify.sh`.  It must execute all the checks that define “no regression.”  At minimum it should:

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. Fast static checks
npm run lint     # runs expo lint according to package.json
npx tsc --noEmit # type‑check without emitting JS

# 2. Unit tests
# (Add a test script to package.json or call your chosen test runner here.)

# 3. Golden snapshots
# (Run scripts that compare canonical workout/program outputs.)

# 4. E2E smoke flows
# (Run minimal UI tests for logging workouts, offline sync, imports, etc.)

# 5. Guard against missing best‑practice updates
# (Optionally call a small script that ensures tasks marked complete in TASK_QUEUE.md are accompanied by entries in BEST_PRACTICES.md.)

```

If your repository does not yet have tests or e2e flows, add them incrementally.  Do not commence large refactors until at least linting and type‑checking pass consistently.

## Feature Parity Checklist

The following user flows must remain identical throughout the refactor.  Add or refine items as you discover more critical behaviours.  Link each item to tests in `TEST_MATRIX.md`.

- **Assigned workout (online)** – Logging a coach‑assigned workout correctly awards XP and inserts rows into `processed_workouts` and `lift_stats` in Supabase.
- **Offline workout → reconnect** – Users can log workouts offline; the summary shows XP immediately (cache‑first), and upon reconnect the sync queue flushes and updates Supabase without duplication or loss.
- **Program progression** – Program nodes transition based only on previous node output.  The “additive context” rule must be preserved.
- **Voice‑created workout** – Workouts created via voice input produce the same internal record shape as typed workouts.
- **Hevy/Strong import** – Importers convert exported workout data into the canonical format with no data loss.
- **History view** – Workout history displays in correct order with accurate summaries.
- **Coach flows** – Assigning workouts, viewing client progress, and sending messages behave as before.

## Test Matrix

Map each parity item and critical module to one or more tests.  Tests may be unit, golden snapshot, or end‑to‑end.

- **Unit tests** – Pure functions in `lib/domain/workout`, `lib/domain/programs`, `lib/domain/sync`, `lib/domain/exercises`.  Cover computations like XP calculation, progression logic, and taxonomy lookups.
- **Golden snapshots** – Serialize canonical workout records and program transitions.  Compare outputs before and after refactors.
- **Contract tests** – Validate importers (`lib/importers/hevy`, `lib/importers/strong`) by round‑tripping sample exports.
- **E2E smoke tests** – Simulate logging a workout, going offline and reconnecting, voice input flows, assigned workout flows, and imports via Hevy/Strong.  Use your preferred test runner (Detox, Playwright, etc.).

## Definition of Done

The refactor project is complete only when:

1. **All tasks** in `TASK_QUEUE.md` are checked off.
2. **All parity items** above are verified by tests and marked complete.
3. **`bash ci/verify.sh` passes** with no modifications and returns status 0.
4. **`BEST_PRACTICES.md`** contains at least one meaningful entry per task, using the “Rule/Because/Applies” format.
5. **`DECISIONS.md`** records major architectural choices and boundary changes.
6. **Adapters are removed or minimal** – All new modules are in place and old wrappers deleted unless intentionally kept for backwards compatibility.