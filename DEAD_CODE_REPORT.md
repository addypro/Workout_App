# Dead Code Audit Report

> Generated: 2026-01-12T03:55:20.844Z

> ⚠️ **This is a READ-ONLY report.** No files have been deleted.
> Review each candidate carefully before manual removal.

## Summary

| Metric | Count |
|--------|-------|
| Total Files Analyzed | 218 |
| Entry Points (routes, scripts) | 42 |
| Immune Files (configs, assets) | 22 |
| Reachable via Imports | 59 |
| **Candidates for Removal** | **159** |

## ⚠️ Candidates for Removal

These files were not imported by any reachable code.
**Verify each one before deleting:**

### `__tests__/`

- [ ] `pr-detector.pbt.ts`
- [ ] `semantic-search.pbt.ts`
- [ ] `workout-progress.pbt.ts`

### `components/`

- [ ] `bottom-action-bar.tsx`
- [ ] `breadcrumb-nav.tsx`
- [ ] `expandable-fab.tsx`
- [ ] `haptic-tab.tsx`
- [ ] `one-rm-calculator.tsx`
- [ ] `plate-calculator.tsx`
- [ ] `profile-button.tsx`
- [ ] `quick-entry-modal.tsx`
- [ ] `rest-timer.tsx`
- [ ] `screen.tsx`
- [ ] `swipe-tabs.tsx`
- [ ] `sync-status-indicator.tsx`
- [ ] `theme-picker.tsx`
- [ ] `themed-text.tsx`
- [ ] `themed-view.tsx`
- [ ] `weight-unit-picker.tsx`
- [ ] `workout-picker-modal.tsx`

### `components/auth/`

- [ ] `profile-button.tsx`

### `components/coach/`

- [ ] `index.ts`
- [ ] `ProgramCalendar.tsx`

### `components/exercise/`

- [ ] `create-custom-modal.tsx`
- [ ] `exercise-card.tsx`
- [ ] `exercise-disambiguation.tsx`
- [ ] `index.ts`

### `components/history/`

- [ ] `workout-history-card.tsx`

### `components/program/`

- [ ] `index.ts`
- [ ] `my-program-card.tsx`
- [ ] `program-card.tsx`
- [ ] `program-overview.tsx`

### `components/ui/`

- [ ] `card-header.tsx`
- [ ] `card.tsx`
- [ ] `section-title.tsx`
- [ ] `skeleton.tsx`
- [ ] `swipeable-card.tsx`
- [ ] `text-field.tsx`

### `components/voice/`

- [ ] `clarification-modal.tsx`
- [ ] `index.ts`
- [ ] `voice-input-button.tsx`
- [ ] `voice-logging-modal.tsx`
- [ ] `voice-recorder.tsx`

### `components/workout/`

- [ ] `index.ts`
- [ ] `quick-set-input.tsx`
- [ ] `rpe-input-overlay.tsx`
- [ ] `set-types-guide.tsx`
- [ ] `superset-card.tsx`

### `constants/`

- [ ] `theme.ts`

### `hooks/`

- [ ] `use-color-scheme.ts`
- [ ] `use-color-scheme.web.ts`
- [ ] `use-theme-color.ts`

### `lib/constants/`

- [ ] `routes.ts`

### `lib/context/`

- [ ] `auth-context.tsx`
- [ ] `exercise-picker.tsx`
- [ ] `preferences-context.tsx`
- [ ] `program-import-context.tsx`
- [ ] `sync-context.tsx`
- [ ] `tab-context.tsx`
- [ ] `theme-context.tsx`

### `lib/data/`

- [ ] `program-catalog.repo.ts`
- [ ] `program-install.repo.ts`

### `lib/db/`

- [ ] `storage.ts`

### `lib/domain/`

- [ ] `program.ts`

### `lib/hooks/`

- [ ] `index.ts`
- [ ] `use-async-data.ts`
- [ ] `use-direct-voice.ts`
- [ ] `use-optimistic.ts`
- [ ] `use-paginated-data.ts`
- [ ] `use-selection.ts`
- [ ] `use-voice-workout.ts`

### `lib/machines/`

- [ ] `index.ts`
- [ ] `rest-timer.actor.ts`
- [ ] `superset.machine.ts`
- [ ] `sync-item.machine.ts`
- [ ] `use-workout-machine.ts`
- [ ] `voice-coordinator.machine.ts`
- [ ] `workout-session.machine.ts`

### `lib/navigation/`

- [ ] `types.ts`

### `lib/services/coach/`

- [ ] `exercises.ts`
- [ ] `index.ts`
- [ ] `invites.ts`
- [ ] `profile.ts`
- [ ] `programs.ts`
- [ ] `types.ts`

### `lib/services/exercise/`

- [ ] `categories.ts`
- [ ] `custom-exercises.ts`
- [ ] `database.ts`
- [ ] `index.ts`
- [ ] `matcher.ts`
- [ ] `progression-dag.ts`
- [ ] `search.ts`
- [ ] `semantic-search.ts`
- [ ] `sync-service.ts`
- [ ] `types.ts`

### `lib/services/notifications/`

- [ ] `index.ts`
- [ ] `push-service.ts`
- [ ] `types.ts`

### `lib/services/offline/`

- [ ] `index.ts`
- [ ] `workout-cache.ts`

### `lib/services/parser/`

- [ ] `csv.ts`
- [ ] `excel.ts`
- [ ] `extractor-service.ts`
- [ ] `types.ts`

### `lib/services/parser/pdf/`

- [ ] `index.ts`
- [ ] `normalizer.ts`
- [ ] `service.ts`
- [ ] `types.ts`

### `lib/services/popularity/`

- [ ] `algorithm.ts`
- [ ] `cache.ts`
- [ ] `global-rankings.ts`
- [ ] `index.ts`
- [ ] `normalizer.ts`

### `lib/services/programs/`

- [ ] `index.ts`
- [ ] `kaggle-loader.ts`
- [ ] `programs-service.ts`
- [ ] `types.ts`

### `lib/services/programs/data/`

- [ ] `bodyweight-programs.ts`
- [ ] `hypertrophy-programs.ts`
- [ ] `more-programs.ts`
- [ ] `specialized-programs.ts`
- [ ] `strength-programs.ts`

### `lib/services/sync/`

- [ ] `index.ts`
- [ ] `popularity-sync.ts`
- [ ] `queue.ts`
- [ ] `types.ts`
- [ ] `workout-sync.ts`

### `lib/services/voice/`

- [ ] `cache.ts`
- [ ] `coordinator.ts`
- [ ] `direct-intent-types.ts`
- [ ] `embeddings.ts`
- [ ] `enhanced-parser.ts`
- [ ] `index.ts`
- [ ] `intent-mapping.ts`
- [ ] `native-stt.ts`
- [ ] `types.ts`
- [ ] `vocabulary.ts`
- [ ] `voice-direct-service.ts`
- [ ] `vosk-stt.ts`
- [ ] `whisper-stt.ts`

### `lib/services/voice/ufire/`

- [ ] `contextual-flow.ts`
- [ ] `frequency-tracker.ts`
- [ ] `index.ts`
- [ ] `scoring-engine.ts`

### `lib/services/workout/`

- [ ] `pr-detector.ts`
- [ ] `voice-parser.ts`

### `lib/styles/`

- [ ] `index.ts`
- [ ] `shared.ts`

### `lib/types/`

- [ ] `brands.ts`
- [ ] `program.ts`
- [ ] `result-types.ts`
- [ ] `workout-session.ts`

### `lib/utils/`

- [ ] `colors.ts`
- [ ] `csv-export.ts`
- [ ] `fuzzy.ts`
- [ ] `navigation.ts`
- [ ] `parser-utils.ts`
- [ ] `string-distance.ts`
- [ ] `weight.ts`

---

## How to Verify Candidates

Before removing any file, check for these **false positive** scenarios:

### 1. Dynamic Imports
```typescript
// This import won't be detected statically:
const module = await import(`./modules/${name}`);
```
**Action:** Search for dynamic import patterns using the file name.

### 2. Re-exports from Barrel Files
```typescript
// index.ts might export from the "unused" file
export * from './utils';
```
**Action:** Check if any `index.ts` re-exports the file.

### 3. Used Only in Tests
Test files are immune, but their direct imports are tracked.
**Action:** Search for the file in `__tests__/` or `*.test.ts` files.

### 4. Used in Package Scripts
```json
{ "scripts": { "migrate": "ts-node lib/db/migrate.ts" } }
```
**Action:** Check `package.json` scripts for direct references.

### 5. Referenced in Configs
Metro, Babel, or other tools might reference files.
**Action:** Search in `*.config.js` files.

---

## Safe Removal Process

1. ✅ Verify the file is truly unused (see above)
2. 🔍 Search the entire codebase: `grep -r "filename" .`
3. 🧪 Run tests after removal: `npm test`
4. 📦 Build the project: `npx expo export`
5. 🚀 Test the app on device
