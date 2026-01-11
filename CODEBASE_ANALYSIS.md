# Workout_App Complete Codebase Analysis

> **Document Version:** 1.0  
> **Generated:** December 2024  
> **Purpose:** Comprehensive technical documentation for LLM analysis (NotebookLM, Claude, GPT, etc.)  
> **Format:** Markdown (.md) - optimized for text-based AI systems

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Architecture Patterns](#4-architecture-patterns)
5. [Navigation System](#5-navigation-system)
6. [Component Library](#6-component-library)
7. [State Management](#7-state-management)
8. [Data Layer](#8-data-layer)
9. [Authentication System](#9-authentication-system)
10. [Program Service Layer](#10-program-service-layer)
11. [Exercise Database](#11-exercise-database)
12. [Workout Session Engine](#12-workout-session-engine)
13. [Theming & Design System](#13-theming--design-system)
14. [Animation System](#14-animation-system)
15. [Custom Hooks](#15-custom-hooks)
16. [Data Files](#16-data-files)
17. [Build Configuration](#17-build-configuration)
18. [Key Code Snippets](#18-key-code-snippets)
19. [Data Flow Diagrams](#19-data-flow-diagrams)
20. [Glossary](#20-glossary)

---

## 1. Executive Summary

### What is Workout_App?

Workout_App is a **cross-platform mobile fitness application** built with React Native and Expo. It allows users to:

- Browse and discover 2,598+ workout programs from a curated catalog
- Save programs to their personal library ("My Programs")
- Execute workouts with a live session tracker including rest timers
- Track workout history and progress over time
- Upload custom workout programs via CSV/Excel files
- Browse an exercise database with 700+ exercises
- Use fitness tools (1RM Calculator, Plate Calculator)

### Target Platforms

| Platform | Support Level |
|----------|---------------|
| iOS | Full (primary) |
| Android | Full |
| Web | Partial (via react-native-web) |

### Key Architectural Decisions

1. **Offline-First**: All core functionality works without internet
2. **File-Based Routing**: expo-router for intuitive navigation
3. **Type-Safe**: TypeScript throughout the codebase
4. **Service Layer Pattern**: Clean separation between UI and business logic
5. **Local-First Storage**: AsyncStorage for persistence, Supabase for optional cloud sync

---

## 2. Technology Stack

### Core Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| React Native | 0.81.5 | Cross-platform mobile UI framework |
| Expo SDK | 54.0.29 | Development platform and native API access |
| React | 19.1.0 | Component library and UI primitives |
| TypeScript | 5.9.2 | Static type checking |

### Navigation

| Technology | Version | Purpose |
|------------|---------|---------|
| expo-router | 6.0.19 | File-based routing system |
| @react-navigation/native | 7.1.8 | Navigation primitives |
| @react-navigation/bottom-tabs | 7.4.0 | Tab navigator |

### UI & Animations

| Technology | Version | Purpose |
|------------|---------|---------|
| react-native-reanimated | 4.1.1 | 60fps native animations |
| react-native-gesture-handler | 2.28.0 | Touch gestures |
| react-native-safe-area-context | 5.6.0 | Safe area handling |
| @expo/vector-icons | 15.0.3 | Icon library |
| expo-haptics | 15.0.8 | Haptic feedback |

### Data & Storage

| Technology | Version | Purpose |
|------------|---------|---------|
| @react-native-async-storage/async-storage | 2.2.0 | Local key-value storage |
| @supabase/supabase-js | 2.89.0 | Backend-as-a-service |
| expo-secure-store | 15.0.8 | Encrypted storage for auth tokens |
| expo-file-system | 19.0.21 | File operations |

### Authentication

| Technology | Version | Purpose |
|------------|---------|---------|
| expo-apple-authentication | 8.0.8 | Sign in with Apple |
| expo-web-browser | 15.0.10 | OAuth flows |

### Utilities

| Technology | Version | Purpose |
|------------|---------|---------|
| nanoid | 5.1.6 | Unique ID generation |
| xlsx | 0.18.5 | Excel file parsing |
| expo-document-picker | 14.0.8 | File selection |
| expo-speech | 14.0.8 | Text-to-speech for workout cues |

---

## 3. Project Structure

```
Workout_App/
├── app/                          # SCREENS (expo-router pages)
│   ├── _layout.tsx               # Root layout (providers, Stack navigator)
│   ├── (tabs)/                   # Tab navigator group
│   │   ├── _layout.tsx           # Tab bar configuration
│   │   ├── index.tsx             # My Programs (home tab)
│   │   ├── browse.tsx            # Discover programs
│   │   ├── explore.tsx           # Exercise database
│   │   ├── tools.tsx             # Fitness calculators
│   │   └── upload.tsx            # CSV/Excel upload
│   ├── browse/
│   │   └── [id].tsx              # Program detail screen
│   ├── workout/
│   │   ├── [id].tsx              # Active workout session
│   │   ├── [id]/summary.tsx      # Workout completion
│   │   └── quick.tsx             # Quick workout (no program)
│   ├── history/
│   │   ├── index.tsx             # Workout history list
│   │   └── [id].tsx              # History detail
│   ├── program/
│   │   └── [id]/editor.tsx       # Program editor
│   ├── exercise-picker.tsx       # Exercise selection modal
│   └── modal.tsx                 # Generic modal
│
├── components/                   # REUSABLE UI COMPONENTS
│   ├── ui/                       # Primitive UI elements
│   │   ├── icon-symbol.tsx       # Cross-platform icons
│   │   ├── icon-symbol.ios.tsx   # iOS-specific icons (SF Symbols)
│   │   ├── card.tsx              # Card container
│   │   ├── card-header.tsx       # Card header
│   │   ├── section-title.tsx     # Section headers
│   │   └── text-field.tsx        # Text input
│   ├── program/                  # Program-related components
│   │   ├── program-card.tsx      # Program display card
│   │   └── my-program-card.tsx   # Enhanced card for saved programs
│   ├── exercise/                 # Exercise components
│   │   └── exercise-card.tsx     # Exercise display
│   ├── history/                  # History components
│   │   └── workout-history-card.tsx
│   ├── themed-text.tsx           # Theme-aware Text
│   ├── themed-view.tsx           # Theme-aware View
│   ├── screen.tsx                # Screen wrapper with safe area
│   ├── swipe-tabs.tsx            # Edge swipe navigation
│   ├── haptic-tab.tsx            # Tab button with haptics
│   ├── rest-timer.tsx            # Workout rest timer
│   ├── workout-picker-modal.tsx  # Week/day selector
│   ├── one-rm-calculator.tsx     # 1RM calculator tool
│   ├── plate-calculator.tsx      # Barbell plate calculator
│   ├── expandable-fab.tsx        # Floating action button
│   └── profile-button.tsx        # User profile/auth button
│
├── lib/                          # BUSINESS LOGIC & SERVICES
│   ├── context/                  # React Context providers
│   │   ├── auth-context.tsx      # Authentication state
│   │   └── exercise-picker.tsx   # Exercise picker state
│   ├── db/                       # Data persistence
│   │   └── storage.ts            # AsyncStorage operations
│   ├── domain/                   # Domain models
│   │   └── program.ts            # Program type definitions
│   ├── data/                     # Data repositories
│   │   ├── program-catalog.repo.ts   # Program catalog access
│   │   └── program-install.repo.ts   # Installed programs tracking
│   ├── services/                 # Service layer
│   │   ├── programs/             # Program service
│   │   │   ├── index.ts          # Public API
│   │   │   ├── types.ts          # Type definitions
│   │   │   ├── kaggle-loader.ts  # JSON data loader
│   │   │   ├── programs-service.ts # Business logic
│   │   │   └── data/             # Built-in programs
│   │   │       ├── strength-programs.ts
│   │   │       ├── hypertrophy-programs.ts
│   │   │       └── ...
│   │   ├── exercise/             # Exercise service
│   │   │   ├── database.ts       # Exercise database
│   │   │   └── categories.ts     # Category definitions
│   │   ├── parser/               # File parsing
│   │   │   └── csv.ts            # CSV parser
│   │   └── storage/              # Storage service (empty)
│   ├── hooks/                    # Custom React hooks
│   │   ├── index.ts              # Hook exports
│   │   ├── use-selection.ts      # Multi-select state
│   │   ├── use-async-data.ts     # Async data loading
│   │   └── use-paginated-data.ts # Pagination
│   ├── types/                    # TypeScript types
│   │   ├── program.ts            # Program types
│   │   └── workout-session.ts    # Workout session types
│   ├── styles/                   # Shared styles
│   │   ├── index.ts
│   │   └── shared.ts
│   ├── supabase/                 # Supabase client
│   │   └── client.ts             # Client configuration
│   └── utils/                    # Utility functions
│       └── csv-export.ts         # CSV export
│
├── constants/                    # CONSTANTS & TOKENS
│   └── theme.ts                  # Design system tokens
│
├── hooks/                        # PLATFORM HOOKS
│   ├── use-color-scheme.ts       # Native color scheme
│   ├── use-color-scheme.web.ts   # Web color scheme
│   └── use-theme-color.ts        # Theme color accessor
│
├── data/                         # STATIC DATA FILES
│   ├── programs-light.json       # 2,598 programs (metadata only, ~2MB)
│   ├── workout-programs.json     # Full program details (~121MB)
│   ├── exercises.json            # 160 basic exercises
│   ├── exercises-v2.9.json       # 700+ enhanced exercises
│   ├── exercises-full.json       # Complete exercise data
│   ├── DATABASE_SUMMARY.md       # Data documentation
│   └── README.md                 # Data format docs
│
├── assets/                       # STATIC ASSETS
│   └── images/                   # App icons and images
│
├── supabase/                     # SUPABASE CONFIGURATION
│   └── migrations/               # Database migrations
│       └── *.sql
│
├── scripts/                      # UTILITY SCRIPTS
│   ├── reset-project.js          # Project reset
│   └── import-exercises-v2.9.mjs # Exercise import
│
├── app.json                      # Expo configuration
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── babel.config.js               # Babel config
├── metro.config.js               # Metro bundler config
└── eslint.config.js              # ESLint config
```

---

## 4. Architecture Patterns

### Layered Architecture

The codebase follows a clean layered architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                       │
│  app/*.tsx screens, components/*.tsx UI components          │
│  - React components                                         │
│  - Handles user interactions                                │
│  - Renders UI based on state                                │
├─────────────────────────────────────────────────────────────┤
│                      SERVICE LAYER                          │
│  lib/services/*                                             │
│  - Business logic                                           │
│  - Data transformation                                      │
│  - Search/filter/pagination                                 │
├─────────────────────────────────────────────────────────────┤
│                    REPOSITORY LAYER                         │
│  lib/data/*.repo.ts                                         │
│  - Data access abstraction                                  │
│  - Caching                                                  │
│  - Future: remote data sources                              │
├─────────────────────────────────────────────────────────────┤
│                     STORAGE LAYER                           │
│  lib/db/storage.ts, AsyncStorage, Supabase                  │
│  - Persistence                                              │
│  - CRUD operations                                          │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Patterns Used

| Pattern | Usage |
|---------|-------|
| **Repository Pattern** | `program-catalog.repo.ts`, `program-install.repo.ts` |
| **Service Layer** | `programs-service.ts` orchestrates data |
| **Provider Pattern** | `AuthProvider` for global auth state |
| **Container/Presenter** | Screens fetch data, components render |
| **Compound Components** | `ProgramCard` with `Badge` subcomponent |
| **Custom Hooks** | `useSelection`, `useAsyncData` for reusable logic |

---

## 5. Navigation System

### expo-router File-Based Routing

The `app/` folder structure directly maps to navigation routes:

| File Path | Route | Screen |
|-----------|-------|--------|
| `app/(tabs)/index.tsx` | `/` | My Programs |
| `app/(tabs)/browse.tsx` | `/browse` | Discover |
| `app/(tabs)/explore.tsx` | `/explore` | Exercises |
| `app/(tabs)/tools.tsx` | `/tools` | Tools |
| `app/browse/[id].tsx` | `/browse/:id` | Program Detail |
| `app/workout/[id].tsx` | `/workout/:id` | Active Workout |
| `app/workout/[id]/summary.tsx` | `/workout/:id/summary` | Workout Complete |
| `app/history/index.tsx` | `/history` | History List |
| `app/history/[id].tsx` | `/history/:id` | History Detail |

### Navigation Hierarchy

```
RootLayout (Stack)
├── (tabs) (Bottom Tabs)
│   ├── index (My Programs)
│   ├── browse (Discover)
│   ├── explore (Exercises)
│   ├── tools (Tools)
│   └── upload (Hidden)
├── browse/[id] (Stack screen)
├── workout/[id] (Stack screen)
├── workout/[id]/summary (Stack screen)
├── history/index (Stack screen)
├── history/[id] (Stack screen)
├── exercise-picker (Modal)
└── modal (Modal)
```

### Root Layout Configuration

```typescript
// app/_layout.tsx
export const unstable_settings = {
  anchor: '(tabs)',
  initialRouteName: '(tabs)',  // Always start at tabs on cold boot
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView>
      <AuthProvider>
        <ThemeProvider>
          <Stack screenOptions={{
            animation: 'slide_from_right',
            gestureEnabled: true,
          }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          </Stack>
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
```

### Tab Layout Configuration

```typescript
// app/(tabs)/_layout.tsx
export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: colors.tint,
      headerShown: true,
      tabBarButton: HapticTab,  // Adds haptic feedback
    }}>
      <Tabs.Screen name="index" options={{
        title: 'My Programs',
        tabBarIcon: ({ color }) => <IconSymbol name="figure.strengthtraining.traditional" color={color} />,
      }} />
      <Tabs.Screen name="browse" options={{
        title: 'Discover',
        tabBarIcon: ({ color }) => <IconSymbol name="sparkles" color={color} />,
      }} />
      {/* ... more tabs ... */}
    </Tabs>
  );
}
```

### Swipe Navigation Between Tabs

The `SwipeTabs` component enables iOS-style edge swipe to navigate between tabs:

```typescript
// components/swipe-tabs.tsx
const TAB_ORDER = ['index', 'browse', 'explore', 'tools'];

export function SwipeTabs({ current, children }) {
  const gesture = Gesture.Pan()
    .onEnd((e) => {
      // Swipe right from left edge → previous tab
      if (fromLeftEdge && e.translationX > 70) {
        router.replace(`/(tabs)/${previousTab}`);
      }
      // Swipe left from right edge → next tab
      if (fromRightEdge && e.translationX < -70) {
        router.replace(`/(tabs)/${nextTab}`);
      }
    });

  return (
    <GestureDetector gesture={gesture}>
      {children}
    </GestureDetector>
  );
}
```

---

## 6. Component Library

### Themed Base Components

#### ThemedText

Auto-adapts text color to light/dark mode with typography variants:

```typescript
// components/themed-text.tsx
type ThemedTextProps = {
  type?: 'default' | 'title' | 'subtitle' | 'headline' | 'body' | 
         'callout' | 'footnote' | 'caption' | 'largeTitle' | 'link';
};

// Usage:
<ThemedText type="title">My Programs</ThemedText>
<ThemedText type="footnote">3 workouts completed</ThemedText>
```

#### ThemedView

Theme-aware View container:

```typescript
// components/themed-view.tsx
<ThemedView style={styles.container}>
  {/* Children automatically get themed background */}
</ThemedView>
```

### Screen Wrapper

Handles safe areas and background color:

```typescript
// components/screen.tsx
<Screen variant="grouped" edges={['top', 'left', 'right']}>
  {/* Content with safe area insets */}
</Screen>
```

### Icon System

Cross-platform icon component that maps SF Symbols to Material Icons:

```typescript
// components/ui/icon-symbol.tsx
const MAPPING = {
  'house.fill': 'home',
  'dumbbell': 'fitness-center',
  'magnifyingglass': 'search',
  'checkmark': 'check',
  // ... 30+ mappings
};

// Usage (same API on all platforms):
<IconSymbol name="dumbbell" size={24} color={colors.tint} />
```

On iOS, `icon-symbol.ios.tsx` renders native SF Symbols instead.

### Program Card

Displays a workout program with selection support:

```typescript
// components/program/program-card.tsx
interface ProgramCardProps {
  program: ProgramDisplayItem;
  isSelected?: boolean;
  onToggleSelect?: (program) => void;
  onPress?: (program) => void;
  variant?: 'default' | 'compact';
}

// Features:
// - Type badge (color-coded)
// - Difficulty badge
// - Duration and frequency
// - Checkbox for multi-select
// - Press animation with haptics
```

### Rest Timer

Full-screen rest timer between sets:

```typescript
// components/rest-timer.tsx
interface RestTimerProps {
  duration: number;      // seconds
  onComplete: () => void;
  onSkip: () => void;
  nextExercise?: string;
}

// Features:
// - Countdown with progress bar
// - Haptic feedback at 3, 2, 1
// - Pause/resume
// - Skip button
// - "Next up" preview
```

---

## 7. State Management

### State Management Strategy

The app uses a **minimal state management approach**:

| State Type | Solution |
|------------|----------|
| **Local UI State** | `useState` |
| **Cross-Screen State** | URL parameters + AsyncStorage |
| **Global Auth State** | React Context (`AuthProvider`) |
| **Server Cache** | Local cache in service classes |
| **Persisted Data** | AsyncStorage |

### No Redux/Zustand/MobX

The app deliberately avoids external state management libraries because:

1. expo-router handles navigation state
2. AsyncStorage provides persistence
3. React Context suffices for auth
4. Services maintain their own caches

### Auth Context

```typescript
// lib/context/auth-context.tsx
interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isGuest: boolean;
}

interface AuthContextType extends AuthState {
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
}

// Usage in components:
const { user, isGuest, signOut } = useAuth();
```

### useSelection Hook

Reusable multi-selection state with haptic feedback:

```typescript
// lib/hooks/use-selection.ts
const selection = useSelection<ProgramDisplayItem>();

selection.toggle(item);          // Toggle selection
selection.isSelected(item);      // Check if selected
selection.selectedCount;         // Number selected
selection.clear();               // Clear all
selection.getSelected(items);    // Get selected items
```

---

## 8. Data Layer

### AsyncStorage Keys

All storage keys are prefixed with `@` and use consistent naming:

```typescript
// lib/db/storage.ts
const PROGRAMS_KEY = '@workout_programs';
const PROGRAM_TEMPLATES_KEY_PREFIX = '@workout_program_templates:';
const WORKOUT_PENDING_EDITS_KEY_PREFIX = '@workout_pending_edits:';
const ACTIVE_WORKOUT_KEY_PREFIX = '@active_workout:';
const WORKOUT_HISTORY_KEY_PREFIX = '@workout_history:';
const UNIFIED_HISTORY_KEY = '@unified_workout_history';
```

### Core Data Types

#### Program

A saved workout program in "My Programs":

```typescript
interface Program {
  id: string;                    // "prog-1703180400000"
  userId: string;                // "local" or Supabase user ID
  name: string;
  description: string | null;
  sourceFileUri: string | null;  // Original file path
  sourceType: 'CSV' | 'PDF' | 'EXCEL' | 'IMAGE' | 'KAGGLE' | 'BUILTIN';
  status: 'PARSING' | 'MAPPING' | 'READY' | 'ERROR';
  parsedData: {
    type: string;
    duration: number;
    difficulty: string;
    muscleGroups: string[];
    equipment: string[];
    workouts: Workout[];
  };
  createdAt: string;             // ISO 8601
  updatedAt: string;
}
```

#### ProgramTemplate

User customizations to a program:

```typescript
interface ProgramTemplate {
  id: string;
  userId: string;
  baseProgramId: string;         // Links to original program
  name: string;
  description: string | null;
  parsedData: any;               // Modified workout data
  createdAt: string;
  updatedAt: string;
}
```

#### StoredWorkoutSession

An in-progress workout:

```typescript
type StoredWorkoutSession = {
  id: string;
  programId?: string;
  workoutName: string;
  exercises: {
    id: string;
    name: string;
    sets: {
      id: string;
      reps: number | string;
      weight?: number;
      isCompleted: boolean;
      completedAt?: string;
      actualReps?: number;
      actualWeight?: number;
      rpe?: number;
    }[];
    restTime: number;
    currentSetIndex: number;
  }[];
  startTime: string;
  endTime?: string;
  currentExerciseIndex: number;
  isResting: boolean;
  restTimeRemaining: number;
  status: 'in_progress' | 'paused' | 'completed' | 'cancelled';
};
```

#### ActiveWorkoutState

Enables workout resume after app close:

```typescript
type ActiveWorkoutState = {
  session: StoredWorkoutSession;
  elapsedSeconds: number;
  lastUpdatedAt: number;         // Epoch ms for time catch-up
};
```

#### UnifiedWorkoutRecord

Completed workout history entry:

```typescript
type UnifiedWorkoutRecord = {
  id: string;
  type: 'program' | 'quick';
  programId?: string;
  programName?: string;
  workoutName: string;
  week?: number;
  day?: number;
  completedAt: string;
  durationSeconds: number;
  exercises: {
    name: string;
    setsCompleted: number;
    totalSets: number;
    bestSet?: { reps: number; weight?: number };
  }[];
  userId: string;
};
```

### Storage Functions

```typescript
// Program CRUD
getPrograms(): Promise<Program[]>
getProgram(id: string): Promise<Program | null>
saveProgram(program: Omit<Program, 'id' | 'createdAt' | 'updatedAt'>): Promise<Program>
updateProgram(id: string, updates: Partial<Program>): Promise<Program | null>
deleteProgram(id: string): Promise<boolean>

// Templates
getProgramTemplates(userId: string): Promise<ProgramTemplate[]>
getTemplateForProgram(userId: string, baseProgramId: string): Promise<ProgramTemplate | null>
upsertProgramTemplate(template: ...): Promise<ProgramTemplate>
getEffectiveProgramData(program: Program): Promise<any>

// Active Workout (resume support)
setActiveWorkoutState(userId: string, programId: string, state: ActiveWorkoutState): Promise<void>
getActiveWorkoutState(userId: string, programId: string): Promise<ActiveWorkoutState | null>
clearActiveWorkoutState(userId: string, programId: string): Promise<void>

// Workout History
getWorkoutHistory(programId: string): Promise<WorkoutHistory>
markWorkoutCompleted(programId: string, week: number, day: number, duration?: number): Promise<void>
getCompletedWorkouts(programId: string): Promise<Set<string>>

// Unified History
getUnifiedHistory(userId: string): Promise<UnifiedWorkoutRecord[]>
saveWorkoutToHistory(record: Omit<UnifiedWorkoutRecord, 'id'>): Promise<UnifiedWorkoutRecord>
getWorkoutStats(userId: string): Promise<{ totalWorkouts, thisWeek, currentStreak, ... }>
```

---

## 9. Authentication System

### Auth Flow

```
┌─────────────┐     ┌───────────────┐     ┌─────────────┐
│ App Launch  │ ──→ │ Check Session │ ──→ │ Has Session │
└─────────────┘     └───────────────┘     └──────┬──────┘
                                                 │
                    ┌────────────────────────────┴────────────────────────────┐
                    ↓                                                         ↓
            ┌───────────────┐                                         ┌───────────────┐
            │ Guest Mode    │                                         │ Authenticated │
            │ (userId='local') │                                      │ (userId=uuid) │
            └───────────────┘                                         └───────────────┘
```

### Supported Auth Methods

1. **Sign in with Apple** (iOS only)
   - Uses `expo-apple-authentication`
   - Returns identity token
   - Passed to Supabase `signInWithIdToken`

2. **Email Magic Link**
   - User enters email
   - Supabase sends magic link
   - Deep link redirects back to app

3. **Guest Mode**
   - No authentication required
   - All data stored locally with `userId='local'`
   - Can upgrade to authenticated later

### Data Migration on Sign-In

When a guest signs in, their local data is migrated:

```typescript
const migrateLocalData = async (newUserId: string) => {
  // Get all keys with 'local' userId
  const keys = await AsyncStorage.getAllKeys();
  const localKeys = keys.filter(key => key.includes(':local:'));
  
  // Copy to new user namespace
  for (const key of localKeys) {
    const data = await AsyncStorage.getItem(key);
    const newKey = key.replace(':local:', `:${newUserId}:`);
    await AsyncStorage.setItem(newKey, data);
  }
  
  // Update workout history records
  const historyData = await AsyncStorage.getItem('@unified_workout_history');
  const records = JSON.parse(historyData);
  const updated = records.map(r => ({
    ...r,
    userId: r.userId === 'local' ? newUserId : r.userId,
  }));
  await AsyncStorage.setItem('@unified_workout_history', JSON.stringify(updated));
};
```

### Supabase Client Configuration

```typescript
// lib/supabase/client.ts
const ExpoSecureStoreAdapter = {
  getItem: (key) => SecureStore.getItemAsync(key),    // iOS Keychain
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,  // Secure token storage
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,        // Handle deep links manually
  },
});
```

---

## 10. Program Service Layer

### ProgramsService Class

Central service for program catalog operations:

```typescript
// lib/services/programs/programs-service.ts
class ProgramsService {
  private catalogRepo = new LocalBundledCatalogRepo();
  private installRepo = new AsyncStorageProgramInstallRepo();
  private index: IndexedProgram[] | null = null;

  // Build search index on first access
  private ensureIndex() {
    if (this.index) return;
    const all = this.catalogRepo.getAll();
    this.index = all.map((p) => ({
      program: p,
      haystack: [p.name, p.description, p.type, ...p.tags].join(' ').toLowerCase(),
    }));
  }

  // List catalog with search, filters, and pagination
  async listCatalog(query: CatalogQuery): Promise<{ total: number; items: CatalogListItem[] }> {
    this.ensureIndex();
    
    // Filter by search query
    let filtered = this.index.filter(({ haystack }) => 
      query.q ? haystack.includes(query.q.toLowerCase()) : true
    );
    
    // Filter by type and difficulty
    if (query.filters?.type) {
      filtered = filtered.filter(({ program }) => program.type === query.filters.type);
    }
    
    // Paginate
    const page = filtered.slice(query.offset, query.offset + query.limit);
    
    // Mark installed programs
    const installedKeys = await this.installRepo.getInstalledKeys();
    const items = page.map(p => ({
      ...toProgramDisplayItem(p),
      installed: installedKeys.has(p.id),
    }));
    
    return { total: filtered.length, items };
  }

  // Save programs to My Programs
  async installProgramsByCatalogIds(ids: string[]): Promise<number> {
    for (const id of ids) {
      const program = this.getById(id);
      await saveProgram(toStorageFormat(program));
    }
    return ids.length;
  }
}

export const programsService = new ProgramsService();
```

### Data Repositories

#### LocalBundledCatalogRepo

Loads programs from bundled JSON:

```typescript
// lib/data/program-catalog.repo.ts
class LocalBundledCatalogRepo {
  private cache: WorkoutProgram[] | null = null;

  getAll(): WorkoutProgram[] {
    if (this.cache) return this.cache;
    
    const rawPrograms = require('@/data/programs-light.json').programs;
    this.cache = rawPrograms.map(transformLightProgram);
    return this.cache;
  }

  getById(id: string): WorkoutProgram | undefined {
    return this.getAll().find(p => p.id === id);
  }
}
```

#### AsyncStorageProgramInstallRepo

Tracks which catalog programs are installed:

```typescript
// lib/data/program-install.repo.ts
class AsyncStorageProgramInstallRepo {
  async getInstalledKeys(): Promise<Set<InstalledProgramKey>> {
    const programs = await getPrograms();
    return new Set(
      programs
        .filter(p => p.sourceType === 'BUILTIN')
        .map(p => p.parsedData?.sourceProgramId)
    );
  }
}
```

### Program Type Definitions

```typescript
// lib/services/programs/types.ts
const ProgramType = {
  STRENGTH: 'STRENGTH',
  HYPERTROPHY: 'HYPERTROPHY',
  ENDURANCE: 'ENDURANCE',
  ATHLETIC: 'ATHLETIC',
  BODYWEIGHT: 'BODYWEIGHT',
  FULL_BODY: 'FULL_BODY',
  POWERLIFTING: 'POWERLIFTING',
  WEIGHT_LOSS: 'WEIGHT_LOSS',
  MOBILITY: 'MOBILITY',
  SPORT_SPECIFIC: 'SPORT_SPECIFIC',
};

const DifficultyLevel = {
  BEGINNER: 'BEGINNER',
  INTERMEDIATE: 'INTERMEDIATE',
  ADVANCED: 'ADVANCED',
  ELITE: 'ELITE',
};

interface WorkoutProgram {
  id: string;
  name: string;
  description: string;
  type: ProgramType;
  difficulty: DifficultyLevel;
  category: ProgramCategory;
  duration: number;           // weeks
  daysPerWeek: number;
  muscleGroups: string[];
  equipment: string[];
  workouts: Workout[];
  tags?: string[];
}

interface Workout {
  week: number;
  day: number;
  name: string;
  exercises: Exercise[];
}

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  weight?: string;
  restTime?: number;
}
```

---

## 11. Exercise Database

### Exercise Database Service

```typescript
// lib/services/exercise/database.ts
interface ExerciseDatabaseEntry {
  id: string;
  name: string;
  aliases: string[];
  category?: string;
  equipment: string[];
  videoUrl?: string;
  difficulty?: string;
  muscles?: {
    targetGroup?: string;
    primeMover?: string;
    secondary?: string;
    tertiary?: string;
  };
  movementPatterns?: string[];
  planesOfMotion?: string[];
  // Computed fields
  bodyRegion?: string;
  equipmentCategory?: string;
  movementCategory?: string;
  difficultyLevel?: number;
}

// Load from bundled JSON
async function getExerciseDatabase(): Promise<ExerciseDatabaseEntry[]> {
  if (cache) return cache;
  
  const result = exercisesData.map((ex, index) => ({
    id: `ex-${index + 1}`,
    name: ex.name,
    aliases: ex.aliases || [],
    // ... computed fields
  }));
  
  cache = result;
  return result;
}
```

### Exercise Categories

```typescript
// lib/services/exercise/categories.ts
const BODY_REGIONS = {
  upper_push: { name: 'Upper Push', muscleGroups: ['Chest', 'Shoulders', 'Triceps'] },
  upper_pull: { name: 'Upper Pull', muscleGroups: ['Back', 'Biceps', 'Rear Delts'] },
  lower_push: { name: 'Lower Push', muscleGroups: ['Quads', 'Glutes'] },
  lower_pull: { name: 'Lower Pull', muscleGroups: ['Hamstrings', 'Glutes'] },
  core: { name: 'Core', muscleGroups: ['Abs', 'Obliques', 'Lower Back'] },
};

const EQUIPMENT_CATEGORIES = {
  barbell: { name: 'Barbell', items: ['Barbell', 'Olympic Bar'] },
  dumbbell: { name: 'Dumbbell', items: ['Dumbbell', 'Dumbbells'] },
  cable: { name: 'Cable', items: ['Cable', 'Cable Machine'] },
  bodyweight: { name: 'Bodyweight', items: ['Bodyweight', 'None'] },
  machine: { name: 'Machine', items: ['Machine', 'Smith Machine'] },
};

const DIFFICULTY_LEVELS = [
  { id: 'beginner', level: 1, name: 'Beginner' },
  { id: 'intermediate', level: 2, name: 'Intermediate' },
  { id: 'advanced', level: 3, name: 'Advanced' },
  { id: 'expert', level: 4, name: 'Expert' },
];
```

### Exercise Filtering

```typescript
interface ExerciseFilters {
  search?: string;
  bodyRegion?: string;
  equipmentCategory?: string;
  movementCategory?: string;
  muscleGroup?: string;
  difficulty?: string;
}

async function filterExercises(filters: ExerciseFilters): Promise<ExerciseDatabaseEntry[]> {
  const database = await getExerciseDatabase();
  let results = [...database];
  
  // Body region filter
  if (filters.bodyRegion) {
    const region = BODY_REGIONS[filters.bodyRegion];
    results = results.filter(ex => 
      region.muscleGroups.some(m => ex.muscles?.targetGroup?.includes(m))
    );
  }
  
  // Equipment filter
  if (filters.equipmentCategory) {
    const category = EQUIPMENT_CATEGORIES[filters.equipmentCategory];
    results = results.filter(ex => 
      ex.equipment.some(e => category.items.includes(e))
    );
  }
  
  // Search filter
  if (filters.search) {
    const query = filters.search.toLowerCase();
    results = results.filter(ex => 
      ex.name.toLowerCase().includes(query) ||
      ex.aliases.some(a => a.toLowerCase().includes(query))
    );
  }
  
  return results;
}
```

---

## 12. Workout Session Engine

### Workout Session State Machine

```
                          ┌──────────────┐
                          │    IDLE      │
                          └──────┬───────┘
                                 │ Start Workout
                                 ↓
                          ┌──────────────┐
              ┌──────────→│ IN_PROGRESS  │←──────────┐
              │           └──────┬───────┘           │
              │                  │                   │
        Resume│     ┌────────────┼────────────┐     │Resume
              │     ↓            ↓            ↓     │
        ┌─────┴─────┐     ┌──────────┐     ┌───────┴───┐
        │  PAUSED   │     │ RESTING  │     │ COMPLETED │
        └───────────┘     └──────────┘     └───────────┘
              │                                  │
              │                                  │ Save to History
              ↓                                  ↓
        ┌───────────┐                    ┌───────────────┐
        │ CANCELLED │                    │ HISTORY SAVED │
        └───────────┘                    └───────────────┘
```

### WorkoutSession Interface

```typescript
// lib/types/workout-session.ts
interface WorkoutSession {
  id: string;
  programId?: string;
  workoutName: string;
  exercises: WorkoutExercise[];
  startTime: Date;
  endTime?: Date;
  currentExerciseIndex: number;
  isResting: boolean;
  restTimeRemaining: number;
  restExerciseIndex?: number;
  restAfterSetIndex?: number;
  status: 'in_progress' | 'paused' | 'completed' | 'cancelled';
}

interface WorkoutExercise {
  id: string;
  name: string;
  sets: WorkoutSet[];
  restTime: number;
  notes?: string;
  currentSetIndex: number;
}

interface WorkoutSet {
  id: string;
  reps: number | string;
  weight?: number;
  isCompleted: boolean;
  completedAt?: Date;
  actualReps?: number;
  actualWeight?: number;
  rpe?: number;
}
```

### Helper Functions

```typescript
function calculateWorkoutProgress(session: WorkoutSession): {
  exerciseProgress: number;    // 0-1
  setProgress: number;         // 0-1
  totalSetsCompleted: number;
  totalSets: number;
} {
  const totalSets = session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const completedSets = session.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter(s => s.isCompleted).length, 0
  );
  return {
    exerciseProgress: completedExercises / totalExercises,
    setProgress: completedSets / totalSets,
    totalSetsCompleted: completedSets,
    totalSets,
  };
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
```

### Workout Resume Logic

```typescript
// In app/workout/[id].tsx
const loadWorkout = async () => {
  // Check for existing session (allows resume)
  const existing = await getActiveWorkoutState(program.userId, program.id);
  
  if (existing?.session) {
    // Calculate time passed while app was closed
    const catchUp = existing.session.status === 'in_progress'
      ? Math.floor((Date.now() - existing.lastUpdatedAt) / 1000)
      : 0;
    
    setElapsedSeconds(existing.elapsedSeconds + catchUp);
    
    // Clear rest state to avoid resuming into rest timer
    const restoredSession = {
      ...existing.session,
      isResting: false,
      restTimeRemaining: 0,
    };
    
    setSession(restoredSession);
    return;
  }
  
  // Start new session...
};
```

---

## 13. Theming & Design System

### Design Tokens

```typescript
// constants/theme.ts

// Colors (iOS system colors)
export const Colors = {
  light: {
    text: '#000000',
    textSecondary: '#3C3C43',
    textTertiary: '#3C3C4399',
    background: '#FFFFFF',
    groupedBackground: '#F2F2F7',
    card: '#FFFFFF',
    elevated: '#FFFFFF',
    tint: '#007AFF',              // iOS systemBlue
    tintMuted: '#007AFF18',
    separator: '#3C3C4333',
    separatorOpaque: '#C6C6C8',
    tabIconDefault: '#8E8E93',
    tabIconSelected: '#007AFF',
    glassBackground: 'rgba(255,255,255,0.72)',
    glassBorder: 'rgba(255,255,255,0.18)',
  },
  dark: {
    text: '#FFFFFF',
    textSecondary: '#EBEBF599',
    textTertiary: '#EBEBF54D',
    background: '#000000',
    groupedBackground: '#000000',
    card: '#1C1C1E',
    elevated: '#2C2C2E',
    tint: '#0A84FF',
    tintMuted: '#0A84FF20',
    separator: '#54545899',
    separatorOpaque: '#38383A',
    tabIconDefault: '#8E8E93',
    tabIconSelected: '#0A84FF',
    glassBackground: 'rgba(28,28,30,0.72)',
    glassBorder: 'rgba(255,255,255,0.08)',
  },
};

// Spacing scale
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Border radius
export const Radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  full: 9999,
};

// Shadow presets
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
};

// Typography scale (iOS HIG)
export const Typography = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption1: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  caption2: { fontSize: 11, lineHeight: 13, fontWeight: '400' },
};

// Animation timing
export const Animation = {
  fast: 150,
  normal: 250,
  slow: 400,
  spring: { damping: 15, stiffness: 150 },
};
```

### Using Theme Colors

```typescript
// In a component
const colorScheme = useColorScheme();
const colors = Colors[colorScheme ?? 'light'];

<View style={{ backgroundColor: colors.card }}>
  <Text style={{ color: colors.text }}>Hello</Text>
</View>
```

---

## 14. Animation System

### react-native-reanimated Setup

```javascript
// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],  // REQUIRED - must be last
  };
};
```

### Animation Patterns

#### Shared Values (UI Thread)

```typescript
import { useSharedValue, withTiming, useAnimatedStyle } from 'react-native-reanimated';

const progress = useSharedValue(0);

// Animate to new value
progress.value = withTiming(1, { duration: 250 });

// Create animated style
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: progress.value }],
  opacity: progress.value,
}));

<Animated.View style={animatedStyle} />
```

#### Spring Animations

```typescript
import { withSpring } from 'react-native-reanimated';

progress.value = withSpring(1, {
  damping: 15,
  stiffness: 150,
});
```

#### Progress Bar Example

```typescript
// Workout progress bar
const progressSv = useSharedValue(0);

useEffect(() => {
  progressSv.value = withTiming(setProgress, {
    duration: 260,
    easing: Easing.out(Easing.cubic),
  });
}, [setProgress]);

const progressStyle = useAnimatedStyle(() => ({
  transform: [{ scaleX: Math.max(0, Math.min(1, progressSv.value)) }],
}));

<View style={styles.progressTrack}>
  <Animated.View style={[styles.progressFill, progressStyle]} />
</View>
```

---

## 15. Custom Hooks

### useSelection

Multi-select state management:

```typescript
// lib/hooks/use-selection.ts
function useSelection<T extends { id: string }>(): SelectionState<T> {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    hasSelection: selectedIds.size > 0,
    isSelected: (item) => selectedIds.has(item.id),
    toggle: (item) => { /* toggle logic with haptics */ },
    select: (item) => { /* add to selection */ },
    deselect: (item) => { /* remove from selection */ },
    selectAll: (items) => { /* select all items */ },
    clear: () => setSelectedIds(new Set()),
    getSelected: (items) => items.filter(i => selectedIds.has(i.id)),
  };
}
```

### useColorScheme

Platform color scheme detection:

```typescript
// hooks/use-color-scheme.ts
export { useColorScheme } from 'react-native';

// hooks/use-color-scheme.web.ts (platform-specific override)
export function useColorScheme() {
  // Web-specific implementation using matchMedia
}
```

### useThemeColor

Get specific theme color:

```typescript
// hooks/use-theme-color.ts
export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light
) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];
  return colorFromProps ?? Colors[theme][colorName];
}
```

---

## 16. Data Files

### programs-light.json

Lightweight program metadata for browsing (2,598 programs):

```json
{
  "version": "1.0",
  "generatedAt": "2024-12-28T00:00:00Z",
  "programs": [
    {
      "id": "kaggle-001",
      "name": "Starting Strength",
      "description": "Classic 3x5 strength program for beginners",
      "type": "STRENGTH",
      "difficulty": "BEGINNER",
      "duration": 12,
      "daysPerWeek": 3,
      "sampleWorkout": {
        "name": "Workout A",
        "exercises": [
          { "name": "Squat", "sets": 3, "reps": "5" },
          { "name": "Bench Press", "sets": 3, "reps": "5" },
          { "name": "Deadlift", "sets": 1, "reps": "5" }
        ]
      }
    }
    // ... 2,597 more programs
  ]
}
```

### exercises-v2.9.json

Enhanced exercise database (700+ exercises):

```json
[
  {
    "name": "Barbell Back Squat",
    "aliases": ["Back Squat", "Squat", "BB Squat", "Low Bar Squat", "High Bar Squat"],
    "category": "Legs",
    "equipment": ["Barbell", "Squat Rack"],
    "difficulty": "Intermediate",
    "muscles": {
      "targetGroup": "Quadriceps",
      "primeMover": "Quadriceps",
      "secondary": "Glutes",
      "tertiary": "Hamstrings"
    },
    "movementPatterns": ["Squat", "Hip Hinge"],
    "planesOfMotion": ["Sagittal"]
  }
  // ... 699 more exercises
]
```

### File Sizes

| File | Size | Contents |
|------|------|----------|
| `programs-light.json` | ~2 MB | 2,598 program metadata |
| `workout-programs.json` | ~121 MB | Full program details (lazy-loaded) |
| `exercises.json` | ~50 KB | 160 basic exercises |
| `exercises-v2.9.json` | ~1 MB | 700+ enhanced exercises |

---

## 17. Build Configuration

### app.json (Expo Config)

```json
{
  "expo": {
    "name": "Workout_App",
    "slug": "Workout_App",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "workoutapp",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": false,
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/images/android-icon-foreground.png"
      }
    },
    "web": {
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      "expo-router",
      ["expo-splash-screen", { "image": "./assets/images/splash-icon.png" }],
      "expo-secure-store"
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

### tsconfig.json

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

### package.json Scripts

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "lint": "expo lint",
    "seed": "tsx scripts/seed-exercises.ts",
    "seed:supabase": "tsx scripts/seed-exercises-supabase.ts"
  }
}
```

---

## 18. Key Code Snippets

### Complete Screen Example

```typescript
// app/(tabs)/browse.tsx - Discover Screen
export default function BrowseScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [displayedPrograms, setDisplayedPrograms] = useState<ProgramDisplayItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const selection = useSelection<ProgramDisplayItem>();

  // Load programs with pagination
  const loadPage = useCallback(async (opts?: { reset?: boolean }) => {
    const offset = opts?.reset ? 0 : displayedPrograms.length;
    
    const res = await programsService.listCatalog({
      q: searchQuery,
      filters: { type: typeFilter },
      limit: 50,
      offset,
    });
    
    setDisplayedPrograms(prev => opts?.reset ? res.items : [...prev, ...res.items]);
    setIsLoading(false);
  }, [displayedPrograms.length, searchQuery, typeFilter]);

  // Add selected programs to My Programs
  const handleAddSelected = async () => {
    const count = await programsService.installProgramsByCatalogIds(
      Array.from(selection.selectedIds)
    );
    selection.clear();
    Alert.alert('Success', `Added ${count} programs!`);
  };

  return (
    <SwipeTabs current="browse">
      <Screen>
        {/* Search bar */}
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search programs..."
        />
        
        {/* Program list */}
        <FlatList
          data={displayedPrograms}
          renderItem={({ item }) => (
            <ProgramCard
              program={item}
              isSelected={selection.isSelected(item)}
              onToggleSelect={selection.toggle}
            />
          )}
          onEndReached={loadPage}
        />
        
        {/* Add button */}
        {selection.hasSelection && (
          <Pressable onPress={handleAddSelected}>
            <Text>Add {selection.selectedCount} Programs</Text>
          </Pressable>
        )}
      </Screen>
    </SwipeTabs>
  );
}
```

### Service Pattern Example

```typescript
// lib/services/programs/programs-service.ts
export class ProgramsService {
  private catalogRepo = new LocalBundledCatalogRepo();
  private index: IndexedProgram[] | null = null;

  private ensureIndex() {
    if (this.index) return;
    this.index = this.catalogRepo.getAll().map(p => ({
      program: p,
      haystack: [p.name, p.description, ...p.tags].join(' ').toLowerCase(),
    }));
  }

  async listCatalog(query: CatalogQuery) {
    this.ensureIndex();
    
    // Filter
    const filtered = this.index.filter(({ haystack, program }) => {
      if (query.q && !haystack.includes(query.q.toLowerCase())) return false;
      if (query.filters?.type && program.type !== query.filters.type) return false;
      return true;
    });
    
    // Paginate
    const page = filtered.slice(query.offset, query.offset + query.limit);
    
    return {
      total: filtered.length,
      items: page.map(({ program }) => toProgramDisplayItem(program)),
    };
  }
}
```

---

## 19. Data Flow Diagrams

### Program Discovery Flow

```
User opens Discover tab
         │
         ↓
┌─────────────────────────┐
│ BrowseScreen component  │
│ useEffect → loadPage()  │
└────────────┬────────────┘
             │
             ↓
┌─────────────────────────┐
│ programsService         │
│ .listCatalog()          │
└────────────┬────────────┘
             │
             ↓
┌─────────────────────────┐
│ LocalBundledCatalogRepo │
│ .getAll()               │
└────────────┬────────────┘
             │
             ↓
┌─────────────────────────┐
│ programs-light.json     │
│ (2,598 programs)        │
└────────────┬────────────┘
             │
             ↓
┌─────────────────────────┐
│ Filter & Paginate       │
│ (50 items per page)     │
└────────────┬────────────┘
             │
             ↓
┌─────────────────────────┐
│ Render FlatList         │
│ with ProgramCards       │
└─────────────────────────┘
```

### Install Program Flow

```
User selects programs
         │
         ↓
User taps "Add to My Programs"
         │
         ↓
┌─────────────────────────┐
│ programsService         │
│ .installProgramsByCatalogIds()│
└────────────┬────────────┘
             │
             ↓ For each ID
┌─────────────────────────┐
│ catalogRepo.getById()   │
│ → Get full program      │
└────────────┬────────────┘
             │
             ↓
┌─────────────────────────┐
│ toStorageFormat()       │
│ → Convert to storage    │
└────────────┬────────────┘
             │
             ↓
┌─────────────────────────┐
│ storage.saveProgram()   │
│ → AsyncStorage          │
└────────────┬────────────┘
             │
             ↓
┌─────────────────────────┐
│ '@workout_programs'     │
│ key updated             │
└─────────────────────────┘
```

### Workout Session Flow

```
User taps "Start Workout"
         │
         ↓
Navigate to /workout/[id]
         │
         ↓
┌─────────────────────────┐
│ loadWorkout()           │
├─────────────────────────┤
│ 1. getActiveWorkoutState()│
│    → Check for resume   │
├─────────────────────────┤
│ 2. getProgram(id)       │
│    → Load program       │
├─────────────────────────┤
│ 3. getEffectiveProgramData()│
│    → Apply user edits   │
├─────────────────────────┤
│ 4. Create WorkoutSession│
└────────────┬────────────┘
             │
             ↓
┌─────────────────────────┐
│ Workout UI renders      │
│ - Exercise list         │
│ - Set checkboxes        │
│ - Timer display         │
└────────────┬────────────┘
             │
             ↓ User completes set
┌─────────────────────────┐
│ completeSet()           │
│ - Mark set done         │
│ - Start rest timer      │
│ - Persist state         │
└────────────┬────────────┘
             │
             ↓ All sets done
┌─────────────────────────┐
│ handleWorkoutComplete() │
│ - Save to history       │
│ - Clear active state    │
│ - Navigate to summary   │
└─────────────────────────┘
```

---

## 20. Glossary

| Term | Definition |
|------|------------|
| **AsyncStorage** | React Native's key-value persistence API (like localStorage) |
| **expo-router** | File-based routing system for React Native |
| **Program** | A saved workout routine containing multiple workouts |
| **Workout** | A single training session with exercises |
| **Exercise** | A movement with sets and reps |
| **Set** | A group of repetitions |
| **Rep** | A single repetition of an exercise |
| **RPE** | Rate of Perceived Exertion (1-10 scale) |
| **Catalog** | The 2,598 built-in workout programs |
| **Installed** | A catalog program saved to "My Programs" |
| **Template** | User customizations to a program |
| **Session** | An active workout in progress |
| **Reanimated** | Animation library running on UI thread |
| **Haptics** | Vibration feedback on user interactions |
| **SF Symbols** | Apple's icon system for iOS |
| **Material Icons** | Google's icon system for Android |
| **Supabase** | Backend-as-a-service for auth and database |
| **SecureStore** | Encrypted storage for sensitive data |
| **Deep Linking** | Opening app to specific screen via URL |

---

## Document End

This document provides a comprehensive technical overview of the Workout_App codebase. For questions or clarifications, analyze specific files referenced in this document.

**File Locations for Deep Dives:**
- Architecture: `lib/services/programs/programs-service.ts`
- Data Layer: `lib/db/storage.ts`
- Authentication: `lib/context/auth-context.tsx`
- Navigation: `app/_layout.tsx`, `app/(tabs)/_layout.tsx`
- Theming: `constants/theme.ts`
- Components: `components/` directory
