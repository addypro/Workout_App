# Browse Programs Feature

## Overview

The Browse Programs feature allows users to explore, filter, and install workout programs from the Kaggle fitness dataset containing 2,598 pre-made fitness programs.

---

## Features

### 1. Program Browsing ([app/(tabs)/browse.tsx](app/(tabs)/browse.tsx))

**Main Screen:**
- Lists all 2,598 Kaggle fitness programs
- Real-time program count display
- Search functionality by name, description, or muscle groups
- Collapsible filter panel
- Responsive card-based layout

**Program Cards Show:**
- Program name
- Description (truncated to 2 lines)
- Type badge (color-coded)
- Difficulty badge (color-coded)
- Duration (weeks)
- Workout count
- Target muscle groups (up to 3, with overflow count)

### 2. Advanced Filtering

**Filter Categories:**

**Type Filter:**
- All
- STRENGTH (1,069 programs)
- HYPERTROPHY (1,375 programs)
- ENDURANCE
- ATHLETIC (115 programs)
- BODYWEIGHT (31 programs)
- GENERAL_FITNESS (8 programs)
- WEIGHT_LOSS

**Difficulty Filter:**
- All
- BEGINNER (1,481 programs)
- INTERMEDIATE (996 programs)
- ADVANCED (121 programs)

**Duration Filter:**
- All
- SHORT (1-4 weeks): 568 programs
- MEDIUM (5-8 weeks): 783 programs
- LONG (9-12 weeks): 993 programs
- EXTENDED (12+ weeks): 254 programs

**Search:**
- Text-based search across program names, descriptions, and muscle groups
- Clear search button for quick reset

**Filter Controls:**
- Show/Hide filters toggle
- Clear all filters button
- Horizontal scrollable filter chips
- Active filter highlighting

### 3. Program Details Screen ([app/browse/[id].tsx](app/browse/[id].tsx))

**Header Section:**
- Back button navigation
- Program name (full title)
- Type and difficulty badges

**Stats Overview:**
- Duration (weeks)
- Total workouts
- Total exercises

**Program Information:**
- Full description
- Target muscle groups (all listed)
- Required equipment

**Workout Schedule:**
- Expandable weeks (Week 1 expanded by default)
- Workouts grouped by week
- Each workout shows:
  - Day number and name
  - Exercise count
  - First 3 exercises with sets/reps
  - Overflow indicator for additional exercises

### 4. Install to My Programs

**Installation Process:**
1. User taps "Install to My Programs" button
2. Program data is converted to app format:
   - Name and description preserved
   - Source type set to 'KAGGLE'
   - Status set to 'READY'
   - All workout and exercise data included
3. Saved to AsyncStorage via `saveProgram()`
4. Success alert with navigation options:
   - "View My Programs" → Navigate to Programs tab
   - "OK" → Stay on details screen

**Installed Program Features:**
- Appears in "My Programs" tab
- Shows "READY" status
- Has "Start Workout" button
- Fully integrated with workout execution

### 5. Workout Execution Integration

**Starting Workouts:**
- Installed programs work exactly like uploaded programs
- Tapping "Start Workout" loads the first workout
- All exercises, sets, reps, and rest times preserved
- Full workout tracking functionality

**Workout Loading:**
- Updated [app/workout/[id].tsx](app/workout/[id].tsx) to load actual program data
- Converts Kaggle program format to workout session format
- Handles missing data gracefully
- Error handling for invalid programs

---

## Data Structure

### Kaggle Program Format

```typescript
interface KaggleProgram {
  id: string;                    // Base64 encoded from program title
  name: string;                  // Program name
  type: string;                  // STRENGTH, HYPERTROPHY, etc.
  duration: number;              // Weeks
  difficulty: string;            // BEGINNER, INTERMEDIATE, ADVANCED
  muscleGroups: string[];        // Target muscle groups
  equipment: string[];           // Required equipment
  description: string;           // Program description
  workouts: KaggleWorkout[];     // All workouts
  source: 'kaggle';              // Source identifier
}

interface KaggleWorkout {
  week: number;                  // Week number (1-based)
  day: number;                   // Day number (1-based)
  name: string;                  // Workout name
  exercises: KaggleExercise[];   // Exercise list
}

interface KaggleExercise {
  name: string;                  // Exercise name
  sets: number;                  // Number of sets
  reps: string;                  // Reps (e.g., "10" or "180s" for time-based)
  weight: string | null;         // Weight specification
  restTime: number;              // Rest time in seconds
}
```

### Filter State

```typescript
interface ProgramFilters {
  type?: string;                 // 'ALL' or specific type
  difficulty?: string;           // 'ALL' or specific difficulty
  duration?: string;             // 'ALL', 'SHORT', 'MEDIUM', 'LONG', 'EXTENDED'
  search?: string;               // Search query
}
```

---

## Helper Functions

### [lib/kaggle-programs.ts](lib/kaggle-programs.ts)

**Data Loading:**
- `getAllPrograms()` - Returns all 2,598 programs
- `getProgramById(id)` - Get specific program by ID
- `getProgramStats()` - Returns dataset statistics

**Filtering:**
- `filterPrograms(filters)` - Apply filters and return matching programs
- Supports multiple simultaneous filters
- Case-insensitive search
- Duration bucketing logic

**Metadata:**
- `getProgramTypes()` - Returns unique program types
- `getProgramDifficulties()` - Returns unique difficulty levels

---

## Color Coding

### Program Types

```typescript
STRENGTH      → Red (#F44336)
HYPERTROPHY   → Blue (#2196F3)
ENDURANCE     → Green (#4CAF50)
ATHLETIC      → Orange (#FF9800)
BODYWEIGHT    → Purple (#9C27B0)
WEIGHT_LOSS   → Deep Orange (#FF5722)
DEFAULT       → Theme tint color
```

### Difficulty Levels

```typescript
BEGINNER      → Green (#4CAF50)
INTERMEDIATE  → Orange (#FF9800)
ADVANCED      → Red (#F44336)
```

---

## User Flow

### Browsing and Installing

1. **Browse Programs:**
   - User opens "Browse" tab
   - Sees grid of 2,598 programs
   - Can scroll through all programs

2. **Filter Programs:**
   - Tap "Show Filters" to expand filter panel
   - Select type, difficulty, or duration filters
   - Enter search query
   - Program list updates in real-time
   - See filtered count

3. **View Details:**
   - Tap any program card
   - View full program details
   - Explore workout schedule by week
   - Expand/collapse weeks to see exercises

4. **Install Program:**
   - Tap "Install to My Programs" button
   - See success confirmation
   - Choose to view My Programs or continue browsing

5. **Start Workout:**
   - Navigate to "My Programs" tab
   - Find installed program (marked as READY)
   - Tap "Start Workout"
   - Begin live workout execution

---

## Performance Considerations

### Large Dataset Handling

**File Size:**
- JSON file: 121 MB
- 2,598 programs
- 98,818 workouts
- 605,033 exercise records

**Optimization Strategies:**
1. **Memoization:**
   - Program types and difficulties cached with `useMemo()`
   - Filter results cached and only recalculated on filter change

2. **Lazy Loading:**
   - FlatList for efficient rendering
   - Only visible items rendered
   - Smooth scrolling even with 2,598 items

3. **Search Debouncing:**
   - Search executes immediately (no debounce needed due to efficient filtering)
   - Filter updates are synchronous

4. **Conditional Rendering:**
   - Week details only rendered when expanded
   - Exercise lists truncated to 3 items with overflow indicator

---

## Navigation Structure

```
(tabs)
├── browse.tsx              → Browse Programs screen
└── index.tsx               → My Programs screen

browse/
└── [id].tsx               → Program Details screen

workout/
└── [id].tsx               → Active Workout screen (updated)
```

---

## Tab Bar Integration

Updated [app/(tabs)/_layout.tsx](app/(tabs)/_layout.tsx):

```typescript
<Tabs.Screen
  name="browse"
  options={{
    title: 'Browse',
    tabBarIcon: ({ color }) => (
      <IconSymbol size={28} name="square.grid.2x2" color={color} />
    ),
  }}
/>
```

**Tab Order:**
1. My Programs (index)
2. **Browse** (new)
3. Upload
4. Exercises

---

## Example Usage

### Filtering Programs

```typescript
// Get all strength programs for beginners
const filters: ProgramFilters = {
  type: 'STRENGTH',
  difficulty: 'BEGINNER',
  duration: 'ALL',
  search: '',
};

const programs = filterPrograms(filters);
// Returns 300+ beginner strength programs
```

### Installing a Program

```typescript
const program = getProgramById('kaggle-abc123');

const programData = {
  name: program.name,
  description: program.description,
  sourceType: 'KAGGLE',
  status: 'READY',
  parsedData: {
    type: program.type,
    duration: program.duration,
    difficulty: program.difficulty,
    muscleGroups: program.muscleGroups,
    equipment: program.equipment,
    workouts: program.workouts,
  },
};

await saveProgram(programData);
```

---

## Future Enhancements

### Potential Features

- [ ] Sort options (alphabetical, duration, popularity)
- [ ] Favorite programs (save for later without installing)
- [ ] Program previews (sample workout view before install)
- [ ] Rating system for installed programs
- [ ] Program recommendations based on user history
- [ ] Multi-select for batch operations
- [ ] Share programs with friends
- [ ] Export programs to calendar
- [ ] Week-by-week workout selection (not just first workout)
- [ ] Progress tracking across program weeks
- [ ] Program completion badges

### Performance Improvements

- [ ] Implement virtual scrolling for very large lists
- [ ] Add search debouncing if needed
- [ ] Cache filter results in AsyncStorage
- [ ] Lazy load program details on demand
- [ ] Compress JSON data for faster loading

---

## Dataset Statistics

**From Import:**
- Total Programs: 2,598
- Total Workouts: 98,818
- Average Workouts per Program: 38

**By Type:**
- HYPERTROPHY: 1,375 (53%)
- STRENGTH: 1,069 (41%)
- ATHLETIC: 115 (4%)
- BODYWEIGHT: 31 (1%)
- GENERAL_FITNESS: 8 (<1%)

**By Difficulty:**
- BEGINNER: 1,481 (57%)
- INTERMEDIATE: 996 (38%)
- ADVANCED: 121 (5%)

**By Duration:**
- 1-4 weeks: 568 (22%)
- 5-8 weeks: 783 (30%)
- 9-12 weeks: 993 (38%)
- 12+ weeks: 254 (10%)

---

## Technical Notes

### Files Modified/Created

**New Files:**
1. `lib/kaggle-programs.ts` - Data loading and filtering helpers
2. `app/(tabs)/browse.tsx` - Browse Programs screen
3. `app/browse/[id].tsx` - Program Details screen
4. `docs/BROWSE_PROGRAMS.md` - This documentation

**Modified Files:**
1. `app/(tabs)/_layout.tsx` - Added Browse tab
2. `app/workout/[id].tsx` - Updated to load actual program data
3. `app/(tabs)/index.tsx` - Renamed to "My Programs"

### Dependencies

No additional dependencies required - uses existing:
- `expo-router` for navigation
- React hooks for state management
- Theme system for colors
- Icon components for UI

---

## Troubleshooting

### "No programs found"
- Clear all filters
- Check search query spelling
- Ensure workout-programs.json exists in data/

### "Program not found" error
- Verify program ID is correct
- Check if data file is properly loaded
- Try restarting the app

### Installation fails
- Check AsyncStorage permissions
- Verify program data structure
- Check console for error messages

### Workout won't start
- Ensure program status is 'READY'
- Verify program has workout data
- Check if exercises array is populated

---

## Success Metrics

**Feature Completion:**
✅ Browse 2,598 programs
✅ Filter by type, difficulty, duration
✅ Search functionality
✅ View detailed program information
✅ Install to My Programs
✅ Start workouts from installed programs

All 4 next steps from the Kaggle import have been successfully implemented!
