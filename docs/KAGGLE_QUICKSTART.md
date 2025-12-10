# Quick Start: Import Kaggle Dataset

## TL;DR

```bash
# 1. Download dataset
kaggle datasets download -d adnanelouardi/600k-fitness-exercise-and-workout-program-dataset
unzip 600k-fitness-exercise-and-workout-program-dataset.zip -d ~/Downloads/kaggle-fitness

# 2. Import to app
cd /Users/addythegr8/Workout_App
node scripts/import-kaggle-programs.js ~/Downloads/kaggle-fitness

# 3. Done! Programs saved to data/workout-programs.json
```

---

## Prerequisites

### 1. Kaggle Account & API Setup

**First time only:**

```bash
# Install Kaggle CLI
pip install kaggle

# Get API token from Kaggle
# 1. Go to https://www.kaggle.com/settings
# 2. Click "Create New API Token"
# 3. Save kaggle.json to ~/.kaggle/

# Set permissions
chmod 600 ~/.kaggle/kaggle.json
```

---

## Download Options

### Option A: CLI (Fast, Automated)

```bash
# Create download directory
mkdir -p ~/Downloads/kaggle-fitness

# Download dataset (~ 100MB)
kaggle datasets download -d adnanelouardi/600k-fitness-exercise-and-workout-program-dataset

# Unzip
unzip 600k-fitness-exercise-and-workout-program-dataset.zip -d ~/Downloads/kaggle-fitness

# Import
node scripts/import-kaggle-programs.js ~/Downloads/kaggle-fitness
```

### Option B: Manual (No CLI needed)

1. **Download:**
   - Visit: https://www.kaggle.com/datasets/adnanelouardi/600k-fitness-exercise-and-workout-program-dataset
   - Click "Download" (requires login)
   - Save to Downloads folder

2. **Unzip:**
   - Double-click the ZIP file
   - Or: `unzip <filename>.zip -d ~/Downloads/kaggle-fitness`

3. **Import:**
   ```bash
   node scripts/import-kaggle-programs.js ~/Downloads/kaggle-fitness
   ```

---

## What You Get

After import, you'll have:

📄 **`data/workout-programs.json`**
- 2,598 fitness programs
- Structured workout data
- Exercise details with sets/reps
- Metadata (type, difficulty, duration)

**Sample program:**
```json
{
  "id": "kaggle-123",
  "name": "5x5 Stronglifts",
  "type": "STRENGTH",
  "duration": 12,
  "difficulty": "INTERMEDIATE",
  "muscleGroups": ["Full Body"],
  "equipment": ["Barbell", "Squat Rack"],
  "workouts": [
    {
      "week": 1,
      "day": 1,
      "exercises": [...]
    }
  ]
}
```

---

## Next Steps

### 1. Browse Programs in App

Create a "Browse Programs" screen to explore imported programs.

### 2. Install to My Programs

Allow users to copy programs to their personal library.

### 3. Start Workouts

Use existing workout execution feature to complete programs.

---

## Verification

```bash
# Check if import was successful
cat data/workout-programs.json | head -50

# Count programs (should be 2598)
node -e "console.log(require('./data/workout-programs.json').metadata.totalPrograms)"

# View statistics
node -e "const data = require('./data/workout-programs.json'); \
  console.log('Programs:', data.metadata.totalPrograms); \
  console.log('Imported:', data.metadata.importDate);"
```

---

## Troubleshooting

### "kaggle: command not found"
```bash
pip install kaggle
# or
pip3 install kaggle
```

### "403: Forbidden"
- Check `~/.kaggle/kaggle.json` exists
- Verify permissions: `chmod 600 ~/.kaggle/kaggle.json`
- Re-download API token from Kaggle

### "CSV parsing errors"
- Ensure dataset is fully extracted
- Check for CSV files in the folder
- Try manual download if CLI fails

### "No programs imported"
- Check CSV file structure
- Verify dataset path is correct
- Look for error messages in terminal

---

## File Size Expectations

- **Download:** ~100-150 MB (compressed)
- **Extracted:** ~300-500 MB (CSV files)
- **Imported JSON:** ~15-25 MB
- **Memory usage:** ~50-100 MB during import

---

## Alternative: Use Pre-Processed Data

If the Kaggle dataset structure doesn't match, we can:

1. Create a sample dataset with the expected structure
2. Use a different fitness program source
3. Manually curate popular programs

Let me know if you encounter any issues with the dataset format!
