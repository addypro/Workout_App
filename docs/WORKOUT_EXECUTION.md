# Live Workout Execution Feature

## Overview
Complete workout execution system allowing users to track their workouts in real-time with set-by-set completion, rest timers, and comprehensive progress tracking.

---

## Features

### 1. Active Workout Screen (`/workout/[id]`)

**Dual View System:**
- **Current Mode**: Focus on active exercise with large, clear display
- **Overview Mode**: See all exercises at once with completion status

**Real-Time Tracking:**
- ⏱️ Continuous workout timer (MM:SS format)
- 📊 Progress bar showing completed sets
- ✅ Set completion checkmarks
- 🎯 Current exercise/set highlighting

**Exercise Information:**
- Exercise name and muscle groups
- Target reps and weight for each set
- All sets overview with completion status
- Visual indicators for current position

### 2. Rest Timer Component

**Features:**
- ⭕ Circular progress indicator
- ⏸️ Pause/Resume controls
- ⏭️ Skip rest option
- 📱 Haptic feedback (vibration at 3-2-1 and completion)
- 👁️ Next exercise preview

**User Experience:**
- Full-screen overlay during rest
- Large countdown display
- Smooth progress animation
- Auto-start next set after rest

### 3. Workout Summary Screen

**Post-Workout Statistics:**
- ⏱️ Total duration
- ✅ Sets completed (e.g., 12/12)
- 🏋️ Exercises completed
- 🔥 Estimated calories burned

**Workout Reflection:**
- 😊 Difficulty rating (Easy, Moderate, Challenging, Very Hard)
- 📝 Notes input for observations
- 💾 Save workout log
- 🗑️ Discard option

---

## User Flow

### Starting a Workout
1. Navigate to Programs tab
2. Find a program with "READY" status
3. Tap "Start Workout" button
4. Workout begins with timer starting automatically

### During Workout
1. **View current exercise details**:
   - Exercise name
   - Target reps and weight
   - Muscle groups worked

2. **Complete a set**:
   - Tap "Complete Set" button
   - Haptic feedback confirms completion
   - Automatic progression to next set
   - Rest timer starts automatically

3. **Rest period**:
   - View countdown timer with circular progress
   - See preview of next exercise
   - Pause/Resume or Skip rest as needed
   - Vibration countdown at 3-2-1 seconds

4. **Switch views**:
   - Tap "Current" for focused view
   - Tap "Overview" to see all exercises
   - Tap any exercise in overview to jump to it

5. **Complete workout**:
   - Automatically navigates to summary after last set
   - Or tap X to exit early (with confirmation)

### After Workout
1. View workout statistics
2. Rate difficulty
3. Add optional notes
4. Save workout or discard
5. Return to Programs tab

---

## Data Models

### WorkoutSession
```typescript
interface WorkoutSession {
  id: string;
  workoutName: string;
  exercises: WorkoutExercise[];
  startTime: Date;
  endTime?: Date;
  currentExerciseIndex: number;
  isResting: boolean;
  restTimeRemaining: number;
  status: 'in_progress' | 'paused' | 'completed' | 'cancelled';
}
```

### WorkoutExercise
```typescript
interface WorkoutExercise {
  id: string;
  name: string;
  sets: WorkoutSet[];
  restTime: number; // seconds between sets
  notes?: string;
  videoUrl?: string;
  muscleGroups?: string[];
  equipment?: string[];
  currentSetIndex: number;
}
```

### WorkoutSet
```typescript
interface WorkoutSet {
  id: string;
  reps: number | string; // "8-10" or "10"
  weight?: number;
  isCompleted: boolean;
  completedAt?: Date;
  actualReps?: number;
  actualWeight?: number;
  rpe?: number; // Rate of Perceived Exertion (1-10)
}
```

### WorkoutSummary
```typescript
interface WorkoutSummary {
  sessionId: string;
  workoutName: string;
  duration: number; // seconds
  totalSets: number;
  completedSets: number;
  totalExercises: number;
  completedExercises: number;
  startTime: Date;
  endTime: Date;
  notes?: string;
  difficulty?: 'easy' | 'moderate' | 'challenging' | 'very_hard';
}
```

---

## Helper Functions

### Progress Calculation
```typescript
calculateWorkoutProgress(session: WorkoutSession)
// Returns: exerciseProgress, setProgress, totalSetsCompleted, totalSets
```

### Duration Formatting
```typescript
formatDuration(seconds: number)
// Examples: "45:30", "1:23:45"
```

### Navigation Helpers
```typescript
getCurrentExercise(session: WorkoutSession)
getCurrentSet(session: WorkoutSession)
getNextExercise(session: WorkoutSession)
isWorkoutComplete(session: WorkoutSession)
```

---

## State Management

### Active Workout State
- Current exercise index
- Current set index per exercise
- Rest state (isResting, timeRemaining)
- Elapsed time (seconds)
- View mode (current | overview)

### Set Completion Flow
1. User taps "Complete Set"
2. Set marked as completed with timestamp
3. Vibration feedback
4. If more sets in exercise:
   - Move to next set
   - Start rest timer
5. If last set of exercise:
   - Move to next exercise
6. If last set of workout:
   - Navigate to summary screen

---

## UI Components

### Current Exercise View
- **Exercise Title**: Large, centered
- **Muscle Groups**: Colored tags
- **Current Set Card**: Prominent display with reps/weight
- **Complete Button**: Large, tinted button with icon
- **All Sets List**: Small overview with checkmarks

### Overview View
- **Exercise Cards**: One per exercise
- **Progress Indicator**: "X/Y sets completed"
- **Set Grid**: Visual checkboxes for each set
- **Current Indicator**: Highlighted border on active exercise
- **Tap to Navigate**: Quick jump to any exercise

### Rest Timer View
- **Circular Progress Ring**: Visual countdown
- **Large Time Display**: Central countdown number
- **Next Exercise**: Preview text
- **Control Buttons**: Pause/Resume, Skip

### Summary View
- **Celebration Header**: Checkmark icon and congrats message
- **Stats Grid**: 4-card layout with icons
- **Difficulty Selector**: 4 emoji-based options
- **Notes Input**: Multi-line text field
- **Action Buttons**: Discard (outline) and Save (filled)

---

## Styling & Theming

**Colors:**
- Uses theme colors (light/dark mode)
- Tint color for primary actions
- Status colors for completion states

**Animations:**
- Progress bar smooth fill
- Rest timer circular animation
- Haptic feedback on key actions

**Layout:**
- Mobile-optimized spacing
- Touch-friendly button sizes
- Readable font sizes
- Clear visual hierarchy

---

## Future Enhancements

### Potential Additions
- [ ] Edit sets during workout (change reps/weight)
- [ ] Add/remove exercises on the fly
- [ ] Exercise video playback during rest
- [ ] Audio countdown announcements
- [ ] Workout music integration
- [ ] Advanced metrics (volume, tonnage, PRs)
- [ ] Exercise substitution suggestions
- [ ] Form check reminders
- [ ] Superset support
- [ ] Drop set / pyramid set tracking
- [ ] Integration with Supabase for cloud sync
- [ ] Workout history and analytics
- [ ] Personal records tracking
- [ ] Share workout completion to social

### Data Integration
- Save workout logs to Supabase `workout_logs` table
- Link completed sets to `workout_log_exercises`
- Track PRs and progress over time
- Generate workout analytics

---

## Technical Notes

### File Structure
```
app/
  workout/
    [id].tsx           # Active workout screen
    [id]/
      summary.tsx      # Post-workout summary

components/
  rest-timer.tsx       # Rest timer component

lib/
  types/
    workout-session.ts # Data models and helpers
```

### Dependencies
- `expo-router` - Dynamic routing
- `react-native` - Vibration API
- Theme system for colors
- Icon components for visual feedback

### Performance
- Efficient state updates
- Minimal re-renders during timer
- Optimized list rendering for exercises
- Smooth animations at 60fps

---

## Usage Example

```typescript
// Starting a workout from a program
router.push(`/workout/${programId}`);

// The active workout screen automatically:
// 1. Loads workout data
// 2. Starts the timer
// 3. Displays first exercise
// 4. Manages state throughout workout
// 5. Navigates to summary on completion
```

---

## Inspired By

This implementation draws inspiration from the **Transcend Fitness App**, incorporating:
- Dual view system (Current/Overview)
- Rest timer with haptic feedback
- Neumorphic progress indicators
- Comprehensive state management
- User-friendly completion flow
- Workout summary with difficulty rating

---

## Getting Started

To test the workout execution feature:

1. Upload a workout program (CSV) with status "READY"
2. Tap "Start Workout" on any ready program
3. Complete sets by tapping the button
4. Experience the rest timer between sets
5. Switch between Current and Overview modes
6. Complete the workout and view summary
7. Save or discard the workout log

**Note:** Currently uses sample workout data. Future updates will integrate with actual parsed program data from CSV uploads.
