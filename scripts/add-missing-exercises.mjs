/**
 * Add Missing Popular Exercises
 *
 * This script adds commonly missing popular exercises to the database.
 * Each exercise includes proper metadata and aliases for searchability.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exercisesPath = path.join(__dirname, '../data/exercises-v2.9.json');

// Missing exercises to add with complete metadata
const newExercises = [
  // ============================================
  // CORE / ABDOMINALS
  // ============================================
  {
    name: "Cable Rope Crunch",
    aliases: ["Rope Crunch", "Kneeling Rope Crunch", "Cable Crunch with Rope"],
    category: "Bodybuilding",
    equipment: ["Cable Machine", "Rope Attachment"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Abdominals",
      primeMover: "Rectus Abdominis",
      secondary: "Obliques",
      tertiary: "Hip Flexors"
    },
    movementPatterns: ["Spinal Flexion"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Kneeling Cable Crunch",
    aliases: ["Cable Crunch", "High Pulley Crunch"],
    category: "Bodybuilding",
    equipment: ["Cable Machine"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Abdominals",
      primeMover: "Rectus Abdominis",
      secondary: "Obliques",
      tertiary: "Serratus Anterior"
    },
    movementPatterns: ["Spinal Flexion"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Standing Cable Crunch",
    aliases: ["Standing Ab Crunch", "High Cable Crunch"],
    category: "Bodybuilding",
    equipment: ["Cable Machine"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Abdominals",
      primeMover: "Rectus Abdominis",
      secondary: "Obliques",
      tertiary: "Hip Flexors"
    },
    movementPatterns: ["Spinal Flexion"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Decline Crunch",
    aliases: ["Decline Sit Up", "Decline Ab Crunch"],
    category: "Bodybuilding",
    equipment: ["Decline Bench"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Abdominals",
      primeMover: "Rectus Abdominis",
      secondary: "Obliques",
      tertiary: "Hip Flexors"
    },
    movementPatterns: ["Spinal Flexion"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Captain's Chair Leg Raise",
    aliases: ["Vertical Knee Raise", "Captain Chair", "Hanging Knee Raise Station"],
    category: "Bodybuilding",
    equipment: ["Captain's Chair"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Abdominals",
      primeMover: "Rectus Abdominis",
      secondary: "Hip Flexors",
      tertiary: "Obliques"
    },
    movementPatterns: ["Hip Flexion"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Toe Touch Crunch",
    aliases: ["Toe Touch", "Vertical Toe Touch", "Lying Toe Touch"],
    category: "Bodybuilding",
    equipment: ["Bodyweight"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Abdominals",
      primeMover: "Rectus Abdominis",
      secondary: "Obliques",
      tertiary: "Hip Flexors"
    },
    movementPatterns: ["Spinal Flexion"],
    planesOfMotion: ["Sagittal Plane"]
  },

  // ============================================
  // LEGS - QUADRICEPS
  // ============================================
  {
    name: "Leg Extension Machine",
    aliases: ["Seated Leg Extension", "Leg Extension", "Quad Extension"],
    category: "Bodybuilding",
    equipment: ["Leg Extension Machine"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Quadriceps",
      primeMover: "Rectus Femoris",
      secondary: "Vastus Lateralis",
      tertiary: "Vastus Medialis"
    },
    movementPatterns: ["Knee Extension"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Hack Squat Machine",
    aliases: ["Hack Squat", "Machine Hack Squat", "Sled Hack Squat"],
    category: "Strength",
    equipment: ["Hack Squat Machine"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Quadriceps",
      primeMover: "Vastus Lateralis",
      secondary: "Gluteus Maximus",
      tertiary: "Hamstrings"
    },
    movementPatterns: ["Squat"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Leg Press Machine",
    aliases: ["Leg Press", "45 Degree Leg Press", "Horizontal Leg Press", "Vertical Leg Press"],
    category: "Strength",
    equipment: ["Leg Press Machine"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Quadriceps",
      primeMover: "Vastus Lateralis",
      secondary: "Gluteus Maximus",
      tertiary: "Hamstrings"
    },
    movementPatterns: ["Knee Extension", "Hip Extension"],
    planesOfMotion: ["Sagittal Plane"]
  },

  // ============================================
  // LEGS - HAMSTRINGS
  // ============================================
  {
    name: "Lying Leg Curl Machine",
    aliases: ["Lying Leg Curl", "Prone Leg Curl", "Leg Curl Machine"],
    category: "Bodybuilding",
    equipment: ["Leg Curl Machine"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Hamstrings",
      primeMover: "Biceps Femoris",
      secondary: "Semitendinosus",
      tertiary: "Semimembranosus"
    },
    movementPatterns: ["Knee Flexion"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Seated Leg Curl Machine",
    aliases: ["Seated Leg Curl", "Seated Hamstring Curl"],
    category: "Bodybuilding",
    equipment: ["Seated Leg Curl Machine"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Hamstrings",
      primeMover: "Biceps Femoris",
      secondary: "Semitendinosus",
      tertiary: "Gastrocnemius"
    },
    movementPatterns: ["Knee Flexion"],
    planesOfMotion: ["Sagittal Plane"]
  },

  // ============================================
  // LEGS - GLUTES
  // ============================================
  {
    name: "Hip Thrust Machine",
    aliases: ["Glute Drive", "Machine Hip Thrust"],
    category: "Strength",
    equipment: ["Hip Thrust Machine"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Glutes",
      primeMover: "Gluteus Maximus",
      secondary: "Hamstrings",
      tertiary: "Quadriceps"
    },
    movementPatterns: ["Hip Extension"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Hip Adductor Machine",
    aliases: ["Adductor Machine", "Inner Thigh Machine", "Thigh Adductor"],
    category: "Bodybuilding",
    equipment: ["Adductor Machine"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Adductors",
      primeMover: "Adductor Magnus",
      secondary: "Adductor Longus",
      tertiary: "Gracilis"
    },
    movementPatterns: ["Hip Adduction"],
    planesOfMotion: ["Frontal Plane"]
  },
  {
    name: "Hip Abductor Machine",
    aliases: ["Abductor Machine", "Outer Thigh Machine", "Thigh Abductor"],
    category: "Bodybuilding",
    equipment: ["Abductor Machine"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Abductors",
      primeMover: "Gluteus Medius",
      secondary: "Gluteus Minimus",
      tertiary: "Tensor Fasciae Latae"
    },
    movementPatterns: ["Hip Abduction"],
    planesOfMotion: ["Frontal Plane"]
  },

  // ============================================
  // LEGS - CALVES
  // ============================================
  {
    name: "Standing Calf Raise Machine",
    aliases: ["Machine Calf Raise", "Standing Calf Machine"],
    category: "Bodybuilding",
    equipment: ["Calf Raise Machine"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Calves",
      primeMover: "Gastrocnemius",
      secondary: "Soleus",
      tertiary: "Tibialis Posterior"
    },
    movementPatterns: ["Ankle Plantarflexion"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Seated Calf Raise Machine",
    aliases: ["Seated Calf Raise", "Seated Calf Machine"],
    category: "Bodybuilding",
    equipment: ["Seated Calf Raise Machine"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Calves",
      primeMover: "Soleus",
      secondary: "Gastrocnemius",
      tertiary: "Tibialis Posterior"
    },
    movementPatterns: ["Ankle Plantarflexion"],
    planesOfMotion: ["Sagittal Plane"]
  },

  // ============================================
  // BACK
  // ============================================
  {
    name: "T-Bar Row",
    aliases: ["T Bar Row", "Landmine T-Bar Row", "Corner Row"],
    category: "Strength",
    equipment: ["T-Bar Row Machine", "Barbell"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Rhomboids",
      tertiary: "Biceps"
    },
    movementPatterns: ["Horizontal Pull"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Chest Supported Row",
    aliases: ["Incline Dumbbell Row", "Chest Supported Dumbbell Row", "Seal Row"],
    category: "Bodybuilding",
    equipment: ["Incline Bench", "Dumbbells"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Rhomboids",
      tertiary: "Rear Deltoid"
    },
    movementPatterns: ["Horizontal Pull"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Seal Row",
    aliases: ["Prone Row", "Belly Row"],
    category: "Bodybuilding",
    equipment: ["Elevated Bench", "Barbell"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Rhomboids",
      tertiary: "Trapezius"
    },
    movementPatterns: ["Horizontal Pull"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Yates Row",
    aliases: ["Underhand Barbell Row", "Reverse Grip Barbell Row"],
    category: "Strength",
    equipment: ["Barbell"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Biceps",
      tertiary: "Rhomboids"
    },
    movementPatterns: ["Horizontal Pull"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Helms Row",
    aliases: ["Chest Supported Machine Row"],
    category: "Bodybuilding",
    equipment: ["Incline Bench", "Dumbbells"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Rhomboids",
      tertiary: "Rear Deltoid"
    },
    movementPatterns: ["Horizontal Pull"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Kroc Row",
    aliases: ["Heavy Dumbbell Row", "High Rep Dumbbell Row"],
    category: "Strength",
    equipment: ["Dumbbell", "Bench"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Trapezius",
      tertiary: "Biceps"
    },
    movementPatterns: ["Horizontal Pull"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Lat Pulldown Machine",
    aliases: ["Plate Loaded Lat Pulldown", "Machine Lat Pulldown"],
    category: "Bodybuilding",
    equipment: ["Lat Pulldown Machine"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Biceps",
      tertiary: "Rhomboids"
    },
    movementPatterns: ["Vertical Pull"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Seated Cable Row",
    aliases: ["Low Cable Row", "Seated Row", "Cable Row"],
    category: "Bodybuilding",
    equipment: ["Cable Machine", "V-Bar Handle"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Rhomboids",
      tertiary: "Biceps"
    },
    movementPatterns: ["Horizontal Pull"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Straight Arm Pulldown",
    aliases: ["Cable Straight Arm Pulldown", "Stiff Arm Pulldown", "Lat Pushdown"],
    category: "Bodybuilding",
    equipment: ["Cable Machine", "Straight Bar"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Teres Major",
      tertiary: "Triceps Long Head"
    },
    movementPatterns: ["Shoulder Extension"],
    planesOfMotion: ["Sagittal Plane"]
  },

  // ============================================
  // CHEST
  // ============================================
  {
    name: "Cable Crossover",
    aliases: ["High Cable Crossover", "Cable Fly", "Standing Cable Fly"],
    category: "Bodybuilding",
    equipment: ["Cable Machine"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Chest",
      primeMover: "Pectoralis Major",
      secondary: "Anterior Deltoid",
      tertiary: "Biceps"
    },
    movementPatterns: ["Horizontal Adduction"],
    planesOfMotion: ["Transverse Plane"]
  },
  {
    name: "Low Cable Fly",
    aliases: ["Low to High Cable Fly", "Cable Fly Low"],
    category: "Bodybuilding",
    equipment: ["Cable Machine"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Chest",
      primeMover: "Clavicular Pectoralis",
      secondary: "Anterior Deltoid",
      tertiary: "Biceps"
    },
    movementPatterns: ["Horizontal Adduction"],
    planesOfMotion: ["Transverse Plane"]
  },
  {
    name: "Pec Deck Machine",
    aliases: ["Pec Fly Machine", "Butterfly Machine", "Machine Fly"],
    category: "Bodybuilding",
    equipment: ["Pec Deck Machine"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Chest",
      primeMover: "Pectoralis Major",
      secondary: "Anterior Deltoid",
      tertiary: "Serratus Anterior"
    },
    movementPatterns: ["Horizontal Adduction"],
    planesOfMotion: ["Transverse Plane"]
  },
  {
    name: "Machine Chest Press",
    aliases: ["Chest Press Machine", "Seated Chest Press", "Plate Loaded Chest Press"],
    category: "Strength",
    equipment: ["Chest Press Machine"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Chest",
      primeMover: "Pectoralis Major",
      secondary: "Anterior Deltoid",
      tertiary: "Triceps"
    },
    movementPatterns: ["Horizontal Push"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Smith Machine Bench Press",
    aliases: ["Smith Bench Press", "Smith Machine Flat Press"],
    category: "Strength",
    equipment: ["Smith Machine", "Flat Bench"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Chest",
      primeMover: "Pectoralis Major",
      secondary: "Anterior Deltoid",
      tertiary: "Triceps"
    },
    movementPatterns: ["Horizontal Push"],
    planesOfMotion: ["Sagittal Plane"]
  },

  // ============================================
  // SHOULDERS
  // ============================================
  {
    name: "Rear Delt Fly Machine",
    aliases: ["Reverse Pec Deck", "Machine Rear Delt Fly", "Rear Delt Machine"],
    category: "Bodybuilding",
    equipment: ["Rear Delt Machine"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Posterior Deltoid",
      secondary: "Rhomboids",
      tertiary: "Trapezius"
    },
    movementPatterns: ["Horizontal Abduction"],
    planesOfMotion: ["Transverse Plane"]
  },
  {
    name: "Lateral Raise Machine",
    aliases: ["Machine Lateral Raise", "Shoulder Lateral Machine"],
    category: "Bodybuilding",
    equipment: ["Lateral Raise Machine"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Lateral Deltoid",
      secondary: "Anterior Deltoid",
      tertiary: "Trapezius"
    },
    movementPatterns: ["Shoulder Abduction"],
    planesOfMotion: ["Frontal Plane"]
  },
  {
    name: "Shoulder Press Machine",
    aliases: ["Machine Shoulder Press", "Overhead Press Machine", "Plate Loaded Shoulder Press"],
    category: "Strength",
    equipment: ["Shoulder Press Machine"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Anterior Deltoid",
      secondary: "Lateral Deltoid",
      tertiary: "Triceps"
    },
    movementPatterns: ["Vertical Push"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Smith Machine Shoulder Press",
    aliases: ["Smith Machine Overhead Press", "Smith Press"],
    category: "Strength",
    equipment: ["Smith Machine"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Anterior Deltoid",
      secondary: "Lateral Deltoid",
      tertiary: "Triceps"
    },
    movementPatterns: ["Vertical Push"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Barbell Upright Row",
    aliases: ["Upright Row", "Wide Grip Upright Row"],
    category: "Bodybuilding",
    equipment: ["Barbell"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Lateral Deltoid",
      secondary: "Trapezius",
      tertiary: "Biceps"
    },
    movementPatterns: ["Shoulder Abduction", "Elbow Flexion"],
    planesOfMotion: ["Frontal Plane"]
  },

  // ============================================
  // ARMS - BICEPS
  // ============================================
  {
    name: "Preacher Curl Machine",
    aliases: ["Machine Preacher Curl", "Plate Loaded Preacher Curl"],
    category: "Bodybuilding",
    equipment: ["Preacher Curl Machine"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Biceps",
      primeMover: "Biceps Brachii",
      secondary: "Brachialis",
      tertiary: "Brachioradialis"
    },
    movementPatterns: ["Elbow Flexion"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Cable Bicep Curl",
    aliases: ["Cable Curl", "Standing Cable Curl", "Low Pulley Curl"],
    category: "Bodybuilding",
    equipment: ["Cable Machine", "Straight Bar"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Biceps",
      primeMover: "Biceps Brachii",
      secondary: "Brachialis",
      tertiary: "Brachioradialis"
    },
    movementPatterns: ["Elbow Flexion"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Cable Rope Hammer Curl",
    aliases: ["Rope Hammer Curl", "Cable Hammer Curl"],
    category: "Bodybuilding",
    equipment: ["Cable Machine", "Rope Attachment"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Biceps",
      primeMover: "Brachialis",
      secondary: "Biceps Brachii",
      tertiary: "Brachioradialis"
    },
    movementPatterns: ["Elbow Flexion"],
    planesOfMotion: ["Sagittal Plane"]
  },

  // ============================================
  // ARMS - TRICEPS
  // ============================================
  {
    name: "Cable Overhead Tricep Extension",
    aliases: ["Overhead Cable Extension", "High Pulley Overhead Extension"],
    category: "Bodybuilding",
    equipment: ["Cable Machine", "Rope Attachment"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Triceps",
      primeMover: "Triceps Long Head",
      secondary: "Triceps Lateral Head",
      tertiary: "Triceps Medial Head"
    },
    movementPatterns: ["Elbow Extension"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Assisted Dip Machine",
    aliases: ["Tricep Dip Machine", "Machine Dip", "Dip Assist"],
    category: "Bodybuilding",
    equipment: ["Assisted Dip Machine"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Triceps",
      primeMover: "Triceps Brachii",
      secondary: "Pectoralis Major",
      tertiary: "Anterior Deltoid"
    },
    movementPatterns: ["Elbow Extension", "Shoulder Extension"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "EZ Bar French Press",
    aliases: ["French Press", "Lying EZ Bar Tricep Extension"],
    category: "Bodybuilding",
    equipment: ["EZ Bar", "Flat Bench"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Triceps",
      primeMover: "Triceps Long Head",
      secondary: "Triceps Lateral Head",
      tertiary: "Anconeus"
    },
    movementPatterns: ["Elbow Extension"],
    planesOfMotion: ["Sagittal Plane"]
  },

  // ============================================
  // COMPOUND / FUNCTIONAL
  // ============================================
  {
    name: "Farmer's Walk",
    aliases: ["Farmers Carry", "Farmer Walk", "Loaded Carry"],
    category: "Strength",
    equipment: ["Dumbbells", "Farmer Walk Handles"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Back",
      primeMover: "Trapezius",
      secondary: "Forearms",
      tertiary: "Core"
    },
    movementPatterns: ["Carry"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Sled Push",
    aliases: ["Prowler Push", "Weight Sled Push"],
    category: "Conditioning",
    equipment: ["Sled"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Quadriceps",
      primeMover: "Vastus Lateralis",
      secondary: "Gluteus Maximus",
      tertiary: "Gastrocnemius"
    },
    movementPatterns: ["Locomotion"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Sled Pull",
    aliases: ["Rope Sled Pull", "Backward Sled Drag"],
    category: "Conditioning",
    equipment: ["Sled", "Rope"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Biceps",
      tertiary: "Hamstrings"
    },
    movementPatterns: ["Horizontal Pull", "Locomotion"],
    planesOfMotion: ["Sagittal Plane"]
  },
  {
    name: "Depth Jump",
    aliases: ["Drop Jump", "Shock Jump"],
    category: "Power",
    equipment: ["Plyo Box"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Quadriceps",
      primeMover: "Vastus Lateralis",
      secondary: "Gluteus Maximus",
      tertiary: "Gastrocnemius"
    },
    movementPatterns: ["Plyometric"],
    planesOfMotion: ["Sagittal Plane"]
  }
];

// Read existing exercises
console.log('Reading existing exercises...');
const existingExercises = JSON.parse(fs.readFileSync(exercisesPath, 'utf-8'));
console.log(`Found ${existingExercises.length} existing exercises`);

// Check for duplicates
const existingNames = new Set(existingExercises.map(e => e.name.toLowerCase()));
const exercisesToAdd = newExercises.filter(e => {
  const exists = existingNames.has(e.name.toLowerCase());
  if (exists) {
    console.log(`  Skipping duplicate: ${e.name}`);
  }
  return !exists;
});

console.log(`\nAdding ${exercisesToAdd.length} new exercises...`);

// Merge exercises
const allExercises = [...existingExercises, ...exercisesToAdd];

// Sort alphabetically by name
allExercises.sort((a, b) => a.name.localeCompare(b.name));

// Write back
fs.writeFileSync(exercisesPath, JSON.stringify(allExercises, null, 2));

console.log(`\nSuccess! Database now contains ${allExercises.length} exercises`);
console.log('\nNew exercises added:');
exercisesToAdd.forEach(e => console.log(`  + ${e.name} (aliases: ${e.aliases.join(', ')})`));
