# Importing Kaggle Fitness Programs Dataset

## Dataset Information

**Source:** [600K Fitness Exercise and Workout Program Dataset](https://www.kaggle.com/datasets/adnanelouardi/600k-fitness-exercise-and-workout-program-dataset)

**Contents:**
- 2,598 unique fitness programs
- Aggregated metadata for each program
- Program structure and exercise mappings
- 600K+ total data points

---

## Step 1: Download the Dataset

### Option A: Using Kaggle CLI (Recommended)

1. **Install Kaggle CLI:**
   ```bash
   pip install kaggle
   ```

2. **Set up Kaggle API credentials:**
   - Go to [Kaggle Account Settings](https://www.kaggle.com/settings)
   - Scroll to "API" section
   - Click "Create New API Token"
   - Save `kaggle.json` to `~/.kaggle/kaggle.json`

3. **Download the dataset:**
   ```bash
   # Create downloads directory
   mkdir -p ~/Downloads/kaggle-fitness-dataset
   cd ~/Downloads/kaggle-fitness-dataset

   # Download dataset
   kaggle datasets download -d adnanelouardi/600k-fitness-exercise-and-workout-program-dataset

   # Unzip
   unzip 600k-fitness-exercise-and-workout-program-dataset.zip
   ```

### Option B: Manual Download

1. Visit: https://www.kaggle.com/datasets/adnanelouardi/600k-fitness-exercise-and-workout-program-dataset
2. Click "Download" button (requires Kaggle account)
3. Save to `~/Downloads/`
4. Unzip the file

---

## Step 2: Run the Import Script

Once downloaded, run the import script:

```bash
cd /Users/addythegr8/Workout_App

# Install required dependencies (if not already installed)
npm install

# Run the import script
node scripts/import-kaggle-programs.js ~/Downloads/kaggle-fitness-dataset
```

The script will:
1. Read the CSV files from the dataset
2. Parse and validate program data
3. Convert to app-compatible format
4. Save to `data/workout-programs.json`
5. Optionally seed to Supabase database

---

## Step 3: Verify Import

```bash
# Check the imported data
cat data/workout-programs.json | jq '.programs | length'

# Should output: 2598
```

---

## Expected Dataset Structure

The Kaggle dataset should contain CSV files with:

### Programs CSV
- `program_id` - Unique identifier
- `program_name` - Name of the workout program
- `program_type` - Type (strength, cardio, hybrid, etc.)
- `duration_weeks` - Program duration
- `difficulty` - Beginner, Intermediate, Advanced
- `target_muscle_groups` - Primary focus areas
- `equipment_required` - List of equipment
- `description` - Program description

### Workouts CSV
- `workout_id` - Unique identifier
- `program_id` - Links to program
- `day_number` - Day in program
- `week_number` - Week in program
- `workout_type` - Type of workout
- `exercises` - JSON array of exercises

### Exercises CSV
- `exercise_id` - Unique identifier
- `workout_id` - Links to workout
- `exercise_name` - Name
- `sets` - Number of sets
- `reps` - Reps per set
- `weight` - Weight (if applicable)
- `rest_seconds` - Rest time

---

## Data Transformation

The import script transforms the dataset to match your app's schema:

```javascript
{
  "programs": [
    {
      "id": "prog-1",
      "name": "5x5 Stronglifts",
      "type": "STRENGTH",
      "duration": 12, // weeks
      "difficulty": "INTERMEDIATE",
      "muscleGroups": ["Full Body"],
      "equipment": ["Barbell", "Squat Rack"],
      "description": "Classic 5x5 strength program",
      "workouts": [
        {
          "week": 1,
          "day": 1,
          "name": "Workout A",
          "exercises": [
            {
              "name": "Squat",
              "sets": 5,
              "reps": "5",
              "weight": "bodyweight+20%",
              "restTime": 180
            }
          ]
        }
      ]
    }
  ],
  "metadata": {
    "totalPrograms": 2598,
    "importDate": "2025-12-09",
    "source": "Kaggle"
  }
}
```

---

## Integration with App

After importing, the programs will be available in your app:

1. **Browse Programs:**
   - New "Browse" tab to explore all 2,598 programs
   - Filter by type, difficulty, duration
   - Search by name or muscle group

2. **Install Program:**
   - Tap any program to view details
   - "Install to My Programs" button
   - Creates a copy in your personal library

3. **Start Workout:**
   - Installed programs appear in "My Programs"
   - Tap "Start Workout" to begin execution
   - Track progress through the program

---

## Database Schema Integration

Programs will be stored in Supabase with proper relationships:

```sql
-- Programs table already exists in your schema
INSERT INTO programs (name, description, source_type, status, parsed_data)
VALUES (
  'Program Name',
  'Program Description',
  'KAGGLE',
  'READY',
  jsonb_build_object(
    'workouts', [...],
    'metadata', {...}
  )
);
```

---

## Troubleshooting

### "kaggle: command not found"
```bash
pip install kaggle
# or
pip3 install kaggle
```

### "403 Forbidden"
- Ensure `kaggle.json` is in `~/.kaggle/`
- Check file permissions: `chmod 600 ~/.kaggle/kaggle.json`

### "Dataset not found"
- Verify the dataset URL is correct
- Ensure you're logged into Kaggle
- Try manual download instead

### "CSV parsing errors"
- Check CSV file format
- Verify all required columns exist
- Check for encoding issues (should be UTF-8)

---

## Next Steps

After importing the dataset:

1. ✅ Create "Browse Programs" screen
2. ✅ Add program filtering and search
3. ✅ Implement "Install Program" functionality
4. ✅ Add program preview/details screen
5. ✅ Track user progress through installed programs
6. ✅ Add program ratings and reviews

---

## File Locations

After import:
- **JSON Data:** `data/workout-programs.json`
- **Import Script:** `scripts/import-kaggle-programs.js`
- **Supabase Seed:** Optional, can seed directly to DB

---

## Performance Notes

- 2,598 programs × average 12 workouts = ~31,000 workouts
- JSON file size: ~15-25 MB (compressed)
- Database storage: ~50 MB (with indexes)
- Load time: <100ms (cached), <500ms (initial)

Recommended approach:
- Load programs list (metadata only)
- Lazy-load full program details on demand
- Cache popular programs client-side
