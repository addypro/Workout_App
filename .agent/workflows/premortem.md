---
description: Risk analysis before implementation - identify and mitigate risks
---
# Premortem Workflow

Analyze potential risks before implementing changes.

## Usage
```
/premortem [mode] [description or plan path]
```

## Modes
- `quick` - Fast risk check (5 min)
- `deep` - Comprehensive analysis (15 min)

## Risk Categories

### Technical Risks
- Will this break existing functionality?
- Are there edge cases not covered?
- Does this match codebase patterns?
- Any type safety concerns?

### Integration Risks
- Will this affect other components?
- Are there API changes needed?
- Database schema impacts?
- External dependency issues?

### UX Risks
- Will users understand this?
- Is the flow intuitive?
- Any accessibility concerns?
- Performance impact on UI?

## Workflow Steps

### Quick Mode
1. Review the proposed changes
2. Check for obvious risks:
   - Breaking changes
   - Missing error handling
   - Type mismatches
3. Report findings with severity

### Deep Mode
1. All Quick Mode checks, plus:
2. Trace affected code paths
3. Check for cascading effects
4. Review related tests
5. Consider rollback strategy
6. Document mitigation steps

## Risk Severity Levels

| Level | Description | Action |
|-------|-------------|--------|
| 🟢 LOW | Minor issues, easy to fix | Proceed, note for later |
| 🟡 MEDIUM | Needs attention | Address before or during implementation |
| 🔴 HIGH | Blocking issue | Must resolve before proceeding |

## Output Format

```markdown
## Premortem Report

### Summary
- 🟢 X low risks
- 🟡 Y medium risks  
- 🔴 Z high risks

### High Risks (Must Address)
1. **[Risk Name]**
   - Impact: [What could go wrong]
   - Mitigation: [How to prevent/handle]

### Medium Risks (Recommended)
1. **[Risk Name]**
   - Impact: [What could go wrong]
   - Mitigation: [How to prevent/handle]

### Low Risks (Note)
1. **[Risk Name]** - [Brief note]

### Recommendation
[Proceed / Address high risks first / Reconsider approach]
```

## Examples

### Quick Check
```
/premortem quick Adding new state to workout screen
```

### Deep Analysis
```
/premortem deep Refactoring authentication flow
```

## When to Use

- Before implementing large features
- Before refactoring core logic
- Before making breaking changes
- When uncertain about approach
