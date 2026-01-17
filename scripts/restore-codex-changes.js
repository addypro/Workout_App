#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function write(filePath, content) {
  fs.writeFileSync(filePath, content);
}

function applyReplace(filePath, before, after) {
  const content = read(filePath);
  if (content.includes(after)) {
    return { changed: false, reason: 'already_applied' };
  }
  if (!content.includes(before)) {
    return { changed: false, reason: 'before_not_found' };
  }
  const next = content.replace(before, after);
  if (next === content) {
    return { changed: false, reason: 'no_change' };
  }
  write(filePath, next);
  return { changed: true, reason: 'replaced' };
}

function applyInsertAfter(filePath, anchor, insertion) {
  const content = read(filePath);
  if (content.includes(insertion)) {
    return { changed: false, reason: 'already_applied' };
  }
  const idx = content.indexOf(anchor);
  if (idx === -1) {
    return { changed: false, reason: 'anchor_not_found' };
  }
  const next = content.slice(0, idx + anchor.length) + insertion + content.slice(idx + anchor.length);
  write(filePath, next);
  return { changed: true, reason: 'inserted' };
}

function applyRemove(filePath, target) {
  const content = read(filePath);
  if (!content.includes(target)) {
    return { changed: false, reason: 'target_not_found' };
  }
  const next = content.replace(target, '');
  write(filePath, next);
  return { changed: true, reason: 'removed' };
}

function logResult(label, result) {
  if (result.changed) {
    console.log(`[restored] ${label}`);
  } else if (result.reason !== 'already_applied') {
    console.warn(`[skip:${result.reason}] ${label}`);
  }
}

const ops = [];

// 1) Settings: Strong import should route to History
ops.push(() => {
  const filePath = path.join(repoRoot, 'components/settings/settings-content.tsx');
  const before = [
    '      <StrongImportModal',
    '        visible={showImportModal}',
    '        onClose={() => setShowImportModal(false)}',
    '      />',
  ].join('\n');
  const after = [
    '      <StrongImportModal',
    '        visible={showImportModal}',
    '        onClose={() => setShowImportModal(false)}',
    '        onImportComplete={() => {',
    '          setShowImportModal(false);',
    "          router.replace('/(tabs)/explore');",
    '        }}',
    '      />',
  ].join('\n');
  return logResult('settings import redirect', applyReplace(filePath, before, after));
});

// 2) Workout import modal: View History button and handler
ops.push(() => {
  const filePath = path.join(repoRoot, 'components/import/workout-import-modal.tsx');

  // Remove onImportComplete call in handleImport (if present)
  const removeLine = '\n            onImportComplete?.({ imported: result.importedCount, prs: result.prsDetected.length });';
  logResult('workout import remove immediate callback', applyRemove(filePath, removeLine));

  // Add handleViewHistory
  const anchor = '\n    const handleClose = () => {';
  const insertion = [
    '\n    const handleViewHistory = () => {',
    '        if (!importResult) {',
    '            handleClose();',
    '            return;',
    '        }',
    '        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);',
    '        onImportComplete?.({ imported: importResult.imported, prs: importResult.prs });',
    '        handleClose();',
    '    };',
    '',
  ].join('\n');
  logResult('workout import view-history handler', applyInsertAfter(filePath, anchor, insertion));

  // Swap button handler + label
  const beforeButton = '                                onPress={handleClose}';
  const afterButton = '                                onPress={handleViewHistory}';
  logResult('workout import button handler', applyReplace(filePath, beforeButton, afterButton));

  const beforeLabel = '                                <ThemedText style={styles.buttonText}>Done</ThemedText>';
  const afterLabel = '                                <ThemedText style={styles.buttonText}>View History</ThemedText>';
  logResult('workout import button label', applyReplace(filePath, beforeLabel, afterLabel));
});

// 3) Pending workout: add elapsed timer formatter
ops.push(() => {
  const filePath = path.join(repoRoot, 'lib/hooks/use-pending-workout.ts');
  const marker = 'export function formatElapsedTime';
  const content = read(filePath);
  if (content.includes(marker)) {
    console.log('[restored] pending workout elapsed formatter (already applied)');
    return;
  }
  const anchor = '\n  return date.toLocaleDateString();\n}';
  const insertion = [
    anchor,
    '',
    'export function formatElapsedTime(dateString: string, nowMs: number = Date.now()): string {',
    '  const start = new Date(dateString).getTime();',
    '  const diffMs = Math.max(0, nowMs - start);',
    '  const totalSeconds = Math.floor(diffMs / 1000);',
    '  const hours = Math.floor(totalSeconds / 3600);',
    '  const minutes = Math.floor((totalSeconds % 3600) / 60);',
    '  const seconds = totalSeconds % 60;',
    '',
    '  if (hours > 0) {',
    "    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;",
    '  }',
    '',
    "  return `${minutes}:${String(seconds).padStart(2, '0')}`;",
    '}',
    '',
  ].join('\n');
  const next = content.replace(anchor, insertion);
  if (next === content) {
    console.warn('[skip:anchor_not_found] pending workout elapsed formatter');
    return;
  }
  write(filePath, next);
  console.log('[restored] pending workout elapsed formatter');
});

// 4) Resume mini bar: elapsed timer and refresher
ops.push(() => {
  const filePath = path.join(repoRoot, 'components/workout/resume-mini-bar.tsx');
  logResult('resume mini bar react imports', applyReplace(
    filePath,
    "import React, { useCallback } from 'react';",
    "import React, { useCallback, useEffect, useState } from 'react';"
  ));

  logResult('resume mini bar formatter import', applyReplace(
    filePath,
    "import { formatRelativeTime, type PendingWorkout } from '@/lib/hooks/use-pending-workout';",
    "import { formatElapsedTime, type PendingWorkout } from '@/lib/hooks/use-pending-workout';"
  ));

  logResult('resume mini bar timer state', applyInsertAfter(
    filePath,
    '  const colors = Colors[colorScheme ?? \"light\"];',
    [
      '',
      '  const [nowMs, setNowMs] = useState(() => Date.now());',
      '',
      '  useEffect(() => {',
      '    const interval = setInterval(() => {',
      '      setNowMs(Date.now());',
      '    }, 1000);',
      '    return () => clearInterval(interval);',
      '  }, []);',
    ].join('\n')
  ));

  logResult('resume mini bar elapsed label', applyInsertAfter(
    filePath,
    '  const progressText = pendingWorkout.totalSets > 0\n    ? `${pendingWorkout.completedSets}/${pendingWorkout.totalSets} sets`\n    : `${pendingWorkout.exerciseCount} exercises`;\n',
    '  const elapsedLabel = formatElapsedTime(pendingWorkout.startedAt, nowMs);\n'
  ));

  logResult('resume mini bar subtitle', applyReplace(
    filePath,
    '            {progressText} · {formatRelativeTime(pendingWorkout.startedAt)}',
    '            {progressText} · {elapsedLabel} elapsed'
  ));
});

// 5) Resume hero card: elapsed timer and refresher
ops.push(() => {
  const filePath = path.join(repoRoot, 'components/workout/resume-hero-card.tsx');
  logResult('resume hero react imports', applyReplace(
    filePath,
    "import React, { useCallback } from 'react';",
    "import React, { useCallback, useEffect, useState } from 'react';"
  ));

  logResult('resume hero formatter import', applyReplace(
    filePath,
    '  formatRelativeTime,\n  PendingWorkout,',
    '  formatElapsedTime,\n  PendingWorkout,'
  ));

  logResult('resume hero timer state', applyInsertAfter(
    filePath,
    '  const colors = Colors[colorScheme ?? \"light\"];',
    [
      '',
      '  const [nowMs, setNowMs] = useState(() => Date.now());',
      '',
      '  useEffect(() => {',
      '    const interval = setInterval(() => {',
      '      setNowMs(Date.now());',
      '    }, 1000);',
      '    return () => clearInterval(interval);',
      '  }, []);',
    ].join('\n')
  ));

  logResult('resume hero subtitle', applyReplace(
    filePath,
    '              {formatRelativeTime(pendingWorkout.startedAt)}',
    '              {formatElapsedTime(pendingWorkout.startedAt, nowMs)} elapsed'
  ));
});

// 6) Tabs layout: resume bar across tabs + refresh on segment change
ops.push(() => {
  const filePath = path.join(repoRoot, 'app/(tabs)/_layout.tsx');
  logResult('tabs react imports', applyReplace(
    filePath,
    "import React, { useState, useCallback } from 'react';",
    "import React, { useEffect, useState, useCallback } from 'react';"
  ));

  logResult('tabs pending workout hook', applyReplace(
    filePath,
    '  const { pendingWorkout, discardPendingWorkout } = usePendingWorkout();',
    '  const { pendingWorkout, discardPendingWorkout, refreshPendingWorkout } = usePendingWorkout();'
  ));

  logResult('tabs segment key', applyInsertAfter(
    filePath,
    '  const segments = useSegments();',
    "\n  const segmentKey = segments.join('/');"
  ));

  logResult('tabs remove isHomeTab', applyRemove(
    filePath,
    "\n  const isHomeTab = segments[0] === '(tabs)' && (!segments[1] || segments[1] === 'index');\n"
  ));

  logResult('tabs refresh pending workout', applyInsertAfter(
    filePath,
    '  const handleBrowsePrograms = useCallback(() => {\n    router.push(\'/(tabs)/browse\');\n  }, [router]);\n',
    '\n  useEffect(() => {\n    refreshPendingWorkout().catch(() => {});\n  }, [refreshPendingWorkout, segmentKey]);\n'
  ));

  logResult('tabs resume bar condition', applyReplace(
    filePath,
    '    {pendingWorkout && !isHomeTab && (',
    '    {pendingWorkout && ('
  ));
});

// 7) Feature flags defaults
ops.push(() => {
  const filePath = path.join(repoRoot, 'lib/config/feature-flags.ts');
  logResult('feature flags new_tab_bar', applyReplace(
    filePath,
    '    new_tab_bar: { enabled: false, rolloutPercent: 0 },',
    '    new_tab_bar: { enabled: true, rolloutPercent: 100 },'
  ));

  logResult('feature flags smart_fab', applyReplace(
    filePath,
    '    smart_fab: { enabled: false, rolloutPercent: 0 },',
    '    smart_fab: { enabled: true, rolloutPercent: 100 },'
  ));

  logResult('feature flags resume_hero', applyReplace(
    filePath,
    '    resume_hero: { enabled: false, rolloutPercent: 0 },',
    '    resume_hero: { enabled: true, rolloutPercent: 100 },'
  ));

  logResult('feature flags storage key', applyReplace(
    filePath,
    "const STORAGE_KEY = '@feature_flags_v2';",
    "const STORAGE_KEY = '@feature_flags_v3';"
  ));
});

for (const op of ops) {
  try {
    op();
  } catch (error) {
    console.error('[error]', error);
    process.exitCode = 1;
  }
}
