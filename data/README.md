# Exercise Database Repository

This directory contains comprehensive exercise data used to enhance the workout tracker app's functionality.

## Files

- **`exercises.json`** - Comprehensive exercise database with 200+ exercises including:
  - Exercise names (canonical forms)
  - Aliases (common variations and abbreviations)
  - Categories (Chest, Back, Shoulders, Legs, Arms, Core, Cardio)
  - Equipment types (Barbell, Dumbbell, Cable, Machine, Bodyweight, etc.)
  - Muscle groups targeted (for future enhancements)

## Exercise Data Structure

Each exercise entry follows this structure:

```json
{
  "name": "Bench Press",
  "aliases": ["Barbell Bench Press", "BB Bench Press", "Flat Bench Press"],
  "category": "Chest",
  "equipment": ["Barbell"],
  "muscleGroups": ["Chest", "Triceps", "Shoulders"]
}
```

## Categories

- **Chest** - Chest-focused exercises
- **Back** - Back and lat exercises
- **Shoulders** - Shoulder and deltoid exercises
- **Legs** - Quad, hamstring, glute, and calf exercises
- **Arms** - Bicep and tricep exercises
- **Core** - Abdominal and core exercises
- **Cardio** - Cardiovascular exercises

## Equipment Types

- **Barbell** - Barbell exercises
- **Dumbbell** - Dumbbell exercises
- **Cable** - Cable machine exercises
- **Machine** - Machine-based exercises
- **Bodyweight** - Bodyweight exercises
- **Kettlebell** - Kettlebell exercises
- **Other** - Specialized equipment (Ab Wheel, Battle Ropes, etc.)

## Usage

To seed the database with this exercise data, run:

```bash
pnpm run seed
```

Or directly:

```bash
tsx scripts/seed-exercises.ts
```

## Adding New Exercises

To add new exercises:

1. Edit `exercises.json`
2. Add a new entry following the structure above
3. Include common aliases and variations
4. Run the seed script to update the database

## Data Sources

This exercise database was compiled from:
- Common fitness terminology
- Popular exercise variations
- Industry-standard exercise names
- Common abbreviations and aliases used in workout programs

## Future Enhancements

Potential additions to enhance the database:
- Exercise instructions/descriptions
- Difficulty levels
- Primary vs secondary muscle groups
- Exercise images/videos
- Common rep ranges
- Injury considerations
- Exercise progressions/regressions

