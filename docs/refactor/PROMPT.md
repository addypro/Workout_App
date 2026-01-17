# Refactor Loop Prompt

This prompt drives the continuous refactor loop.  It is read by the Refactor Agent at the start of every iteration.  Keep it concise and procedural—most of the real context lives in the repository files.

## Pre‑read

At the start of every iteration, read these files:

- `docs/refactor/REFRACTOR_OS.md` – definitions, rules, invariants, and test requirements.
- `docs/refactor/TASK_QUEUE.md` – the ordered list of refactor tasks.  The first unchecked task is the one you must perform.
- `docs/refactor/BEST_PRACTICES.md` – accumulated lessons from prior iterations.
- `docs/refactor/DECISIONS.md` – durable architecture choices and naming conventions.

Do not proceed until you have read them.

## Step‑by‑Step Instructions

1. **Select the next task** – Choose the first unchecked task in `TASK_QUEUE.md`.  Do not reorder tasks or work on multiple tasks simultaneously.
2. **Plan** – In your scratchpad (not committed to the repo), outline in 5–12 bullets:
   - The files you will touch.
   - The adapter/public API you will preserve.
   - The tests or parity items you expect to protect.
3. **Implement via the strangler pattern** –
   - Create the new module under the appropriate boundary (e.g. `lib/domain/workout`, `lib/infra/cache`).
   - Write a thin adapter in the original location that forwards calls to the new module.
   - Update at most 1–3 call sites unless the task explicitly instructs otherwise.
   - Do **not** refactor unrelated code or fix incidental lint errors outside scope.
4. **Run verification** – Execute `bash ci/verify.sh`.
   - If it fails, read the error, make the minimal fix, and run the verifier again.
   - Repeat until the script passes.  Do not advance tasks while the verifier is red.
5. **On success** – When `bash ci/verify.sh` passes:
   - **Mark the task complete** in `TASK_QUEUE.md`.  Include a short note summarising what changed.
   - **Add best practices** – Append 1–5 bullets to `BEST_PRACTICES.md` using the format:
     - `Rule:` A succinct rule that will help future tasks.
     - `Because:` Rationale for the rule.
     - `Applies to:` The module(s) or layer(s) where it is relevant.
   - **Log decisions** – If you created a new boundary, changed a naming convention, or defined a type contract, append 1–5 lines to `DECISIONS.md` summarising the decision.
   - A task is not complete unless `BEST_PRACTICES.md` has been updated.
6. **Iterate** – Return to step 1 and repeat until all tasks are complete.

## Output Specification

After each iteration, output **exactly one line** to the console in the following format:

```
DONE_TASK: <task_id> VERIFY: <PASS|FAIL>
```

Replace `<task_id>` with the identifier from `TASK_QUEUE.md` (e.g. T03).  Replace `<PASS|FAIL>` with the result of `bash ci/verify.sh`.  If verification failed, you must fix the failure before marking the task done or updating best practices.