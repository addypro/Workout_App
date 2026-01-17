# Weight-Aware Program System Specification

## Executive Summary

Transform 37 hollow program shells into intelligent, weight-aware training systems. When a user starts a program, the system calibrates their working weights, displays precise load recommendations, adjusts based on performance and recovery, and respects program-specific progression rules.

**Core Principle:** Don't outsmart proven programs. AI calibrates and adjusts weights - it doesn't change exercises or rep schemes.

## Problem Statement

### Current State
```typescript
// All 37 programs look like this:
{
  id: 'stronglifts-5x5',
  name: 'StrongLifts 5x5',
  workouts: [],  // ← EMPTY
  ...metadata
}
```

Programs are metadata shells. Users see "Squat 5x5" but have no idea what weight to use. Without weight context:
- Programs lose their value (rep schemes are weight-dependent)
- Users guess, potentially injuring themselves
- No progressive overload = no gains
- No differentiation from free programs online

### Competitor Analysis (Avoiding Their Mistakes)

| App | Problem | Our Avoidance Strategy |
|-----|---------|------------------------|
| Fitbod | Exercises change randomly, feels unstrategic | **AI adjusts weights only**, never exercises |
| Fitbod | Progressive overload fails, weight suggestions inaccurate | Use **program formulas** (5/3/1, StrongLifts) |
| Fitbod | Algorithm opacity, users don't understand | **Full transparency** + override capability |
| Generic apps | No weight guidance at all | Full calibration + display system |

## Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Program completion rate | >60% (vs current ~20%) | Users completing full program duration |
| 1RM improvement | +15% in 12 weeks | Tracked via test days or AMRAP estimation |
| User override rate | <20% | If users constantly override, suggestions are bad |
| Calibration completion | >90% | Users who start calibration and finish |
| Daily active users | +40% | Users returning to complete workouts |

## User Personas

### The Beginner
- No workout history, doesn't know their 1RM
- Needs guided calibration (test sets or experience questions)
- Wants clear "do this" recommendations

### The Returning Lifter
- Has workout history in app
- Wants history-based calibration (pull recent bests)
- Expects system to "know" their capabilities

### The Experienced Lifter
- Knows their numbers, wants to input them
- Expects precise percentage-based programming
- Wants transparency and override capability

### The Recovery-Focused
- Wears WHOOP/Oura, tracks sleep
- Wants system to factor in readiness
- Appreciates auto-adjustment for bad recovery days

## User Journey

### Phase 1: Program Discovery
```
User browses programs → sees "StrongLifts 5x5"
Card shows:
- Difficulty: Beginner
- Duration: 12 weeks
- Days/week: 3
- Equipment: Barbell, Rack, Bench
- NEW: "Calibration required to start" badge
```

### Phase 2: Calibration Wizard

```
[Step 1: History Check]
"I found you've done these exercises before:"
- Squat: Best set 225lb x 5 (2 weeks ago)
- Bench: Best set 155lb x 6 (1 week ago)
- Deadlift: No data

"Should I use this to estimate your starting weights?"
[Yes, use my history] [No, let me input manually] [Test my current strength]

[Step 2: Missing Data]
"I don't have data for Deadlift and Overhead Press."
Options:
- Input your known 1RM/5RM
- Estimate based on your squat/bench ratio
- Do a quick test session
- Start conservative and adjust

[Step 3: Health Integration]
"Connect recovery data for smarter adjustments?"
- Apple Health (sleep, HRV, activity)
- WHOOP (recovery score, strain)
- Oura (readiness score)
- Skip for now (manual input)

[Step 4: User Levers]
"Personalize your progression:"
- Diet adherence: [Dialed in] [Mostly good] [Variable] [Cutting]
- Stress level: [Low] [Moderate] [High] [Extremely high]
- Intensity preference: [Push hard] [Balanced] [Conservative]
- Progression goal: [Aggressive] [Steady] [Patient]

[Step 5: Confirmation]
"Based on your data, here are your starting weights:"

| Exercise | Estimated 1RM | Week 1 Working Weight |
|----------|--------------|----------------------|
| Squat | 265lb | 155lb (5x5 @ 60%) |
| Bench | 185lb | 110lb (5x5 @ 60%) |
| Deadlift | 315lb* | 185lb (1x5 @ 60%) |
| OHP | 115lb* | 70lb (5x5 @ 60%) |
| Row | 155lb* | 95lb (5x5 @ 60%) |

*Estimated from ratios

[Looks good] [Adjust weights] [Redo calibration]
```

### Phase 3: Workout Execution

```
Today's Workout: StrongLifts A

Squat: 5x5 @ 160lb
├─ 60% of 265lb 1RM
├─ Target RPE: 7
└─ Last session: 155lb x 5x5 ✓ (+5lb today)

[Recovery adjustment: None - WHOOP shows 78% recovery]

Set 1: [5] [4] [3] [2] [1] [0]  ← tap completed reps
       160lb                    ← weight (editable)

[Why this weight?]  ← expands to show full calculation
```

### Phase 4: Auto-Adjustment

```
After workout completion:

"Great session! Here's what happens next:"

✓ Completed 5x5 @ 160lb
→ Next Squat session: 165lb (+5lb per StrongLifts protocol)

[Override] [Accept]

---

If failed (e.g., only got 4,4,3,3,2):

"Looks like 160lb was challenging today."

StrongLifts protocol: Retry same weight next session.
After 3 failures: Deload to 145lb (-10%)

Current failure count: 1/3

Your WHOOP showed 42% recovery - this may have contributed.

[Accept protocol] [Override - I want to deload now] [Override - I want to retry higher]
```

### Phase 5: Weekly Check-in (Optional)

```
Weekly Pulse Check

How's training going?
- [Feeling strong] → maintain or slight bump
- [Steady progress] → continue as planned
- [Feeling beat up] → suggest lighter week
- [Life is chaos] → reduce volume/intensity

Sleep quality this week?
- [Great] [OK] [Poor] [Terrible]

Diet adherence?
- [On point] [Mostly] [Struggling]

[Update my program] [Keep as is]
```

## Functional Requirements

### P0: Must Have

#### 1. Calibration System
- **History-based calibration**: Pull best recent sets for each exercise
- **Manual input**: Accept user-provided 1RM/5RM values
- **AI estimation**: Estimate missing lifts from known lifts (using strength ratios)
- **Test session**: Generate a calibration workout to establish baselines
- **Cold start**: Experience questions for users with no history

**Acceptance Criteria:**
- User can complete calibration in <3 minutes if they have history
- User can complete calibration in <10 minutes with test sets
- System estimates 1RM within 10% of actual (validated via subsequent AMRAP)

#### 2. Weight Display
- **Hybrid format**: "165lb (62% of 265lb 1RM, target RPE 7)"
- **Transparency**: "Why this weight?" expandable explanation
- **Override**: User can change weight, system learns from delta

**Acceptance Criteria:**
- Weight shown for every set of every exercise
- User can see calculation breakdown in 1 tap
- Override is 2 taps max

#### 3. Progression Engine

| Program Type | Progression Rule | Failure Protocol | Deload |
|--------------|------------------|------------------|--------|
| StrongLifts | +5lb/session | Retry x3, then -10% | After 3 failures |
| Starting Strength | +5lb/session | Coach decision | Manual |
| 5/3/1 | +5lb upper/+10lb lower per cycle | AMRAP autoregulates | Week 4 built-in |
| GZCLP | +5lb/session | Rep scheme change (5x3→6x2→10x1) | Every 4-6 weeks |
| PPL | +5lb/session or 2.5lb for isolation | Retry x2, then -10% | After 2 failures |
| Hypertrophy | +weight when RPE <7 on all sets | Reduce to RPE 8 target | Every 4th week |

**Acceptance Criteria:**
- Each of the 37 programs has a defined progression rule
- System automatically applies rule after workout completion
- User can override but sees warning if overriding frequently

#### 4. Workout Generation
- **Template expansion**: Convert program metadata into actual workout data
- **Personalization**: Apply calibrated weights to template
- **Exercise database link**: Connect program exercises to exercise DB

**Acceptance Criteria:**
- All 37 programs have complete workout definitions
- Workouts render with correct exercises, sets, reps, weights
- Exercises link to video/instructions from exercise database

### P1: Should Have

#### 5. Health Integration
- **Apple HealthKit**: Sleep duration, HRV (if available), activity
- **Unified API** (TryTerra/Spike): WHOOP, Oura, Garmin recovery scores
- **Recovery adjustment**: Reduce intensity on low recovery days

**Acceptance Criteria:**
- System reads recovery data when available
- Shows "Recovery: 78%" or similar indicator
- Adjusts weight recommendations by ±5-10% based on recovery

#### 6. User Levers
- **Diet adherence**: Affects recovery expectations
- **Stress level**: Affects CNS readiness assumptions
- **Intensity preference**: Aggressive vs conservative progression
- **Progression goal**: Fast vs sustainable

**Acceptance Criteria:**
- User can set preferences during calibration
- User can update preferences anytime
- System visibly adjusts based on preferences

#### 7. Smart Program Matching
- **Goal-based**: "I want to get stronger" → Strength programs
- **Equipment-based**: "I have dumbbells only" → Home programs
- **History-based**: "You've been doing PPL, here's a progression"
- **Calibration-based**: "Your numbers suggest intermediate programs"

**Acceptance Criteria:**
- User can get recommendations from onboarding flow
- Recommendations explain why they're suggested
- User can override and pick any program

### P2: Nice to Have

#### 8. Predictive Trajectory
- Show projected 1RM in 4/8/12 weeks if user follows program
- "At this rate, you'll squat 315lb by March 15"

#### 9. Deload Automation
- Detect staleness (3+ sessions without PR)
- Suggest or auto-schedule deload week

#### 10. Voice Logging
- "Log squat 165 for 5" during rest
- Hands-free weight/rep logging

## Technical Architecture

### Data Model

```typescript
// New types for progression system
interface ProgressionRule {
  type: 'linear' | 'percentage' | 'undulating' | 'autoregulated';
  increment: {
    upper: number;  // lbs to add for upper body
    lower: number;  // lbs to add for lower body
  };
  frequency: 'session' | 'week' | 'cycle';
  failureProtocol: FailureProtocol;
  deloadTrigger: DeloadTrigger;
}

interface FailureProtocol {
  type: 'retry' | 'deload' | 'scheme_change';
  retryCount?: number;          // for 'retry'
  deloadPercent?: number;       // for 'deload' (e.g., 10 for -10%)
  schemeProgression?: string[]; // for 'scheme_change' (e.g., ['5x3', '6x2', '10x1'])
}

interface DeloadTrigger {
  type: 'failure_count' | 'scheduled' | 'recovery_based' | 'manual';
  failureThreshold?: number;    // for 'failure_count'
  weekInterval?: number;        // for 'scheduled' (e.g., 4 for every 4th week)
  recoveryThreshold?: number;   // for 'recovery_based' (e.g., 50 for <50% recovery)
}

interface UserCalibration {
  userId: string;
  programId: string;
  calibratedAt: string;
  estimatedMaxes: Record<string, EstimatedMax>;
  userLevers: UserLevers;
  healthIntegrations: HealthIntegration[];
}

interface EstimatedMax {
  exerciseId: string;
  oneRM: number;
  confidence: 'high' | 'medium' | 'low';
  source: 'history' | 'test' | 'manual' | 'estimated';
  lastUpdated: string;
}

interface UserLevers {
  dietAdherence: 'dialed' | 'mostly_good' | 'variable' | 'cutting';
  stressLevel: 'low' | 'moderate' | 'high' | 'extreme';
  intensityPreference: 'push_hard' | 'balanced' | 'conservative';
  progressionGoal: 'aggressive' | 'steady' | 'patient';
}

interface HealthIntegration {
  source: 'apple_health' | 'whoop' | 'oura' | 'garmin' | 'manual';
  connected: boolean;
  lastSync: string;
  recoveryScore?: number;  // 0-100
  sleepScore?: number;     // 0-100
  strainScore?: number;    // 0-21 for WHOOP
}

// Extend existing Exercise interface
interface ProgramExercise extends Exercise {
  percentageOf1RM?: number;    // e.g., 80 for 80%
  rpeTarget?: number;          // e.g., 8
  amrap?: boolean;             // last set is AMRAP
  warmupSets?: WarmupSet[];    // auto-generated warmup
}

interface WarmupSet {
  percentage: number;  // of working weight
  reps: number;
}

// Extend WorkoutProgram with progression rules
interface WorkoutProgramV2 extends WorkoutProgram {
  progressionRule: ProgressionRule;
  calibrationRequired: boolean;
  estimatedDuration: number;    // minutes per session
  primaryLifts: string[];       // exercise IDs that need calibration
}
```

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI Layer (React Native)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Calibration │  │   Workout   │  │    Progress Dashboard   │ │
│  │   Wizard    │  │   Session   │  │   (weights over time)   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                     Progression Engine                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Calibration │  │   Weight    │  │     Adjustment          │ │
│  │   Service   │  │  Calculator │  │      Engine             │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│         │                │                    │                 │
│  ┌──────▼────────────────▼────────────────────▼──────────────┐ │
│  │                 Program Rules Engine                       │ │
│  │  [StrongLifts] [5/3/1] [GZCLP] [PPL] [Hypertrophy] ...    │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    Data/Integration Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Workout   │  │    Paths    │  │    Health APIs          │ │
│  │   History   │  │   Engine    │  │  (HealthKit, TryTerra)  │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Integrations

| System | Purpose | Implementation |
|--------|---------|----------------|
| **Workout History** | Source for calibration | Existing `lib/db/storage.ts` |
| **Paths Engine** | Weight-aware training paths | Extend `lib/services/paths/` |
| **Apple HealthKit** | Sleep, HRV, activity | `react-native-health` package |
| **Unified Health API** | WHOOP/Oura/Garmin | TryTerra or Spike API |
| **Exercise Database** | Exercise details, videos | Existing `lib/services/exercise/` |

### Security Model

- **Health data**: Stored locally only, never sent to backend without consent
- **Calibration data**: Synced to Supabase for cross-device
- **Integration tokens**: Stored in SecureStore, not AsyncStorage

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| **Calibration latency** | <500ms to generate weights from history |
| **Workout render** | <200ms to display workout with weights |
| **Health sync** | Background, <1 minute after app open |
| **Offline support** | Full workout capability without network |
| **Storage** | <50MB additional for program data |

## Out of Scope

- **AI-generated exercises**: We use program templates, AI only adjusts weights
- **Nutrition tracking**: Beyond diet adherence lever
- **Social features**: No sharing, challenges, etc. in this spec
- **Custom program builder**: Focus on curated 37 programs first
- **Video form feedback**: AI form checking via camera

## Open Questions for Implementation

1. **Program data format**: Should workout definitions live in code or be fetched from Supabase?
2. **Offline calibration**: How to estimate 1RM without history when offline?
3. **Unified API choice**: TryTerra vs Spike vs direct integrations?
4. **Migration**: How do existing users get calibrated for programs they're already doing?
5. **Testing**: How to validate 1RM estimations are accurate?

## Appendix: Research Findings

### Calibration Approaches (from research)
- **Hevy/Strong**: No explicit calibration, builds from logs over time
- **Fitbod**: AI estimates from 400M+ data points, Brzycki formula
- **JuggernautAI**: User inputs + daily readiness adjustment

### Progression Rules (from research)
| Program | Increment | Failure | Deload |
|---------|-----------|---------|--------|
| StrongLifts | +5lb/session | Retry x3 → -10% | After 3 failures |
| 5/3/1 | +5/10lb per cycle | AMRAP autoregulates | Week 4 |
| GZCLP | +5lb/session | Rep scheme change | Every 4-6 weeks |

### Fitbod Criticisms (from Reddit)
- Exercises change too randomly
- Progressive overload fails
- Algorithm is opaque
- Slow to show results

**Our Mitigation:**
- AI adjusts weights only, never exercises
- Use proven program formulas
- Full transparency + override
- Respect program design, don't outsmart it

## Implementation Phases

### Phase 1: Foundation (2-3 weeks)
- Define WorkoutProgramV2 types
- Implement ProgressionRule for 5 core programs (StrongLifts, 5/3/1, GZCLP, PPL, Hypertrophy)
- Build Calibration Wizard UI
- Implement history-based calibration

### Phase 2: Full System (2-3 weeks)
- Extend to all 37 programs
- Build Weight Calculator with transparency
- Implement failure/deload protocols
- Add manual override with learning

### Phase 3: Intelligence (2-3 weeks)
- Apple HealthKit integration
- TryTerra/Spike integration
- User levers system
- Recovery-based adjustments

### Phase 4: Polish (1-2 weeks)
- Smart program matching
- Predictive trajectory
- Edge case handling
- Performance optimization

---

*Generated: 2026-01-17*
*Discovery Session: weight-aware-programs*
