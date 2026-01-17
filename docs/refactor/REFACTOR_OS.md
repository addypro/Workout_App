# Refactor Operating System (Max scrutiny, min tokens)

This file is the "constitution" of the refactor. The agent must obey it.

## Non-Negotiable Principles

1) Proof over prose:
   - No changes are accepted unless `bash ci/verify.sh` passes.

2) One atomic task per iteration:
   - Never mix tasks. Never refactor “while you’re here.”

3) Strangler pattern only:
   - New module + adapter that preserves existing public behavior.
   - Migrate call sites gradually.
   - Delete old code only when fully migrated and verified.

4) Repo stores memory:
   - Use BEST_PRACTICES.md + DECISIONS.md as persistent learning.
   - Prompts stay short: agent reads files, not chat.

5) Least-token discipline:
   - Max 15 terminal commands per iteration
   - Max 6 file opens per iteration
   - Open <=200 lines at a time
   - Use search (rg) to locate exact symbols, then open narrow slices

---

## Architecture Target (Module Boundaries)

### Layers

- UI:
  - app/ (routes and screen composition)
  - components/ (presentational components)
- Domain:
  - lib/domain/** (pure logic, no IO)
- Infra:
  - lib/services/** (network, persistence, orchestration)
  - lib/db/** (local storage)
  - lib/supabase/** (supabase client wrapper)
  - lib/voice/** (voice SDK adapters)
  - lib/importers/** (Hevy/Strong parsing adapters)
- Shared:
  - lib/types, lib/utils (pure + stable)

### Dependency Rules

- UI may import Domain + Services (through stable service APIs).
- Domain MUST NOT import UI, Supabase, AsyncStorage, or anything IO.
- Infra may import Domain, not the other way around.

Enforcement options (choose one):

- ESLint rules (no-restricted-imports)
- TS path aliases + lint enforcement
- “barrel exports” per module boundary

---

## Verification Gate: ci/verify.sh (Create this)

Create `ci/verify.sh` and ensure it is deterministic.

Template (replace commands with your actual package scripts):

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1) Fast correctness
pnpm -s lint
pnpm -s typecheck

# 2) Unit + contract tests
pnpm -s test

# 3) Golden behavior snapshots (domain-level)
pnpm -s goldens:diff

# 4) E2E smoke flows (top 5)
pnpm -s e2e:smoke
