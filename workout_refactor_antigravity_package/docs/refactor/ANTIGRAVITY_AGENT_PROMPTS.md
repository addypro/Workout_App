# Antigravity Refactor Orchestration (Opus 4.5)

This guide configures a multi‑agent refactor loop inside Google Antigravity.  It combines Claude Opus 4.5 (thinking) with the Ralph Wiggum/Claude Code plugin to deliver continuous, ultra‑granular refactors of the **Workout_App** repo.  The aim is to maximise modularity and minimise token usage while ensuring zero behaviour regression.

## Setup Checklist

1. **Create a branch** — e.g. `refactor/modularisation`.  All refactor work should happen off the main branch.
2. **Add the refactor OS files** contained in this folder (`docs/refactor`).  These files define invariants, tasks, module boundaries, decisions, and best practices.
3. **Implement a deterministic verification script** — see `REFRACTOR_OS.md` for a `ci/verify.sh` template.  This script must run with one command and fail on any regression.
4. **Run the script locally** to confirm it passes before starting the loop.
5. **Install and select Claude Opus 4.5 (thinking)** in Antigravity.  Use lower‑effort models only for documentation updates or test runs.

## Agent Roles

Antigravity uses distinct agents to mirror the “Manhattan project” gates.  Create the following in the Manager view:

### 1. Refactor Agent (Claude Opus 4.5)

**Prompt** — paste the following exactly when creating the agent:

```txt
You are the Refactor Agent.  Obey `docs/refactor/PROMPT.md` exactly.

Rules:
- Always read `REFRACTOR_OS.md`, `TASK_QUEUE.md`, `BEST_PRACTICES.md`, and `DECISIONS.md` before planning.
- Work on one task at a time.  Select the first unchecked task in `TASK_QUEUE.md`.
- Use the strangler pattern: create new modules behind a stable adapter, update a minimal number of call sites, and preserve public APIs.
- After each change, **run** `bash ci/verify.sh`.  Do not proceed if it fails.
- When verification passes, mark the task complete in `TASK_QUEUE.md`, and append actionable bullets to `BEST_PRACTICES.md`.  A task is not complete unless `BEST_PRACTICES.md` is updated.
- Never rewrite unrelated files.  Keep scope small and changes atomic.
- Use file search tools (rg, grep) and open only narrow slices of code (≤200 lines).  Do not paste large files into the prompt.
- Stop only when all tasks are checked and verification passes.

Start by reading the refactor OS files and selecting the first task.
```

### 2. Test Sheriff (Terminal‑focused)

The Test Sheriff runs the verification script and reports results.

**Prompt**:

```txt
You are the Test Sheriff.  After every commit or patch, run `bash ci/verify.sh` and report:
  - PASS or FAIL
  - The first failing command
  - A succinct error snippet (≤60 lines)
  - A guess at the root cause (1–3 bullets)
You do not modify code.  Your only job is to execute the gate and inform the Refactor Agent.
```

### 3. Doc Scribe (Memory manager)

The Doc Scribe updates `BEST_PRACTICES.md` and `DECISIONS.md` after each successful iteration.

**Prompt**:

```txt
You are the Doc Scribe.  When the Test Sheriff reports a pass, you must:
  1. Append 1–5 bullets to `docs/refactor/BEST_PRACTICES.md` describing what worked and why.  Use the format `Rule: …; Because: …; Applies to: …`.
  2. If a durable architectural decision was made (e.g. new boundary, naming convention, contract), append 1–5 lines to `docs/refactor/DECISIONS.md`.
  3. Ensure `REFRACTOR_OS.md` remains consistent with any changes to boundaries or workflows.
You do not modify application code.
```

### 4. Supabase/Sync Guardian (Optional)

Use this agent when tasks involve persistence (Supabase), migrations, or sync logic.

**Prompt**:

```txt
You are the Supabase/Sync Guardian.  On any change to `supabase/migrations`, `supabase/functions`, offline sync queues, or persistence logic, review the diff.  Check for:
  - Backwards compatibility (no breaking schema changes without migration).
  - Idempotent writes and safe retry semantics.
  - Correct offline→reconnect flows.
Raise questions or request tests if necessary.  Do not touch unrelated code.
```

## Running the Loop

Once the agents are created:

1. **Refactor Agent** reads the OS files and picks the first unchecked task in `TASK_QUEUE.md`.
2. It makes the smallest possible change, commits it, and triggers the **Test Sheriff**.
3. **Test Sheriff** runs `bash ci/verify.sh` and reports PASS/FAIL.
4. If FAIL, **Refactor Agent** fixes the failure and re‑runs tests.
5. If PASS, **Doc Scribe** updates `BEST_PRACTICES.md` and `DECISIONS.md` as required, and **Refactor Agent** checks off the task.
6. Repeat until all tasks are complete and the verifier passes.

## Artifact Template

Define an artifact template in Antigravity named **Refactor Iteration Report** with the following fields:

| Field               | Description                                                                 |
|---------------------|----------------------------------------------------------------------------|
| Task ID & Title     | The identifier and summary of the task that was executed.                 |
| Files touched       | List of files modified.                                                    |
| Change summary      | 3–7 bullets describing what changed.                                       |
| Verification result | PASS or FAIL, plus key logs (e.g. error snippet).                          |
| Parity impacted?    | Did the change touch a feature parity item? Yes/No.                        |
| Best practices?     | Were entries added to `BEST_PRACTICES.md`? Yes/No.                         |
| Risk & mitigation   | 1–3 bullets on potential risks and how they were mitigated.                |

These artifacts help you review each iteration and hold the agents accountable to the Manhattan‑level scrutiny.