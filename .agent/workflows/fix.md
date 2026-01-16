---
description: Bug investigation and fix workflow - diagnose → fix → test → commit
---
# Fix Workflow

Structured approach to bug investigation and resolution.

## Usage
```
/fix [scope] [description]
```

## Scopes
- `bug` - General bug (default)
- `type` - TypeScript errors
- `crash` - App crashes
- `ui` - UI/styling issues
- `perf` - Performance issues

## Workflow Steps

### Phase 1: Investigation
// turbo
1. Gather context about the bug:
   - What's the expected behavior?
   - What's the actual behavior?
   - When did it start happening?
   - Any error messages?

2. Search for relevant code:
   ```
   Use grep_search and view_file to find affected code
   ```

### Phase 2: Diagnosis
3. Analyze the code to find root cause:
   - Check for recent changes (if known)
   - Trace data flow
   - Look for edge cases
   - Check related tests

4. Document findings:
   - Root cause
   - Affected files
   - Proposed fix

### Phase 3: Human Checkpoint
5. Present diagnosis to user:
   ```
   ## Diagnosis Report
   
   **Root Cause:** [description]
   **Affected Files:** [list]
   **Proposed Fix:** [approach]
   
   Proceed with fix? [Y/n]
   ```

### Phase 4: Implementation
6. Implement the fix:
   - Make minimal changes to fix the bug
   - Follow existing code patterns
   - Add inline comments if logic is non-obvious

### Phase 5: Verification
// turbo
7. Run TypeScript check:
   ```bash
   npx tsc --noEmit --skipLibCheck
   ```

8. Run tests if applicable:
   ```bash
   npm test
   ```

### Phase 6: Review
9. Present changes to user for review:
   - Show diff summary
   - Explain what was changed and why
   - Ask for confirmation

## Error Handling

| Situation | Action |
|-----------|--------|
| Can't reproduce | Ask user for more context |
| Multiple causes | Fix most likely first |
| Fix breaks other tests | Rollback, refine approach |
| Uncertain diagnosis | Present options to user |

## Examples

### TypeScript Error Fix
```
/fix type Property 'foo' does not exist on type 'Bar'
```

### UI Bug Fix
```
/fix ui Button not responding on tap
```

### Performance Issue
```
/fix perf Screen takes 5 seconds to load
```
