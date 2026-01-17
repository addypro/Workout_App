# Task Queue

This file enumerates the ordered list of atomic refactor tasks for the **Workout_App**.  The Refactor Agent must always pick the first unchecked task.  Each task should complete in one iteration (1–3 commits) and includes scope, files to touch, acceptance criteria, and optional notes.

## Format

```
- [ ] Tx – Title
  - **Scope:** Brief description of what to do.
  - **Files:** Key files or directories involved.  Use glob patterns if needed.
  - **Acceptance:** Conditions that must be met for the task to be considered done (including tests to run).
  - **Notes:** Optional hints or context.
```

## Tasks

- [ ] **T01 – Establish verification gate and minimal smoke**
  - **Scope:** Create `ci/verify.sh` with lint and type checks, and add at least one end‑to‑end smoke test for logging a workout.
  - **Files:** `ci/verify.sh`, `package.json` (to add test scripts), `tests/smoke/`
  - **Acceptance:** Running `bash ci/verify.sh` on the current main branch exits with status 0.  The smoke test verifies that a user can start the app, log a simple workout, and see it in the history list.
  - **Notes:** Use Detox or Playwright.  Keep the test simple but deterministic.

- [ ] **T02 – Freeze canonical workout record**
  - **Scope:** Add golden snapshot tests for the canonical workout record.  The test should parse a simple workout using existing logic and write a stable JSON snapshot.
  - **Files:** `tests/goldens/workout.json`, test runner config, domain parsers.
  - **Acceptance:** `bash ci/verify.sh` includes running the snapshot diff.  No changes to code should alter the snapshot.
  - **Notes:** This snapshot will be used to verify later refactors.  Keep it simple and update only intentionally.

- [ ] **T03 – Create `lib/domain/workout` and adapters**
  - **Scope:** Establish a new directory `lib/domain/workout/` containing pure functions and types for workouts.  Move pure business logic (e.g. set/rep calculations, summary computations) here.  Create thin adapter modules in the old locations to forward calls.
  - **Files:** `lib/domain/workout/*`, existing workout service files in `lib/services` or `lib/domain`.
  - **Acceptance:** `bash ci/verify.sh` passes; the smoke test and snapshot tests are unchanged.
  - **Notes:** Do not yet extract Supabase calls or storage here; focus only on pure computation.

- [ ] **T04 – Extract XP and summary computations to domain**
  - **Scope:** Move code responsible for computing workout XP and summary (e.g. volume, personal best logic) from services into `lib/domain/workout`.  Expose clear functions like `calculateXP(workout)` and `summariseWorkout(workout)`.
  - **Files:** `lib/domain/workout/summary.ts`, `lib/services` or `lib/domain` files containing current logic.
  - **Acceptance:** Golden snapshot for the canonical workout record stays unchanged.  Smoke test passes.  Add unit tests for the new functions if they didn’t exist.
  - **Notes:** These functions must be deterministic and side‑effect free.

- [ ] **T05 – Introduce `WorkoutRepository` interface**
  - **Scope:** Define an interface in `lib/services` for persisting workouts (e.g. `saveWorkout(workout)`), reading history, and updating XP.  Provide a default implementation using existing Supabase calls.  Use dependency injection where possible.
  - **Files:** `lib/services/workoutRepository.ts`, existing Supabase service files.
  - **Acceptance:** The app still logs workouts, updates summaries, and syncs correctly.  Smoke test and golden snapshots pass.  Add contract tests if feasible.
  - **Notes:** This paves the way to replace Supabase or add offline persistence later.

- [ ] **T06 – Consolidate Supabase write paths**
  - **Scope:** Centralise all writes to `processed_workouts` and `lift_stats` into the new `WorkoutRepository` or a dedicated persistence service.  Remove scattered Supabase writes in UI or domain code.
  - **Files:** Supabase client wrappers under `lib/supabase/*`, any files writing directly to Supabase.
  - **Acceptance:** Offline→reconnect flow still flushes and updates Supabase correctly.  Golden and smoke tests pass.
  - **Notes:** Write idempotent functions to avoid duplicates on retry.

- [ ] **T07 – Create `lib/domain/programs` and adapters**
  - **Scope:** Isolate program progression logic from UI and services.  Define types and pure functions for program nodes and transitions in `lib/domain/programs`.  Provide adapters to maintain existing APIs.
  - **Files:** `lib/domain/programs/*`, existing program logic files in `lib/domain` or `lib/services`.
  - **Acceptance:** Program progression tests added.  Smoke tests for starting and progressing through a program pass.  Golden snapshots for program transitions added or updated.
  - **Notes:** Use the same strangler pattern: new pure functions + old wrappers.

- [ ] **T08 – Codify additive context rule**
  - **Scope:** Formalise the rule that the next program node depends only on the output of the previous node.  Implement it as a pure function (e.g. `computeNextNode(prevNodeResult)`) in `lib/domain/programs`.  Unit test various scenarios.
  - **Files:** `lib/domain/programs/progression.ts`, test files.
  - **Acceptance:** Program progression tests pass.  Existing program flows remain identical.
  - **Notes:** Document the rule in `DECISIONS.md` once codified.

- [ ] **T09 – Extract history queries into `lib/services/history`**
  - **Scope:** Move database queries and data transformation logic for the history page from UI components into a dedicated history service.  The UI should call a single function to fetch and format history data.
  - **Files:** `lib/services/history/*`, files under `app/history` and `components/history`.
  - **Acceptance:** The history screen looks and behaves the same.  Smoke test for history passes.  Golden snapshots unaffected.
  - **Notes:** This sets up caching and pagination in later tasks.

- [ ] **T10 – Create `lib/infra/cache` for AsyncStorage**
  - **Scope:** Abstract AsyncStorage usage behind a cache module.  Define helpers for storing and retrieving items like workout summaries, last sync timestamps, and per‑exercise stats.
  - **Files:** `lib/infra/cache/*`, existing AsyncStorage calls across the app.
  - **Acceptance:** Offline summary still appears instantly and reconnect still flushes correctly.  Tests for offline→reconnect flows pass.
  - **Notes:** Document cache keys and ensure they include user identifiers where needed.

- [ ] **T11 – Introduce `lib/domain/sync` for pure sync rules**
  - **Scope:** Capture sync business rules (e.g. conflict resolution, idempotency, batching) in pure functions.  These functions should not perform I/O but define what should be sent or stored.
  - **Files:** `lib/domain/sync/*`, existing sync logic in services.
  - **Acceptance:** Unit tests cover sync scenarios.  Offline→reconnect smoke test still passes.
  - **Notes:** This decouples sync strategy from infrastructure.

- [ ] **T12 – Extract sync queue I/O into `lib/services/sync`**
  - **Scope:** Implement the actual persistence and transmission of queued actions to Supabase or other backends.  Use the pure rules from `lib/domain/sync`.
  - **Files:** `lib/services/sync/*`, existing sync queue code.
  - **Acceptance:** No duplicate or missing records after reconnect.  Smoke and golden tests pass.
  - **Notes:** Provide instrumentation or logs to assist debugging.

- [ ] **T13 – Create `lib/importers/hevy` with contract tests**
  - **Scope:** Build a dedicated importer for Hevy exports that maps them into the canonical `UnifiedWorkoutRecord` shape.  Write contract tests to ensure complete round‑trip fidelity.
  - **Files:** `lib/importers/hevy/*`, new test files under `tests/contracts/hevy`.
  - **Acceptance:** Contract tests pass.  Existing import flows produce identical workouts and summaries.
  - **Notes:** Use sample exports.  Document assumptions.

- [ ] **T14 – Create `lib/importers/strong` with contract tests**
  - **Scope:** Same as T13 but for Strong app exports.
  - **Files:** `lib/importers/strong/*`, `tests/contracts/strong`.
  - **Acceptance:** Contract tests pass.  No changes to imported workouts.
  - **Notes:** Align the import format with your canonical record types.

- [ ] **T15 – Create `lib/voice` adapter boundary**
  - **Scope:** Introduce a `lib/voice/` module that wraps voice SDK usage, exposing functions like `startRecording()`, `transcribe()`, and `stopRecording()`.  The UI should call these wrappers instead of directly using voice libraries.
  - **Files:** `lib/voice/*`, existing voice components under `components/voice`.
  - **Acceptance:** The voice‑created workout flow produces the same internal record shape.  Smoke test for voice input passes.
  - **Notes:** Abstract away environment differences (Android/iOS) if necessary.

- [ ] **T16 – Normalize exercise taxonomy access**
  - **Scope:** Move logic that loads and interprets `exercise-taxonomy.json` into `lib/domain/exercises/`, exposing helper functions for retrieving exercises by id/name and for grouping.  Remove direct JSON loading from UI or services.
  - **Files:** `lib/domain/exercises/*`, `data/exercise-taxonomy.json`, relevant components and services.
  - **Acceptance:** Exercise pickers and summaries behave identically.  Tests (unit/golden) updated.
  - **Notes:** Document the structure of the taxonomy and ensure deterministic ordering.

- [ ] **T17 – Enforce boundary lint rules**
  - **Scope:** Configure ESLint (or a custom script) to prevent UI modules from importing infrastructure modules directly and to prevent domain modules from importing React or Supabase.  Use no‑restricted‑imports or similar rules.
  - **Files:** `.eslintrc`, `tsconfig.json`, `package.json`.
  - **Acceptance:** Linting fails if boundaries are violated.  All current imports are compliant or have adapters.
  - **Notes:** Include these rules in `ci/verify.sh`.

- [ ] **T18 – Remove obsolete adapters and dead code**
  - **Scope:** Once all call sites have migrated to the new modules, delete the temporary adapters and any unused files.  Ensure that no tests rely on them.
  - **Files:** Adapters created in earlier tasks.
  - **Acceptance:** `bash ci/verify.sh` passes.  Parity checklist remains fully checked.
  - **Notes:** This is a clean‑up step; ensure no lingering imports remain.

- [ ] **T19 – Add performance micro‑benchmarks**
  - **Scope:** Create simple scripts to measure startup time, history list rendering time, and sync queue flushing time.  Set reasonable budgets based on current performance, and fail the verifier if budgets are exceeded.
  - **Files:** `tools/perf/*`, updates to `ci/verify.sh`.
  - **Acceptance:** Micro‑benchmarks run in CI and do not regress beyond thresholds.  Use `process.hrtime()` or similar.
  - **Notes:** Document budgets in `DECISIONS.md`.  Do not tune prematurely; this is a safety net.

- [ ] **T20 – Final parity audit and documentation pass**
  - **Scope:** Review all tests and ensure every feature parity item is validated.  Remove any remaining TODOs in refactor docs.  Write a summary in `REFACTOR_COMPLETE.md` with the date, verification output, and parity checklist results.
  - **Files:** `docs/refactor/*`, tests, any remaining adapters.
  - **Acceptance:** All items in the Feature Parity checklist are marked complete with test references.  `bash ci/verify.sh` passes.  `REFACTOR_COMPLETE.md` exists and summarises the outcomes.  You may now merge `refactor/modularisation` into main.
  - **Notes:** After this task, delete unused branches and update project documentation (e.g. README) to reflect new module boundaries.