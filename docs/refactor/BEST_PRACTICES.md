# Best Practices (Auto‑growing memory)

This file serves as the cumulative memory for the refactor loop.  After each successful iteration (i.e. when `bash ci/verify.sh` passes and a task is checked off), add 1–5 bullet entries here.  These entries capture what worked well and why, so the next iteration can leverage that knowledge.

## How to write entries

Each entry should be concise and follow this pattern:

- **Rule:** The actionable guideline (e.g. “Move data fetching into services, not UI”).
- **Because:** The rationale for the rule (e.g. “Prevents side effects during rendering and makes golden snapshots deterministic”).
- **Applies to:** The module(s) or layer(s) where the rule is relevant (e.g. `app/`, `lib/domain`, `lib/services`).

Example:

> - **Rule:** Keep domain modules pure and free of I/O.
>   **Because:** This makes golden snapshots deterministic and enables fast unit tests.
>   **Applies to:** `lib/domain/*`

## Entries

(Append entries below.  Do not remove previous entries.)