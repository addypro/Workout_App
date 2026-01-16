---
description: Goal-based workflow router - helps you choose the right approach for your task
---
# Workflow Router

Routes tasks to the appropriate workflow based on your goal.

## When User Types `/workflow`

Ask the user to clarify their primary goal:

1. **Research** - Understand something unfamiliar
   - Explore codebase, investigate libraries, learn concepts
   - Tool: grep_search, view_file, read_url_content
   
2. **Plan** - Design a solution before coding
   - Create implementation plan for user review
   - Tool: Create implementation_plan.md artifact
   
3. **Build** - Implement a feature
   - Write new code, create components
   - Chain: Plan → Review → Implement → Verify
   
4. **Fix** - Debug and fix an issue
   - Investigate bug → Diagnose → Fix → Test
   - Workflow: /fix

## Workflow Selection Questions

### Phase 1: Goal
```
What's your primary goal?
1. Research - understand something
2. Plan - design a solution
3. Build - implement a feature  
4. Fix - debug an issue
```

### Phase 2: Complexity
```
How complex is this task?
1. Simple (1-2 files, straightforward)
2. Medium (multiple files, needs planning)
3. Complex (cross-cutting, needs deep analysis)
```

### Phase 3: Execution
Based on answers, route to:
- Simple + Research → Direct investigation
- Medium + Build → /build workflow
- Complex + Fix → /fix workflow with diagnosis
- Any + Plan → Create implementation_plan.md

## Recommended Flows

### Research Flow
1. Identify target (file, concept, library)
2. Use grep_search and view_file
3. Summarize findings for user

### Plan Flow
1. Gather requirements from user
2. Analyze affected code
3. Create implementation_plan.md
4. Request user review via notify_user

### Build Flow
1. Use /build workflow
2. Follow planning → implementation → verification

### Fix Flow
1. Use /fix workflow
2. Follow investigation → diagnosis → fix → test
