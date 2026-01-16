---
description: Feature development workflow - plan → validate → implement → verify
---
# Build Workflow

Structured approach to feature development.

## Usage
```
/build [mode] [description]
```

## Modes
- `greenfield` - New feature from scratch
- `brownfield` - Adding to existing code (default)
- `tdd` - Test-driven development
- `refactor` - Improve existing code structure

## Workflow Steps

### Phase 1: Understanding
1. Clarify requirements:
   - What should the feature do?
   - What's the acceptance criteria?
   - Any constraints or preferences?

2. Research existing code:
   - Find related components
   - Identify integration points
   - Check for reusable patterns

### Phase 2: Planning
3. Create implementation plan:
   - List files to create/modify
   - Define component structure
   - Identify dependencies

4. Write plan to artifact:
   ```
   Create implementation_plan.md with:
   - Goal description
   - Proposed changes by file
   - Verification plan
   ```

### Phase 3: Human Checkpoint
5. Request plan review:
   ```
   Use notify_user with PathsToReview = [implementation_plan.md]
   BlockedOnUser = true
   ```

Wait for user approval before proceeding.

### Phase 4: Implementation
// turbo
6. Create/modify files according to plan:
   - Follow existing code patterns
   - Add proper types
   - Include error handling

7. Update imports and exports as needed

### Phase 5: Verification
// turbo
8. Run TypeScript check:
   ```bash
   npx tsc --noEmit --skipLibCheck
   ```

9. Run tests if applicable:
   ```bash
   npm test
   ```

10. Manual verification:
    - Test the feature works as expected
    - Check for edge cases

### Phase 6: Documentation
11. Update walkthrough.md with:
    - What was built
    - How to use it
    - Any important notes

## Mode-Specific Steps

### Greenfield Mode
- Start with clean slate
- Define all interfaces first
- Build from foundation up

### Brownfield Mode (Default)
- Study existing patterns first
- Integrate with current architecture
- Minimize breaking changes

### TDD Mode
- Write failing test first
- Implement minimal code to pass
- Refactor while keeping tests green

### Refactor Mode
- Ensure tests exist before starting
- Make incremental changes
- Verify tests pass after each change

## Examples

### New Component
```
/build greenfield Add voice feedback component for workout completion
```

### Extend Existing Feature
```
/build brownfield Add filtering to exercise picker by muscle group
```

### Test-Driven
```
/build tdd Implement XP calculation with bonus for streaks
```

### Refactoring
```
/build refactor Extract workout timer logic into custom hook
```
