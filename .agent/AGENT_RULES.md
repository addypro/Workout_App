# Agent Rules (Universal IDE Safety)

These rules apply to any AI agent working in this repo.

## 1) Read-first, then write

- Do read-only reconnaissance first.
- Before editing code, name the exact files you plan to touch and why.

## 2) Avoid destructive actions without explicit approval

Ask for confirmation before:

- deleting/moving many files
- modifying database schemas/migrations
- resetting/rebasing/rewriting git history
- large-scale refactors across unrelated modules

## 3) Secrets hygiene

- Never print, paste, or request secret values (tokens, API keys, `.env` contents).
- If configuration is needed, specify env var names and expected formats only.

## 4) Keep diffs small and scoped

- One epic per run.
- Prefer adding new modules over editing giant files.
- Keep PRs reviewable.

## 5) Verification required

Every change must include:

- commands to run (expo + tests)
- a minimal manual QA checklist (what to click)

If tests fail twice consecutively, stop and ask targeted questions rather than thrashing.

## 6) Output format for every response

- Plan (≤ 8 bullets)
- Files to touch (explicit list)
- Commands to run (verification)
- Questions (≤ 6, only if blocking)
