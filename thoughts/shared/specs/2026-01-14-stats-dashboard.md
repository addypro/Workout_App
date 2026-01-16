# Stats Dashboard Specification

## Executive Summary

A new "Stats" tab for Workout_App that provides Hevy-style rich visualizations of workout progress, including per-exercise weight progression charts, volume metrics, training frequency analytics, and comprehensive personal record (PR) tracking. This is a quick-win MVP focused on the most impactful analytics feature.

## Problem Statement

Users currently have no way to visualize their progress over time within the app. Without analytics:
- No visibility into whether lifts are improving
- No celebration or awareness of personal records
- No data to prevent plateaus or guide progression
- Users resort to mental tracking or external spreadsheets

## Success Criteria

| Metric | Target |
|--------|--------|
| User can view progress charts | Within 2 taps from home |
| PR detection accuracy | 100% for logged workouts |
| Chart load time | < 500ms for 3 months of data |
| User engagement | Stats tab opened at least 1x/week |

## User Personas

**Primary:** Intermediate lifter who logs workouts consistently and wants to see tangible evidence of progress. Not a data scientist - wants insights at a glance, not raw numbers.

**Technical Level:** Non-technical. Expects charts to "just work" without configuration.

## User Journey

### Primary Flow: Checking Progress

1. User opens app
2. Taps "Stats" tab in bottom navigation
3. Sees dashboard with:
   - Summary cards (total workouts, PRs this month, streak)
   - Recent PR highlights
   - "Your Progress" section with exercise cards
4. Taps an exercise card (e.g., "Bench Press")
5. Sees full-screen chart with:
   - Weight over time (line chart)
   - All-time PR badge
   - Volume trend
6. Can swipe or tap to see other exercises

### Secondary Flow: Post-Workout PR Discovery

1. User completes workout
2. Summary screen shows "You hit 2 PRs!"
3. Tapping PR notification opens Stats tab filtered to those exercises

## Functional Requirements

### Must Have (P0)

#### Stats Tab
- [ ] New tab in bottom navigation bar with chart icon
- [ ] Dashboard layout with summary section at top
- [ ] Scrollable list of exercise progress cards below

#### Summary Section
- [ ] Total workouts count (all time)
- [ ] PRs hit this month
- [ ] Current workout streak (consecutive days/weeks)
- [ ] Last workout date

#### Exercise Progress Cards
- [ ] Show exercises user has logged (sorted by frequency)
- [ ] Mini sparkline chart showing weight trend
- [ ] Current PR badge with weight value
- [ ] Tap to expand to full chart view

#### Exercise Detail View
- [ ] Full-screen line chart (weight over time)
- [ ] X-axis: dates, Y-axis: weight
- [ ] Data points for each logged set (use max weight per session)
- [ ] PR markers on chart (star icon at PR points)
- [ ] Time range selector (1M, 3M, 6M, 1Y, All)

#### PR Tracking System
- [ ] Detect 1RM PRs (heaviest single rep)
- [ ] Detect rep PRs (e.g., best 5-rep set)
- [ ] Detect volume PRs (highest total volume in session)
- [ ] Store PR history with dates

### Should Have (P1)

#### Volume Analytics
- [ ] Weekly/monthly volume totals
- [ ] Volume trend chart (line or bar)
- [ ] Volume by muscle group breakdown

#### Frequency Analytics
- [ ] Muscle group training frequency (days/week)
- [ ] Pie or bar chart of muscle distribution
- [ ] "Days since last trained" per muscle group

#### Real-time PR Alerts
- [ ] During workout: "New PR!" toast notification
- [ ] Haptic feedback on PR
- [ ] Confetti or celebration animation

### Nice to Have (P2)

- [ ] Export stats as image for sharing
- [ ] Workout-to-workout comparison view
- [ ] Goal setting (target weights)
- [ ] Predicted 1RM calculations (Epley formula)

## Technical Architecture

### Data Model

```typescript
// Existing: WorkoutHistoryRecord in lib/db/storage.ts
// New: PR tracking

interface PersonalRecord {
  id: string;
  odexerciseName: string;
  recordType: 'ONE_REP_MAX' | 'REP_PR' | 'VOLUME_PR';
  value: number;          // weight for 1RM/rep PR, total for volume
  reps?: number;          // for rep PRs (e.g., 5RM)
  achievedAt: string;     // ISO date
  workoutId: string;      // reference to workout where achieved
}

interface ExerciseStats {
  exerciseName: string;
  totalSets: number;
  totalVolume: number;    // sum of (weight * reps) all time
  lastPerformed: string;
  currentPR: PersonalRecord | null;
  prHistory: PersonalRecord[];
  progressData: {
    date: string;
    maxWeight: number;
    totalVolume: number;
  }[];
}

interface StatsSnapshot {
  totalWorkouts: number;
  currentStreak: number;
  prsThisMonth: number;
  exerciseStats: Map<string, ExerciseStats>;
  lastUpdated: string;
}
```

### System Components

```
┌─────────────────────────────────────────────────┐
│                  Stats Tab UI                    │
│  ┌─────────────┐  ┌─────────────────────────┐   │
│  │ Summary     │  │ Exercise Progress List  │   │
│  │ Cards       │  │ (virtualized)           │   │
│  └─────────────┘  └─────────────────────────┘   │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│              Stats Service Layer                 │
│  - calculateStats()                              │
│  - detectPRs(workout)                           │
│  - getExerciseProgress(name)                    │
│  - aggregateVolume(timeRange)                   │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│           Existing Data Layer                    │
│  - getUnifiedHistory() from storage.ts          │
│  - AsyncStorage (local)                         │
│  - Supabase sync (cloud backup)                 │
└─────────────────────────────────────────────────┘
```

### Key Files to Create/Modify

| File | Purpose |
|------|---------|
| `app/(tabs)/stats.tsx` | New Stats tab screen |
| `lib/services/stats/stats-service.ts` | Stats calculation logic |
| `lib/services/stats/pr-detector.ts` | PR detection algorithms |
| `components/stats/summary-cards.tsx` | Summary metrics component |
| `components/stats/exercise-card.tsx` | Exercise progress card |
| `components/stats/progress-chart.tsx` | Line chart wrapper |
| `app/(tabs)/_layout.tsx` | Add Stats tab to navigation |

### Integrations

- **Existing workout history**: Read from `getUnifiedHistory()` in `lib/db/storage.ts`
- **Existing sync**: Use SyncProvider context for cloud backup
- **Charting**: `react-native-gifted-charts` (new dependency)

### Security Model

- All data stays local or syncs via existing Supabase auth
- No new permissions required
- Stats computed client-side from owned workout data

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Performance | Charts render in < 500ms |
| Bundle size | Charting lib < 100KB gzipped |
| Offline | Full functionality without network |
| Memory | Handle 1000+ workouts without OOM |

## Out of Scope

- Social/sharing features (no leaderboards, no friend comparisons)
- Body measurements (weight, body fat tracking)
- Nutrition/calorie integration
- AI-powered insights or recommendations
- Custom date range exports

## Open Questions for Implementation

1. **Chart library choice**: Confirm `react-native-gifted-charts` vs Victory Native for animations
2. **Caching strategy**: Should stats be recomputed on each tab open or cached?
3. **PR notification during workout**: Where to inject detection in workout machine?
4. **Historical data migration**: Any cleanup needed for existing workout data?

## Appendix: Research Findings

### Fitness App Analytics Patterns (from Hevy, Strong)
- Per-exercise line charts are the most valued visualization
- PR celebrations increase engagement significantly
- Post-workout summary is a key moment for analytics exposure
- Minimizing taps to data improves adoption

### React Native Charting Libraries
- `react-native-gifted-charts`: Best for quick setup, Expo compatible
- Victory Native 2: More customization but requires Skia setup
- Performance is adequate for typical workout data volumes (< 1000 points)

**Sources:**
- [Hevy App Best Practices](https://www.hevyapp.com/best-workout-tracker-app/)
- [React Native Chart Libraries 2025](https://blog.openreplay.com/react-native-chart-libraries-2025/)
