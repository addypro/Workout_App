# Workout App - MVP (Minimum Viable Product)

A simplified workout tracking and program management mobile app built with Expo and React Native.

## 🚀 What's Included in MVP

### ✅ Completed Features

1. **Exercise Database (160+ exercises)**
   - Browse and search through comprehensive exercise library
   - Categories: Chest, Back, Shoulders, Legs, Arms, Core, Cardio
   - Exercise details including aliases and equipment needed

2. **Program Management**
   - View list of uploaded workout programs
   - Status tracking (PARSING, MAPPING, READY, ERROR)
   - Program details and creation dates

3. **CSV Upload**
   - Upload workout programs via CSV files
   - Automatic parsing of workout data
   - Support for Week/Day/Exercise structure

4. **Database Setup**
   - SQLite database with Prisma ORM
   - 17 data models for full functionality
   - Seeded with 160+ exercises

## 📱 How to Run

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Database
```bash
# Generate Prisma Client
npm run db:generate

# Create database tables
npm run db:push

# Seed exercise database
npm run seed
```

### 3. Start the App
```bash
npm start
```

Then press:
- `i` for iOS simulator
- `a` for Android emulator
- Scan QR code with Expo Go app for physical device

## 📂 App Structure

### 3 Main Tabs:

1. **Programs** ([app/(tabs)/index.tsx](app/(tabs)/index.tsx))
   - View all uploaded programs
   - See program status and details
   - Empty state when no programs exist

2. **Upload** ([app/(tabs)/upload.tsx](app/(tabs)/upload.tsx))
   - Upload CSV workout files
   - See CSV format example
   - Parse and save programs

3. **Exercises** ([app/(tabs)/explore.tsx](app/(tabs)/explore.tsx))
   - Browse 160+ exercise database
   - Search by name
   - View exercise categories and equipment

## 📄 CSV Format

Your CSV file should follow this format:

```csv
Week,Day,Exercise,Sets,Reps,Weight
1,1,Bench Press,4,8-10,135 lbs
1,1,Squat,4,10,225 lbs
1,2,Deadlift,3,5,315 lbs
```

### Required Columns:
- **Week**: Week number (1, 2, 3, etc.)
- **Day**: Day number (1-7)
- **Exercise**: Exercise name
- **Sets**: Number of sets
- **Reps**: Repetitions (can be range like "8-10")
- **Weight**: Weight amount with unit (optional)

## 🗄️ Database

- **Engine**: SQLite (mobile-friendly)
- **ORM**: Prisma
- **Location**: `prisma/workout.db`
- **Models**: 17 models including User, Program, Exercise, WorkoutLog, etc.

### View Database
```bash
npm run db:studio
```

This opens Prisma Studio in your browser to view and edit data.

## 🔧 Development Commands

```bash
npm start           # Start Expo dev server
npm run android     # Run on Android
npm run ios         # Run on iOS
npm run web         # Run on web

npm run db:generate # Generate Prisma Client
npm run db:push     # Push schema to database
npm run db:studio   # Open Prisma Studio
npm run seed        # Seed exercise database
```

## 🎯 What's Next (Future Iterations)

### Phase 1: Exercise Mapping
- [ ] Manual exercise mapping UI
- [ ] Confidence scoring display
- [ ] Fuzzy matching integration

### Phase 2: Export & Sharing
- [ ] Generate Hevy CSV exports
- [ ] Create shareable install links
- [ ] Share via system share sheet

### Phase 3: Workout Logging
- [ ] Log completed workouts
- [ ] Track sets, reps, weight
- [ ] Workout timer

### Phase 4: Analytics
- [ ] Progress tracking
- [ ] Personal records
- [ ] Volume charts

### Phase 5: Social Features
- [ ] Challenges
- [ ] Program ratings
- [ ] Community features

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for full roadmap.

## 📊 Exercise Database Stats

The app includes **160 exercises** across 7 categories:

- **Legs**: 37 exercises
- **Arms**: 26 exercises
- **Back**: 24 exercises
- **Core**: 24 exercises
- **Chest**: 17 exercises
- **Cardio**: 16 exercises
- **Shoulders**: 16 exercises

## 🛠️ Tech Stack

- **Framework**: Expo ~54
- **Language**: TypeScript 5.9
- **Database**: SQLite + Prisma 6.19
- **Navigation**: Expo Router 6.0
- **UI**: React Native 0.81
- **File Handling**: expo-document-picker, expo-file-system
- **Storage**: expo-secure-store

## 🐛 Troubleshooting

### Database Issues
```bash
# Reset database
rm prisma/workout.db
npm run db:push
npm run seed
```

### Prisma Client Issues
```bash
npm run db:generate
```

### Clear Cache
```bash
expo start -c
```

## 📝 Example Usage

1. **Upload a Program**:
   - Go to Upload tab
   - Click "Select CSV File"
   - Choose your workout CSV
   - Click "Upload & Parse"

2. **Browse Exercises**:
   - Go to Exercises tab
   - Search for exercises (e.g., "squat")
   - View details, aliases, and equipment

3. **View Programs**:
   - Go to Programs tab
   - See all uploaded programs
   - Check status and details

## 🔐 Authentication

Currently simplified for MVP:
- No login required
- All programs use demo user ID
- Future: Will add proper authentication

## 📞 Support

For issues or questions:
1. Check [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)
2. Review code comments
3. Check Expo/Prisma documentation

---

**Version**: MVP 1.0
**Last Updated**: December 7, 2024
**Status**: ✅ Ready to Test

## 🎉 Ready to Use!

The MVP is now ready for testing. Start by uploading a CSV workout program and exploring the exercise database!
