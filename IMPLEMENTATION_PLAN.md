# Workout App - Implementation Plan

This document outlines the complete implementation plan for replicating the Workout Tracker App functionality in this Expo-based mobile application.

## ✅ Completed

### 1. Database Schema
- ✅ Created Prisma schema with SQLite for mobile ([prisma/schema.prisma](prisma/schema.prisma))
- ✅ All 17 models from original app adapted for mobile use
- ✅ Generated Prisma Client

### 2. Exercise Database
- ✅ Copied 160+ exercise database from Workout Tracker App
- ✅ Created exercise database service ([lib/services/exercise/database.ts](lib/services/exercise/database.ts))
- ✅ Created exercise matching algorithm ([lib/services/exercise/matcher.ts](lib/services/exercise/matcher.ts))

### 3. Core Services
- ✅ Database client ([lib/db/client.ts](lib/db/client.ts))
- ✅ Authentication service ([lib/services/auth.ts](lib/services/auth.ts))
- ✅ Type definitions ([lib/types/program.ts](lib/types/program.ts))

## 🔨 To Implement

### Phase 1: Core Infrastructure (High Priority)

#### A. Database Setup
- [ ] Create database initialization script
- [ ] Create exercise database seeder
- [ ] Add database migration support

#### B. File Services
- [ ] PDF parser service (`lib/services/parser/pdf.ts`)
  - Use `react-native-pdf` or `expo-file-system` + web APIs
- [ ] CSV parser service (`lib/services/parser/csv.ts`)
  - Use `papaparse`
- [ ] Excel parser service (`lib/services/parser/excel.ts`)
  - Use `xlsx` library
- [ ] Main parser service (`lib/services/parser/index.ts`)
  - Orchestrates all parsers

#### C. Export Services
- [ ] Hevy CSV exporter (`lib/services/exporter/hevy.ts`)
- [ ] Generic CSV exporter
- [ ] File sharing via `expo-sharing`

### Phase 2: Navigation & Layout (High Priority)

#### A. Update Tab Navigation
Current structure:
```
app/(tabs)/
  - index.tsx (Home)
  - explore.tsx (Explore)
```

New structure needed:
```
app/(tabs)/
  - index.tsx (Dashboard - Program List)
  - upload.tsx (Upload Programs)
  - workouts.tsx (Workout Logs)
  - profile.tsx (User Profile)
  - more.tsx (Settings, Challenges, Analytics)
```

#### B. Auth Screens
```
app/(auth)/
  - login.tsx
  - signup.tsx
```

#### C. Program Screens
```
app/program/
  - [id].tsx (Program Detail)
  - [id]/mapping.tsx (Exercise Mapping)
  - [id]/export.tsx (Generate Install Link)
```

### Phase 3: Core Screens (High Priority)

#### 1. Authentication Screens
- [ ] **Login Screen** (`app/(auth)/login.tsx`)
  - Email/password form
  - Link to signup
  - Remember me option

- [ ] **Signup Screen** (`app/(auth)/signup.tsx`)
  - Email/password/name form
  - Role selection (Consumer/Coach)
  - Link to login

#### 2. Dashboard & Program Management
- [ ] **Dashboard Screen** (`app/(tabs)/index.tsx`)
  - List of user's programs
  - Status indicators (Parsing/Mapping/Ready/Error)
  - Upload button
  - Filter by status

- [ ] **Upload Screen** (`app/(tabs)/upload.tsx`)
  - File picker (PDF/CSV/Excel)
  - Program name input
  - Description input
  - Upload progress
  - Parse on upload

- [ ] **Program Detail Screen** (`app/program/[id].tsx`)
  - Program info (name, description, status)
  - Workout list (weeks/days structure)
  - Exercise list per workout
  - Actions: Map Exercises, Export, Delete

#### 3. Exercise Mapping
- [ ] **Exercise Mapping Screen** (`app/program/[id]/mapping.tsx`)
  - List of all exercises from program
  - For each exercise:
    - Original name
    - Suggested match (with confidence %)
    - Search/select alternative
    - Manual entry option
  - Confidence color coding:
    - Green: >80% (high confidence)
    - Yellow: 50-80% (review recommended)
    - Red: <50% (needs attention)
  - Save mappings button
  - Progress indicator (X/Y mapped)

#### 4. Workout Logging
- [ ] **Workout Log List** (`app/(tabs)/workouts.tsx`)
  - List of completed workouts
  - Date, program, duration
  - Filter by date range
  - Quick add workout button

- [ ] **Log Workout Screen** (`app/workout/log.tsx`)
  - Select program/workout
  - For each exercise:
    - Sets/reps/weight inputs
    - Checkbox for completed
    - Notes field
  - Timer
  - Save workout log

#### 5. User Profile & Settings
- [ ] **Profile Screen** (`app/(tabs)/profile.tsx`)
  - User info (name, email, role)
  - Fitness profile:
    - Goals (weight loss, muscle gain, etc.)
    - Fitness level
    - Age, height, weight
    - Preferred workout time
    - Equipment preferences
  - Edit profile button

- [ ] **Settings Screen** (`app/settings.tsx`)
  - Account settings
  - Notification preferences
  - Theme selection
  - About/version info
  - Logout button

### Phase 4: Advanced Features (Medium Priority)

#### 6. Export & Sharing
- [ ] **Export Screen** (`app/program/[id]/export.tsx`)
  - Generate CSV for Hevy/Strong
  - Create shareable install link
  - Share via system share sheet
  - Copy link to clipboard
  - QR code generation

#### 7. Analytics & Progress
- [ ] **Analytics Screen** (`app/analytics.tsx`)
  - Total workouts completed
  - Programs used
  - Most common exercises
  - Workout frequency chart
  - Personal records
  - Volume over time

#### 8. Challenges
- [ ] **Challenges List** (`app/challenges.tsx`)
  - Active challenges
  - Available challenges
  - Completed challenges
  - Create challenge (coach only)

- [ ] **Challenge Detail** (`app/challenges/[id].tsx`)
  - Challenge info
  - Participants
  - Leaderboard
  - Join/leave button
  - Progress tracking

#### 9. Sessions/Booking
- [ ] **Sessions Calendar** (`app/sessions.tsx`)
  - Calendar view
  - Upcoming sessions
  - Schedule new session
  - Link to program

### Phase 5: Components (Throughout)

#### Reusable Components
```
components/
  - program/
    - ProgramCard.tsx (list item)
    - ProgramDetail.tsx
    - ExerciseList.tsx
    - ExerciseMappingRow.tsx
    - UploadForm.tsx

  - workout/
    - WorkoutCard.tsx
    - ExerciseInput.tsx
    - WorkoutTimer.tsx

  - exercise/
    - ExerciseSearch.tsx
    - ExerciseDetail.tsx
    - VideoPlayer.tsx (for exercise videos)

  - analytics/
    - Chart.tsx
    - StatCard.tsx

  - challenges/
    - ChallengeCard.tsx
    - ParticipantList.tsx

  - ui/
    - Button.tsx
    - Input.tsx
    - Select.tsx
    - Card.tsx
    - Badge.tsx
    - LoadingSpinner.tsx
    - ErrorMessage.tsx
```

### Phase 6: Polish & Optimization (Low Priority)

- [ ] Add loading states
- [ ] Add error boundaries
- [ ] Add offline support
- [ ] Add data synchronization
- [ ] Add push notifications
- [ ] Add haptic feedback
- [ ] Add animations/transitions
- [ ] Add onboarding flow
- [ ] Add empty states
- [ ] Add skeleton loaders

## Package Dependencies Installed

```json
{
  "dependencies": {
    "@prisma/client": "^latest",
    "prisma": "^latest",
    "expo-sqlite": "^latest",
    "expo-document-picker": "^latest",
    "expo-file-system": "^latest",
    "expo-secure-store": "^latest",
    "expo-crypto": "^latest",
    "nanoid": "^latest",
    "zod": "^latest",
    "react-hook-form": "^latest",
    "@hookform/resolvers": "^latest",
    "clsx": "^latest",
    "class-variance-authority": "^latest"
  }
}
```

## Additional Dependencies Needed

```bash
# For file parsing
npm install papaparse xlsx
npm install @types/papaparse

# For charts/analytics
npm install react-native-chart-kit react-native-svg

# For calendar
npm install react-native-calendars

# For QR codes
npm install react-native-qrcode-svg

# For sharing
npm install expo-sharing

# For PDF (if native parsing needed)
npm install react-native-pdf
```

## Database Models Overview

All 17 models from original app:

1. **User** - User accounts (CONSUMER/COACH roles)
2. **Program** - Uploaded workout programs
3. **ProgramVersion** - Versioned program data
4. **Workout** - Individual workouts (week/day)
5. **Exercise** - Exercises within workouts
6. **ExerciseDatabase** - 160+ exercise library
7. **InstallLink** - Shareable install links
8. **UserProfile** - Extended user info
9. **WorkoutLog** - Completed workout tracking
10. **WorkoutLogExercise** - Exercise tracking in logs
11. **Activity** - Wearable device data
12. **WorkoutSession** - Booking/scheduling
13. **Membership** - Tier system (FREE/BASIC/PREMIUM)
14. **ProgramRating** - Community ratings
15. **Challenge** - Community challenges
16. **ChallengeParticipant** - Challenge participation

## Key Workflows

### 1. Upload & Parse Workflow
1. User selects file (PDF/CSV/Excel)
2. App uploads file to local storage
3. Parser extracts exercises, sets, reps, weights
4. Creates Program with status: PARSING
5. Automatically matches exercises to database
6. Changes status to MAPPING
7. User reviews/corrects mappings
8. Changes status to READY

### 2. Exercise Mapping Workflow
1. Display all exercises from program
2. For each exercise:
   - Show original name
   - Run fuzzy matching against database
   - Display best match with confidence %
   - Allow manual search/selection
3. User confirms or corrects matches
4. Save mapped exercise IDs to Exercise model

### 3. Export Workflow
1. User selects program
2. Clicks "Generate Install Link"
3. App generates Hevy-compatible CSV
4. Saves CSV to file system
5. Creates InstallLink with unique slug
6. Returns shareable URL/QR code
7. User shares via system share sheet

### 4. Install Link Workflow
1. User clicks install link
2. App opens install page
3. Shows program info
4. Download CSV button
5. Tracks install count

## Development Priorities

### Week 1: Foundation
- Set up database & migrations
- Seed exercise database
- Create authentication screens
- Build basic navigation

### Week 2: Core Features
- Upload & parsing
- Program list & detail
- Exercise matching
- Exercise mapping UI

### Week 3: Logging & Export
- Workout logging
- CSV export
- Install link generation
- Sharing functionality

### Week 4: Advanced Features
- User profiles
- Analytics
- Challenges
- Sessions

### Week 5: Polish
- Error handling
- Loading states
- Animations
- Testing
- Bug fixes

## Notes

- SQLite is used instead of PostgreSQL (mobile-friendly)
- File storage is local (using expo-file-system)
- No cloud storage needed for MVP
- Authentication is local (can add cloud sync later)
- All JSON fields in Prisma schema use String type with JSON.parse/stringify

## Next Steps

1. Run `npm install` for additional dependencies
2. Create database initialization script
3. Seed exercise database
4. Build authentication screens
5. Build dashboard and upload screens
6. Implement parsers
7. Build exercise mapping UI
8. Add export functionality
9. Build remaining screens
10. Test and polish

---

**Total Estimated Effort:** 4-5 weeks for full implementation
**MVP (Upload, Parse, Map, Export):** 2-3 weeks
