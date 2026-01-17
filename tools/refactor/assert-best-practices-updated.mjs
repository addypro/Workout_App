#!/usr/bin/env node
/**
 * Guardrail: If TASK_QUEUE has checked-off tasks, BEST_PRACTICES must contain a matching BP entry.
 *
 * Rule:
 *  - For each checked task like: "- [x] T07 — ..."
 *  - BEST_PRACTICES.md must contain a line including: "BP: T07" (anywhere).
 *
 * This makes "learning" deterministic: tasks can't be marked done without recording what worked.
 */

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const tqPath = path.join(root, 'docs', 'refactor', 'TASK_QUEUE.md');
const bpPath = path.join(root, 'docs', 'refactor', 'BEST_PRACTICES.md');

function readOrEmpty(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

const tq = readOrEmpty(tqPath);
const bp = readOrEmpty(bpPath);

// If files are missing, don't hard fail here—other gates may be running in non-refactor contexts.
// But in the refactor branch, you should have these files.
if (!tq || !bp) {
  process.exit(0);
}

const done = [];
for (const line of tq.split(/\r?\n/)) {
  const m = line.match(/^\s*-\s*\[(x|X)\]\s*(T\d{2,})\b/);
  if (m) done.push(m[2]);
}

// If nothing is marked done yet, pass.
if (done.length === 0) {
  process.exit(0);
}

const missing = done.filter(id => !bp.includes(`BP: ${id}`));
if (missing.length) {
  console.error('❌ Best-practices guardrail failed.');
  console.error('The following completed tasks are missing BP entries in docs/refactor/BEST_PRACTICES.md:');
  for (const id of missing) console.error(`- ${id} (expected to find: "BP: ${id}")`);
  console.error('\nFix: append one bullet per task, e.g.:');
  console.error(`- BP: ${missing[0]} — Rule: ... Because: ... Applies to: ...`);
  process.exit(1);
}

process.exit(0);
