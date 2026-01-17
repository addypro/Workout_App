#!/usr/bin/env bash
# Unified verification gate for the Workout_App refactor loop.
#
# Principle: The refactor is ONLY allowed to mark a task complete when this script exits 0.
#
# This script is intentionally defensive:
# - It runs checks ONLY if the corresponding npm script exists.
# - It enforces the "Best Practices" memory rule: every checked task must have a BP entry.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# -------- helpers --------

have_node() {
  command -v node >/dev/null 2>&1
}

script_exists() {
  local name="$1"
  have_node || return 1
  node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts['${name}'] ? 0 : 1)" >/dev/null 2>&1
}

run_script() {
  local name="$1"
  echo "\n==> npm run ${name}"
  npm run -s "$name"
}

run_if_exists() {
  local name="$1"
  if script_exists "$name"; then
    run_script "$name"
  else
    echo "\n==> (skip) npm script '${name}' not found"
  fi
}

# -------- gate 0: refactor memory guardrail --------

echo "\n==> refactor guardrails"
node "$ROOT_DIR/tools/refactor/assert-best-practices-updated.mjs"

# -------- gate 1: fast sanity --------

run_if_exists "format:check"
run_if_exists "lint"
run_if_exists "typecheck"

# If you don't have a typecheck script, fall back to tsc if TS is present
if ! script_exists "typecheck"; then
  if [ -f tsconfig.json ] && command -v npx >/dev/null 2>&1; then
    echo "\n==> npx tsc --noEmit"
    npx -y tsc --noEmit
  fi
fi

# -------- gate 2: tests --------
run_if_exists "test"

# -------- gate 3: build / bundle --------
run_if_exists "build"

# -------- gate 4: optional goldens / e2e smoke --------
run_if_exists "goldens:diff"
run_if_exists "test:e2e:smoke"
run_if_exists "e2e:smoke"

echo "\n✅ verify.sh: ALL CHECKS PASSED"
