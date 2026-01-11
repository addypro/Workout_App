/**
 * Add Calisthenics / Calistree-style Exercises
 *
 * This script adds all fundamental calisthenics exercises with proper
 * progression/regression relationships in a Calistree-style hierarchy.
 *
 * Categories:
 * - Push Progressions (Wall to Planche)
 * - Pull Progressions (Dead Hang to One-Arm)
 * - Front Lever Progressions
 * - Planche Progressions
 * - Handstand Progressions
 * - Core Progressions
 * - Leg Progressions
 * - Skill Holds (L-Sit, V-Sit, Flags)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exercisesPath = path.join(__dirname, '../data/exercises-v2.9.json');

// ============================================
// CALISTHENICS EXERCISES WITH PROGRESSIONS
// ============================================

const calisthenicsExercises = [
  // ============================================
  // PUSH-UP PROGRESSIONS (Beginner to Expert)
  // ============================================
  {
    name: "Wall Push-Up",
    aliases: ["Wall Pushup", "Standing Push-Up", "Vertical Push-Up"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Chest",
      primeMover: "Pectoralis Major",
      secondary: "Anterior Deltoid",
      tertiary: "Triceps"
    },
    movementPatterns: ["Horizontal Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 1,
    progressesTo: ["Incline Push-Up"],
    regressesFrom: []
  },
  {
    name: "Incline Push-Up",
    aliases: ["Elevated Push-Up", "Bench Push-Up", "Box Push-Up"],
    category: "Calisthenics",
    equipment: ["Bodyweight", "Bench"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Chest",
      primeMover: "Pectoralis Major",
      secondary: "Anterior Deltoid",
      tertiary: "Triceps"
    },
    movementPatterns: ["Horizontal Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 2,
    progressesTo: ["Knee Push-Up", "Standard Push-Up"],
    regressesFrom: ["Wall Push-Up"]
  },
  {
    name: "Knee Push-Up",
    aliases: ["Modified Push-Up", "Box Push-Up", "Three-Quarter Push-Up"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Chest",
      primeMover: "Pectoralis Major",
      secondary: "Anterior Deltoid",
      tertiary: "Triceps"
    },
    movementPatterns: ["Horizontal Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 3,
    progressesTo: ["Standard Push-Up"],
    regressesFrom: ["Incline Push-Up"]
  },
  {
    name: "Standard Push-Up",
    aliases: ["Push-Up", "Pushup", "Regular Push-Up", "Military Push-Up"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Chest",
      primeMover: "Pectoralis Major",
      secondary: "Anterior Deltoid",
      tertiary: "Triceps"
    },
    movementPatterns: ["Horizontal Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 4,
    progressesTo: ["Diamond Push-Up", "Wide Push-Up", "Decline Push-Up"],
    regressesFrom: ["Knee Push-Up", "Incline Push-Up"]
  },
  {
    name: "Wide Push-Up",
    aliases: ["Wide Grip Push-Up", "Wide Stance Push-Up"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Chest",
      primeMover: "Pectoralis Major",
      secondary: "Serratus Anterior",
      tertiary: "Anterior Deltoid"
    },
    movementPatterns: ["Horizontal Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 4,
    progressesTo: ["Archer Push-Up"],
    regressesFrom: ["Standard Push-Up"]
  },
  {
    name: "Diamond Push-Up",
    aliases: ["Triangle Push-Up", "Close Grip Push-Up", "Tricep Push-Up"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Triceps",
      primeMover: "Triceps Brachii",
      secondary: "Pectoralis Major",
      tertiary: "Anterior Deltoid"
    },
    movementPatterns: ["Horizontal Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 5,
    progressesTo: ["Pseudo Planche Push-Up", "Archer Push-Up"],
    regressesFrom: ["Standard Push-Up"]
  },
  {
    name: "Decline Push-Up",
    aliases: ["Feet Elevated Push-Up", "Elevated Feet Push-Up"],
    category: "Calisthenics",
    equipment: ["Bodyweight", "Bench"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Chest",
      primeMover: "Clavicular Pectoralis",
      secondary: "Anterior Deltoid",
      tertiary: "Triceps"
    },
    movementPatterns: ["Horizontal Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 5,
    progressesTo: ["Pike Push-Up"],
    regressesFrom: ["Standard Push-Up"]
  },
  {
    name: "Pike Push-Up",
    aliases: ["Pike Press", "Downward Dog Push-Up"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Anterior Deltoid",
      secondary: "Triceps",
      tertiary: "Upper Pectoralis"
    },
    movementPatterns: ["Vertical Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 5,
    progressesTo: ["Elevated Pike Push-Up", "Wall Handstand Push-Up"],
    regressesFrom: ["Decline Push-Up"]
  },
  {
    name: "Elevated Pike Push-Up",
    aliases: ["Box Pike Push-Up", "Feet Elevated Pike Push-Up"],
    category: "Calisthenics",
    equipment: ["Bodyweight", "Box"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Anterior Deltoid",
      secondary: "Triceps",
      tertiary: "Upper Trapezius"
    },
    movementPatterns: ["Vertical Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 6,
    progressesTo: ["Wall Handstand Push-Up"],
    regressesFrom: ["Pike Push-Up"]
  },
  {
    name: "Archer Push-Up",
    aliases: ["Side to Side Push-Up", "Typewriter Push-Up"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Chest",
      primeMover: "Pectoralis Major",
      secondary: "Triceps",
      tertiary: "Core"
    },
    movementPatterns: ["Horizontal Push"],
    planesOfMotion: ["Sagittal Plane", "Transverse Plane"],
    progressionLevel: 6,
    progressesTo: ["One-Arm Push-Up Negative", "One-Arm Push-Up"],
    regressesFrom: ["Diamond Push-Up", "Wide Push-Up"]
  },
  {
    name: "Pseudo Planche Push-Up",
    aliases: ["Lean Forward Push-Up", "Planche Lean Push-Up", "PPPU"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Chest",
      primeMover: "Pectoralis Major",
      secondary: "Anterior Deltoid",
      tertiary: "Serratus Anterior"
    },
    movementPatterns: ["Horizontal Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 6,
    progressesTo: ["Tuck Planche Push-Up"],
    regressesFrom: ["Diamond Push-Up"]
  },
  {
    name: "One-Arm Push-Up Negative",
    aliases: ["Eccentric One-Arm Push-Up", "Negative One-Arm Pushup"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Chest",
      primeMover: "Pectoralis Major",
      secondary: "Triceps",
      tertiary: "Core"
    },
    movementPatterns: ["Horizontal Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 7,
    progressesTo: ["One-Arm Push-Up"],
    regressesFrom: ["Archer Push-Up"]
  },
  {
    name: "One-Arm Push-Up",
    aliases: ["Single Arm Push-Up", "OAP"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Chest",
      primeMover: "Pectoralis Major",
      secondary: "Triceps",
      tertiary: "Core"
    },
    movementPatterns: ["Horizontal Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 8,
    progressesTo: [],
    regressesFrom: ["One-Arm Push-Up Negative", "Archer Push-Up"]
  },

  // ============================================
  // PULL-UP PROGRESSIONS
  // ============================================
  {
    name: "Dead Hang",
    aliases: ["Passive Hang", "Bar Hang", "Hanging"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Forearms",
      primeMover: "Grip Muscles",
      secondary: "Latissimus Dorsi",
      tertiary: "Shoulders"
    },
    movementPatterns: ["Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 1,
    progressesTo: ["Active Hang", "Scapular Pull-Up"],
    regressesFrom: []
  },
  {
    name: "Active Hang",
    aliases: ["Scapular Hang", "Engaged Hang"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Back",
      primeMover: "Lower Trapezius",
      secondary: "Latissimus Dorsi",
      tertiary: "Rhomboids"
    },
    movementPatterns: ["Scapular Retraction"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 2,
    progressesTo: ["Scapular Pull-Up"],
    regressesFrom: ["Dead Hang"]
  },
  {
    name: "Scapular Pull-Up",
    aliases: ["Scap Pull", "Scapula Shrug"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Back",
      primeMover: "Lower Trapezius",
      secondary: "Rhomboids",
      tertiary: "Latissimus Dorsi"
    },
    movementPatterns: ["Scapular Depression"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 2,
    progressesTo: ["Assisted Pull-Up", "Band Assisted Pull-Up"],
    regressesFrom: ["Dead Hang", "Active Hang"]
  },
  {
    name: "Band Assisted Pull-Up",
    aliases: ["Resistance Band Pull-Up", "Banded Pull-Up"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar", "Resistance Band"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Biceps",
      tertiary: "Rhomboids"
    },
    movementPatterns: ["Vertical Pull"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 3,
    progressesTo: ["Negative Pull-Up", "Chin-Up"],
    regressesFrom: ["Scapular Pull-Up"]
  },
  {
    name: "Assisted Pull-Up",
    aliases: ["Machine Assisted Pull-Up", "Gravitron Pull-Up"],
    category: "Calisthenics",
    equipment: ["Assisted Pull-Up Machine"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Biceps",
      tertiary: "Rhomboids"
    },
    movementPatterns: ["Vertical Pull"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 3,
    progressesTo: ["Negative Pull-Up", "Chin-Up"],
    regressesFrom: ["Scapular Pull-Up"]
  },
  {
    name: "Negative Pull-Up",
    aliases: ["Eccentric Pull-Up", "Slow Negative Pull-Up"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Biceps",
      tertiary: "Brachialis"
    },
    movementPatterns: ["Vertical Pull"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 4,
    progressesTo: ["Chin-Up", "Pull-Up"],
    regressesFrom: ["Band Assisted Pull-Up"]
  },
  {
    name: "Chin-Up",
    aliases: ["Chinup", "Underhand Pull-Up", "Supinated Pull-Up"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Biceps Brachii",
      tertiary: "Brachialis"
    },
    movementPatterns: ["Vertical Pull"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 5,
    progressesTo: ["Pull-Up", "Close Grip Chin-Up"],
    regressesFrom: ["Negative Pull-Up", "Band Assisted Pull-Up"]
  },
  {
    name: "Pull-Up",
    aliases: ["Pullup", "Overhand Pull-Up", "Pronated Pull-Up"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Biceps",
      tertiary: "Teres Major"
    },
    movementPatterns: ["Vertical Pull"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 5,
    progressesTo: ["Chest-to-Bar Pull-Up", "Wide Grip Pull-Up", "L-Sit Pull-Up"],
    regressesFrom: ["Chin-Up", "Negative Pull-Up"]
  },
  {
    name: "Wide Grip Pull-Up",
    aliases: ["Wide Pull-Up", "Lat Pull-Up"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Teres Major",
      tertiary: "Rhomboids"
    },
    movementPatterns: ["Vertical Pull"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 6,
    progressesTo: ["Archer Pull-Up"],
    regressesFrom: ["Pull-Up"]
  },
  {
    name: "Close Grip Chin-Up",
    aliases: ["Narrow Chin-Up", "Close Grip Pull-Up"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Biceps Brachii",
      tertiary: "Brachialis"
    },
    movementPatterns: ["Vertical Pull"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 6,
    progressesTo: ["Towel Pull-Up", "One-Arm Chin-Up"],
    regressesFrom: ["Chin-Up"]
  },
  {
    name: "Chest-to-Bar Pull-Up",
    aliases: ["CTB Pull-Up", "High Pull-Up", "Sternum Pull-Up"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Rhomboids",
      tertiary: "Lower Trapezius"
    },
    movementPatterns: ["Vertical Pull"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 6,
    progressesTo: ["Muscle-Up Transition", "Explosive Pull-Up"],
    regressesFrom: ["Pull-Up"]
  },
  {
    name: "L-Sit Pull-Up",
    aliases: ["L Pull-Up", "L-Shape Pull-Up"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Hip Flexors",
      tertiary: "Rectus Abdominis"
    },
    movementPatterns: ["Vertical Pull"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 6,
    progressesTo: ["Archer Pull-Up"],
    regressesFrom: ["Pull-Up"]
  },
  {
    name: "Archer Pull-Up",
    aliases: ["Side-to-Side Pull-Up", "Unilateral Pull-Up"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Biceps",
      tertiary: "Core"
    },
    movementPatterns: ["Vertical Pull"],
    planesOfMotion: ["Sagittal Plane", "Frontal Plane"],
    progressionLevel: 7,
    progressesTo: ["One-Arm Pull-Up Negative", "One-Arm Pull-Up"],
    regressesFrom: ["Wide Grip Pull-Up", "L-Sit Pull-Up"]
  },
  {
    name: "Towel Pull-Up",
    aliases: ["Grip Pull-Up", "Towel Grip Pull-Up"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar", "Towel"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Grip Muscles",
      tertiary: "Biceps"
    },
    movementPatterns: ["Vertical Pull"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 7,
    progressesTo: ["One-Arm Pull-Up"],
    regressesFrom: ["Close Grip Chin-Up"]
  },
  {
    name: "Typewriter Pull-Up",
    aliases: ["Sliding Pull-Up", "Horizontal Pull-Up Slide"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Biceps",
      tertiary: "Core"
    },
    movementPatterns: ["Vertical Pull"],
    planesOfMotion: ["Sagittal Plane", "Frontal Plane"],
    progressionLevel: 7,
    progressesTo: ["One-Arm Pull-Up"],
    regressesFrom: ["Archer Pull-Up"]
  },
  {
    name: "One-Arm Pull-Up Negative",
    aliases: ["Eccentric One-Arm Pull-Up", "OAP Negative"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Biceps",
      tertiary: "Core"
    },
    movementPatterns: ["Vertical Pull"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 8,
    progressesTo: ["One-Arm Pull-Up"],
    regressesFrom: ["Archer Pull-Up"]
  },
  {
    name: "One-Arm Pull-Up",
    aliases: ["Single Arm Pull-Up", "OAP", "1-Arm Pull-Up"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Expert",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Biceps",
      tertiary: "Core"
    },
    movementPatterns: ["Vertical Pull"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 9,
    progressesTo: [],
    regressesFrom: ["One-Arm Pull-Up Negative", "Archer Pull-Up", "Towel Pull-Up"]
  },
  {
    name: "One-Arm Chin-Up",
    aliases: ["Single Arm Chin-Up", "OAC", "1-Arm Chin-Up"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Expert",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Biceps Brachii",
      tertiary: "Brachialis"
    },
    movementPatterns: ["Vertical Pull"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 9,
    progressesTo: [],
    regressesFrom: ["Close Grip Chin-Up", "Archer Pull-Up"]
  },

  // ============================================
  // MUSCLE-UP PROGRESSIONS
  // ============================================
  {
    name: "Explosive Pull-Up",
    aliases: ["High Pull", "Power Pull-Up", "Clapping Pull-Up"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Biceps",
      tertiary: "Core"
    },
    movementPatterns: ["Vertical Pull", "Plyometric"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 6,
    progressesTo: ["Muscle-Up Transition"],
    regressesFrom: ["Chest-to-Bar Pull-Up"]
  },
  {
    name: "Muscle-Up Transition",
    aliases: ["Low Bar Muscle-Up", "Transition Practice"],
    category: "Calisthenics",
    equipment: ["Low Bar"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Triceps",
      tertiary: "Pectoralis Major"
    },
    movementPatterns: ["Vertical Pull", "Horizontal Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 7,
    progressesTo: ["Kipping Muscle-Up"],
    regressesFrom: ["Chest-to-Bar Pull-Up", "Explosive Pull-Up"]
  },
  {
    name: "Kipping Muscle-Up",
    aliases: ["Swinging Muscle-Up", "Momentum Muscle-Up"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Triceps",
      tertiary: "Pectoralis Major"
    },
    movementPatterns: ["Vertical Pull", "Horizontal Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 7,
    progressesTo: ["Bar Muscle-Up"],
    regressesFrom: ["Muscle-Up Transition"]
  },
  {
    name: "Bar Muscle-Up",
    aliases: ["Strict Muscle-Up", "Muscle-Up", "MU"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Triceps",
      tertiary: "Pectoralis Major"
    },
    movementPatterns: ["Vertical Pull", "Vertical Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 8,
    progressesTo: ["Ring Muscle-Up", "Slow Muscle-Up"],
    regressesFrom: ["Kipping Muscle-Up"]
  },
  {
    name: "Ring Muscle-Up",
    aliases: ["Rings Muscle-Up", "Gymnastic Muscle-Up"],
    category: "Calisthenics",
    equipment: ["Gymnastic Rings"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Triceps",
      tertiary: "Pectoralis Major"
    },
    movementPatterns: ["Vertical Pull", "Vertical Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 8,
    progressesTo: ["Slow Muscle-Up"],
    regressesFrom: ["Bar Muscle-Up"]
  },
  {
    name: "Slow Muscle-Up",
    aliases: ["Strict Ring Muscle-Up", "Controlled Muscle-Up"],
    category: "Calisthenics",
    equipment: ["Gymnastic Rings"],
    difficulty: "Expert",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Triceps",
      tertiary: "Pectoralis Major"
    },
    movementPatterns: ["Vertical Pull", "Vertical Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 9,
    progressesTo: [],
    regressesFrom: ["Ring Muscle-Up", "Bar Muscle-Up"]
  },

  // ============================================
  // FRONT LEVER PROGRESSIONS
  // ============================================
  {
    name: "Tuck Front Lever",
    aliases: ["Tucked Front Lever", "Front Lever Tuck"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Core",
      tertiary: "Biceps"
    },
    movementPatterns: ["Horizontal Pull", "Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 5,
    progressesTo: ["Advanced Tuck Front Lever"],
    regressesFrom: ["Pull-Up"]
  },
  {
    name: "Advanced Tuck Front Lever",
    aliases: ["Open Tuck Front Lever", "Adv Tuck FL"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Core",
      tertiary: "Biceps"
    },
    movementPatterns: ["Horizontal Pull", "Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 6,
    progressesTo: ["One-Leg Front Lever"],
    regressesFrom: ["Tuck Front Lever"]
  },
  {
    name: "One-Leg Front Lever",
    aliases: ["Single Leg Front Lever", "Half Lay Front Lever"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Core",
      tertiary: "Hip Flexors"
    },
    movementPatterns: ["Horizontal Pull", "Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 7,
    progressesTo: ["Straddle Front Lever"],
    regressesFrom: ["Advanced Tuck Front Lever"]
  },
  {
    name: "Straddle Front Lever",
    aliases: ["Straddled Front Lever", "Wide Front Lever"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Core",
      tertiary: "Adductors"
    },
    movementPatterns: ["Horizontal Pull", "Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 8,
    progressesTo: ["Full Front Lever"],
    regressesFrom: ["One-Leg Front Lever"]
  },
  {
    name: "Full Front Lever",
    aliases: ["Front Lever", "Complete Front Lever", "FL"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Expert",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Core",
      tertiary: "Biceps"
    },
    movementPatterns: ["Horizontal Pull", "Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 9,
    progressesTo: ["Front Lever Pull-Up"],
    regressesFrom: ["Straddle Front Lever"]
  },
  {
    name: "Front Lever Pull-Up",
    aliases: ["Front Lever Row", "FL Pull", "Front Lever Pulls"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Expert",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Core",
      tertiary: "Biceps"
    },
    movementPatterns: ["Horizontal Pull"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 10,
    progressesTo: [],
    regressesFrom: ["Full Front Lever"]
  },
  {
    name: "Front Lever Raise",
    aliases: ["Front Lever Negative", "FL Raise"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Expert",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Core",
      tertiary: "Biceps"
    },
    movementPatterns: ["Horizontal Pull"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 9,
    progressesTo: ["Front Lever Pull-Up"],
    regressesFrom: ["Full Front Lever"]
  },

  // ============================================
  // BACK LEVER PROGRESSIONS
  // ============================================
  {
    name: "Skin The Cat",
    aliases: ["German Hang", "Shoulder Dislocate"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar", "Gymnastic Rings"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Posterior Deltoid",
      secondary: "Latissimus Dorsi",
      tertiary: "Biceps"
    },
    movementPatterns: ["Shoulder Rotation"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 5,
    progressesTo: ["Tuck Back Lever"],
    regressesFrom: ["Pull-Up"]
  },
  {
    name: "Tuck Back Lever",
    aliases: ["Tucked Back Lever", "Back Lever Tuck"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar", "Gymnastic Rings"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Rear Deltoid",
      tertiary: "Biceps"
    },
    movementPatterns: ["Horizontal Pull", "Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 6,
    progressesTo: ["Advanced Tuck Back Lever"],
    regressesFrom: ["Skin The Cat"]
  },
  {
    name: "Advanced Tuck Back Lever",
    aliases: ["Open Tuck Back Lever"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar", "Gymnastic Rings"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Rear Deltoid",
      tertiary: "Biceps"
    },
    movementPatterns: ["Horizontal Pull", "Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 6,
    progressesTo: ["Straddle Back Lever"],
    regressesFrom: ["Tuck Back Lever"]
  },
  {
    name: "Straddle Back Lever",
    aliases: ["Straddled Back Lever"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar", "Gymnastic Rings"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Rear Deltoid",
      tertiary: "Core"
    },
    movementPatterns: ["Horizontal Pull", "Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 7,
    progressesTo: ["Full Back Lever"],
    regressesFrom: ["Advanced Tuck Back Lever"]
  },
  {
    name: "Full Back Lever",
    aliases: ["Back Lever", "Complete Back Lever", "BL"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar", "Gymnastic Rings"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Rear Deltoid",
      tertiary: "Biceps"
    },
    movementPatterns: ["Horizontal Pull", "Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 8,
    progressesTo: ["Back Lever Pull-Up"],
    regressesFrom: ["Straddle Back Lever"]
  },
  {
    name: "Back Lever Pull-Up",
    aliases: ["Back Lever Pulls", "BL Pull"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar", "Gymnastic Rings"],
    difficulty: "Expert",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Rear Deltoid",
      tertiary: "Biceps"
    },
    movementPatterns: ["Horizontal Pull"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 9,
    progressesTo: [],
    regressesFrom: ["Full Back Lever"]
  },

  // ============================================
  // PLANCHE PROGRESSIONS
  // ============================================
  {
    name: "Planche Lean",
    aliases: ["Forward Lean", "Leaning Plank"],
    category: "Calisthenics",
    equipment: ["Bodyweight", "Parallettes"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Anterior Deltoid",
      secondary: "Pectoralis Major",
      tertiary: "Core"
    },
    movementPatterns: ["Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 3,
    progressesTo: ["Frog Stand"],
    regressesFrom: ["Plank Hold"]
  },
  {
    name: "Frog Stand",
    aliases: ["Crow Pose", "Frog Pose", "Bakasana"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Anterior Deltoid",
      secondary: "Triceps",
      tertiary: "Core"
    },
    movementPatterns: ["Isometric Hold", "Balance"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 4,
    progressesTo: ["Tuck Planche"],
    regressesFrom: ["Planche Lean"]
  },
  {
    name: "Tuck Planche",
    aliases: ["Tucked Planche", "Planche Tuck"],
    category: "Calisthenics",
    equipment: ["Parallettes", "Bodyweight"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Anterior Deltoid",
      secondary: "Pectoralis Major",
      tertiary: "Core"
    },
    movementPatterns: ["Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 5,
    progressesTo: ["Advanced Tuck Planche"],
    regressesFrom: ["Frog Stand"]
  },
  {
    name: "Advanced Tuck Planche",
    aliases: ["Open Tuck Planche", "Flat Back Tuck Planche"],
    category: "Calisthenics",
    equipment: ["Parallettes", "Bodyweight"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Anterior Deltoid",
      secondary: "Pectoralis Major",
      tertiary: "Core"
    },
    movementPatterns: ["Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 6,
    progressesTo: ["Straddle Planche"],
    regressesFrom: ["Tuck Planche"]
  },
  {
    name: "Straddle Planche",
    aliases: ["Straddled Planche", "Wide Planche"],
    category: "Calisthenics",
    equipment: ["Parallettes", "Bodyweight"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Anterior Deltoid",
      secondary: "Pectoralis Major",
      tertiary: "Core"
    },
    movementPatterns: ["Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 8,
    progressesTo: ["Full Planche"],
    regressesFrom: ["Advanced Tuck Planche"]
  },
  {
    name: "Full Planche",
    aliases: ["Planche", "Complete Planche", "Straight Planche"],
    category: "Calisthenics",
    equipment: ["Parallettes", "Bodyweight"],
    difficulty: "Expert",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Anterior Deltoid",
      secondary: "Pectoralis Major",
      tertiary: "Core"
    },
    movementPatterns: ["Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 10,
    progressesTo: ["Planche Push-Up"],
    regressesFrom: ["Straddle Planche"]
  },
  {
    name: "Tuck Planche Push-Up",
    aliases: ["Tucked Planche Push-Up", "TPP"],
    category: "Calisthenics",
    equipment: ["Parallettes", "Bodyweight"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Anterior Deltoid",
      secondary: "Pectoralis Major",
      tertiary: "Triceps"
    },
    movementPatterns: ["Horizontal Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 7,
    progressesTo: ["Straddle Planche Push-Up"],
    regressesFrom: ["Pseudo Planche Push-Up"]
  },
  {
    name: "Straddle Planche Push-Up",
    aliases: ["Straddled Planche Push-Up"],
    category: "Calisthenics",
    equipment: ["Parallettes", "Bodyweight"],
    difficulty: "Expert",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Anterior Deltoid",
      secondary: "Pectoralis Major",
      tertiary: "Triceps"
    },
    movementPatterns: ["Horizontal Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 9,
    progressesTo: ["Planche Push-Up"],
    regressesFrom: ["Tuck Planche Push-Up"]
  },
  {
    name: "Planche Push-Up",
    aliases: ["Full Planche Push-Up", "PPU"],
    category: "Calisthenics",
    equipment: ["Parallettes", "Bodyweight"],
    difficulty: "Expert",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Anterior Deltoid",
      secondary: "Pectoralis Major",
      tertiary: "Triceps"
    },
    movementPatterns: ["Horizontal Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 10,
    progressesTo: [],
    regressesFrom: ["Straddle Planche Push-Up", "Full Planche"]
  },

  // ============================================
  // HANDSTAND PROGRESSIONS
  // ============================================
  {
    name: "Wall Plank",
    aliases: ["Wall Walk", "Incline Wall Hold"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Anterior Deltoid",
      secondary: "Triceps",
      tertiary: "Core"
    },
    movementPatterns: ["Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 2,
    progressesTo: ["Wall Handstand"],
    regressesFrom: ["Plank Hold"]
  },
  {
    name: "Wall Handstand",
    aliases: ["Belly to Wall Handstand", "Chest to Wall Handstand"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Anterior Deltoid",
      secondary: "Triceps",
      tertiary: "Core"
    },
    movementPatterns: ["Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 4,
    progressesTo: ["Wall Handstand Heel Pulls", "Back to Wall Handstand"],
    regressesFrom: ["Wall Plank"]
  },
  {
    name: "Back to Wall Handstand",
    aliases: ["Kick-Up Handstand", "Wall-Assisted Handstand"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Anterior Deltoid",
      secondary: "Triceps",
      tertiary: "Core"
    },
    movementPatterns: ["Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 5,
    progressesTo: ["Freestanding Handstand"],
    regressesFrom: ["Wall Handstand"]
  },
  {
    name: "Wall Handstand Heel Pulls",
    aliases: ["Heel Taps", "Handstand Balance Drill"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Anterior Deltoid",
      secondary: "Core",
      tertiary: "Triceps"
    },
    movementPatterns: ["Isometric Hold", "Balance"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 5,
    progressesTo: ["Freestanding Handstand"],
    regressesFrom: ["Wall Handstand"]
  },
  {
    name: "Freestanding Handstand",
    aliases: ["Handstand", "Free Handstand", "HS"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Anterior Deltoid",
      secondary: "Triceps",
      tertiary: "Core"
    },
    movementPatterns: ["Isometric Hold", "Balance"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 6,
    progressesTo: ["Handstand Walk", "Straddle Press to Handstand", "Wall Handstand Push-Up"],
    regressesFrom: ["Back to Wall Handstand", "Wall Handstand Heel Pulls"]
  },
  {
    name: "Handstand Walk",
    aliases: ["Walking Handstand", "Handstand Walking"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Anterior Deltoid",
      secondary: "Core",
      tertiary: "Triceps"
    },
    movementPatterns: ["Locomotion", "Balance"],
    planesOfMotion: ["Sagittal Plane", "Frontal Plane"],
    progressionLevel: 7,
    progressesTo: [],
    regressesFrom: ["Freestanding Handstand"]
  },
  {
    name: "Wall Handstand Push-Up",
    aliases: ["Wall HSPU", "Supported Handstand Push-Up"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Anterior Deltoid",
      secondary: "Triceps",
      tertiary: "Upper Pectoralis"
    },
    movementPatterns: ["Vertical Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 7,
    progressesTo: ["Freestanding Handstand Push-Up"],
    regressesFrom: ["Elevated Pike Push-Up", "Freestanding Handstand"]
  },
  {
    name: "Freestanding Handstand Push-Up",
    aliases: ["Handstand Push-Up", "HSPU", "Free HSPU"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Expert",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Anterior Deltoid",
      secondary: "Triceps",
      tertiary: "Upper Pectoralis"
    },
    movementPatterns: ["Vertical Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 9,
    progressesTo: ["90 Degree Push-Up"],
    regressesFrom: ["Wall Handstand Push-Up"]
  },
  {
    name: "90 Degree Push-Up",
    aliases: ["Ninety Degree Push-Up", "90° Push-Up"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Expert",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Anterior Deltoid",
      secondary: "Triceps",
      tertiary: "Pectoralis Major"
    },
    movementPatterns: ["Vertical Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 10,
    progressesTo: [],
    regressesFrom: ["Freestanding Handstand Push-Up"]
  },
  {
    name: "Straddle Press to Handstand",
    aliases: ["Straddle Press", "Press Handstand Straddle"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Anterior Deltoid",
      secondary: "Hip Flexors",
      tertiary: "Core"
    },
    movementPatterns: ["Vertical Push", "Hip Flexion"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 8,
    progressesTo: ["Pike Press to Handstand"],
    regressesFrom: ["Freestanding Handstand"]
  },
  {
    name: "Pike Press to Handstand",
    aliases: ["Pike Press", "Press Handstand Pike"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Expert",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Anterior Deltoid",
      secondary: "Hip Flexors",
      tertiary: "Core"
    },
    movementPatterns: ["Vertical Push", "Hip Flexion"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 9,
    progressesTo: [],
    regressesFrom: ["Straddle Press to Handstand"]
  },

  // ============================================
  // DIP PROGRESSIONS
  // ============================================
  {
    name: "Bench Dip",
    aliases: ["Chair Dip", "Tricep Bench Dip"],
    category: "Calisthenics",
    equipment: ["Bench"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Triceps",
      primeMover: "Triceps Brachii",
      secondary: "Anterior Deltoid",
      tertiary: "Pectoralis Major"
    },
    movementPatterns: ["Vertical Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 2,
    progressesTo: ["Assisted Dip"],
    regressesFrom: []
  },
  {
    name: "Assisted Dip",
    aliases: ["Band Assisted Dip", "Machine Dip"],
    category: "Calisthenics",
    equipment: ["Dip Station", "Resistance Band"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Triceps",
      primeMover: "Triceps Brachii",
      secondary: "Pectoralis Major",
      tertiary: "Anterior Deltoid"
    },
    movementPatterns: ["Vertical Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 3,
    progressesTo: ["Parallel Bar Dip"],
    regressesFrom: ["Bench Dip"]
  },
  {
    name: "Parallel Bar Dip",
    aliases: ["Dip", "Parallel Dip", "Tricep Dip"],
    category: "Calisthenics",
    equipment: ["Dip Station"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Triceps",
      primeMover: "Triceps Brachii",
      secondary: "Pectoralis Major",
      tertiary: "Anterior Deltoid"
    },
    movementPatterns: ["Vertical Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 5,
    progressesTo: ["Ring Dip", "Weighted Dip", "L-Sit Dip"],
    regressesFrom: ["Assisted Dip"]
  },
  {
    name: "Ring Dip",
    aliases: ["Gymnastics Ring Dip", "Rings Dip"],
    category: "Calisthenics",
    equipment: ["Gymnastic Rings"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Triceps",
      primeMover: "Triceps Brachii",
      secondary: "Pectoralis Major",
      tertiary: "Core"
    },
    movementPatterns: ["Vertical Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 6,
    progressesTo: ["Ring Support Hold", "Bulgarian Ring Dip"],
    regressesFrom: ["Parallel Bar Dip"]
  },
  {
    name: "L-Sit Dip",
    aliases: ["L Dip", "L-Shape Dip"],
    category: "Calisthenics",
    equipment: ["Dip Station"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Triceps",
      primeMover: "Triceps Brachii",
      secondary: "Hip Flexors",
      tertiary: "Core"
    },
    movementPatterns: ["Vertical Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 6,
    progressesTo: ["V-Sit Dip"],
    regressesFrom: ["Parallel Bar Dip"]
  },
  {
    name: "Bulgarian Ring Dip",
    aliases: ["Bulgarian Dip", "RTO Dip"],
    category: "Calisthenics",
    equipment: ["Gymnastic Rings"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Triceps",
      primeMover: "Triceps Brachii",
      secondary: "Pectoralis Major",
      tertiary: "Anterior Deltoid"
    },
    movementPatterns: ["Vertical Push"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 8,
    progressesTo: [],
    regressesFrom: ["Ring Dip"]
  },
  {
    name: "Ring Support Hold",
    aliases: ["Support Hold", "Ring Static Hold", "RTO Support"],
    category: "Calisthenics",
    equipment: ["Gymnastic Rings"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Triceps",
      primeMover: "Triceps Brachii",
      secondary: "Pectoralis Major",
      tertiary: "Core"
    },
    movementPatterns: ["Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 5,
    progressesTo: ["Ring Dip", "L-Sit Ring Support"],
    regressesFrom: ["Ring Dip"]
  },
  {
    name: "L-Sit Ring Support",
    aliases: ["L-Sit on Rings", "Ring L-Sit Support"],
    category: "Calisthenics",
    equipment: ["Gymnastic Rings"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Core",
      primeMover: "Hip Flexors",
      secondary: "Triceps",
      tertiary: "Rectus Abdominis"
    },
    movementPatterns: ["Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 7,
    progressesTo: ["V-Sit Ring Support"],
    regressesFrom: ["Ring Support Hold", "L-Sit"]
  },

  // ============================================
  // CORE / L-SIT PROGRESSIONS
  // ============================================
  {
    name: "Hollow Body Hold",
    aliases: ["Hollow Hold", "Hollow Position"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Core",
      primeMover: "Rectus Abdominis",
      secondary: "Hip Flexors",
      tertiary: "Transverse Abdominis"
    },
    movementPatterns: ["Anti-Extension", "Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 2,
    progressesTo: ["Hollow Body Rock", "Tuck L-Sit"],
    regressesFrom: ["Plank Hold"]
  },
  {
    name: "Hollow Body Rock",
    aliases: ["Hollow Rock", "Hollow Rocks"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Core",
      primeMover: "Rectus Abdominis",
      secondary: "Hip Flexors",
      tertiary: "Transverse Abdominis"
    },
    movementPatterns: ["Anti-Extension"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 3,
    progressesTo: ["Tuck L-Sit"],
    regressesFrom: ["Hollow Body Hold"]
  },
  {
    name: "Tuck L-Sit",
    aliases: ["Tucked L-Sit", "L-Sit Tuck"],
    category: "Calisthenics",
    equipment: ["Parallettes", "Bodyweight"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Core",
      primeMover: "Hip Flexors",
      secondary: "Rectus Abdominis",
      tertiary: "Triceps"
    },
    movementPatterns: ["Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 3,
    progressesTo: ["L-Sit"],
    regressesFrom: ["Hollow Body Hold"]
  },
  {
    name: "L-Sit",
    aliases: ["L Sit", "Full L-Sit"],
    category: "Calisthenics",
    equipment: ["Parallettes", "Bodyweight"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Core",
      primeMover: "Hip Flexors",
      secondary: "Rectus Abdominis",
      tertiary: "Triceps"
    },
    movementPatterns: ["Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 5,
    progressesTo: ["V-Sit", "L-Sit Ring Support"],
    regressesFrom: ["Tuck L-Sit"]
  },
  {
    name: "V-Sit",
    aliases: ["V Sit", "Straddle V-Sit", "Manna Prep"],
    category: "Calisthenics",
    equipment: ["Parallettes", "Bodyweight"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Core",
      primeMover: "Hip Flexors",
      secondary: "Rectus Abdominis",
      tertiary: "Lower Back"
    },
    movementPatterns: ["Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 8,
    progressesTo: ["Manna"],
    regressesFrom: ["L-Sit"]
  },
  {
    name: "Manna",
    aliases: ["High V-Sit", "Full Manna"],
    category: "Calisthenics",
    equipment: ["Parallettes", "Bodyweight"],
    difficulty: "Expert",
    muscles: {
      targetGroup: "Core",
      primeMover: "Hip Flexors",
      secondary: "Lower Back",
      tertiary: "Triceps"
    },
    movementPatterns: ["Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 10,
    progressesTo: [],
    regressesFrom: ["V-Sit"]
  },

  // ============================================
  // DRAGON FLAG / ADVANCED CORE
  // ============================================
  {
    name: "Lying Leg Raise",
    aliases: ["Leg Raise", "Flat Leg Raise"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Core",
      primeMover: "Rectus Abdominis",
      secondary: "Hip Flexors",
      tertiary: "Obliques"
    },
    movementPatterns: ["Hip Flexion"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 2,
    progressesTo: ["Hanging Knee Raise"],
    regressesFrom: []
  },
  {
    name: "Hanging Knee Raise",
    aliases: ["Knee Raise", "Hanging Knee Tuck"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Core",
      primeMover: "Rectus Abdominis",
      secondary: "Hip Flexors",
      tertiary: "Grip"
    },
    movementPatterns: ["Hip Flexion"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 3,
    progressesTo: ["Hanging Leg Raise"],
    regressesFrom: ["Lying Leg Raise"]
  },
  {
    name: "Hanging Leg Raise",
    aliases: ["Straight Leg Raise", "HLR"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Core",
      primeMover: "Rectus Abdominis",
      secondary: "Hip Flexors",
      tertiary: "Grip"
    },
    movementPatterns: ["Hip Flexion"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 4,
    progressesTo: ["Toes to Bar"],
    regressesFrom: ["Hanging Knee Raise"]
  },
  {
    name: "Toes to Bar",
    aliases: ["TTB", "T2B", "Toes-to-Bar"],
    category: "Calisthenics",
    equipment: ["Pull-Up Bar"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Core",
      primeMover: "Rectus Abdominis",
      secondary: "Hip Flexors",
      tertiary: "Latissimus Dorsi"
    },
    movementPatterns: ["Hip Flexion"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 5,
    progressesTo: ["Tuck Dragon Flag"],
    regressesFrom: ["Hanging Leg Raise"]
  },
  {
    name: "Tuck Dragon Flag",
    aliases: ["Tucked Dragon Flag", "Dragon Flag Tuck"],
    category: "Calisthenics",
    equipment: ["Bench"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Core",
      primeMover: "Rectus Abdominis",
      secondary: "Erector Spinae",
      tertiary: "Latissimus Dorsi"
    },
    movementPatterns: ["Anti-Extension"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 6,
    progressesTo: ["Straddle Dragon Flag"],
    regressesFrom: ["Toes to Bar"]
  },
  {
    name: "Straddle Dragon Flag",
    aliases: ["Straddled Dragon Flag"],
    category: "Calisthenics",
    equipment: ["Bench"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Core",
      primeMover: "Rectus Abdominis",
      secondary: "Erector Spinae",
      tertiary: "Hip Flexors"
    },
    movementPatterns: ["Anti-Extension"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 7,
    progressesTo: ["Dragon Flag"],
    regressesFrom: ["Tuck Dragon Flag"]
  },
  {
    name: "Dragon Flag",
    aliases: ["Full Dragon Flag", "Bruce Lee Dragon Flag"],
    category: "Calisthenics",
    equipment: ["Bench"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Core",
      primeMover: "Rectus Abdominis",
      secondary: "Erector Spinae",
      tertiary: "Glutes"
    },
    movementPatterns: ["Anti-Extension"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 8,
    progressesTo: [],
    regressesFrom: ["Straddle Dragon Flag"]
  },

  // ============================================
  // HUMAN FLAG PROGRESSIONS
  // ============================================
  {
    name: "Vertical Flag Hold",
    aliases: ["Vertical Pole Hold", "Flag Setup"],
    category: "Calisthenics",
    equipment: ["Pole", "Stall Bars"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Core",
      primeMover: "Obliques",
      secondary: "Latissimus Dorsi",
      tertiary: "Shoulders"
    },
    movementPatterns: ["Isometric Hold"],
    planesOfMotion: ["Frontal Plane"],
    progressionLevel: 5,
    progressesTo: ["Tuck Human Flag"],
    regressesFrom: []
  },
  {
    name: "Tuck Human Flag",
    aliases: ["Tucked Flag", "Human Flag Tuck"],
    category: "Calisthenics",
    equipment: ["Pole", "Stall Bars"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Core",
      primeMover: "Obliques",
      secondary: "Latissimus Dorsi",
      tertiary: "Shoulders"
    },
    movementPatterns: ["Anti-Lateral Flexion", "Isometric Hold"],
    planesOfMotion: ["Frontal Plane"],
    progressionLevel: 7,
    progressesTo: ["Straddle Human Flag"],
    regressesFrom: ["Vertical Flag Hold"]
  },
  {
    name: "Straddle Human Flag",
    aliases: ["Straddled Human Flag"],
    category: "Calisthenics",
    equipment: ["Pole", "Stall Bars"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Core",
      primeMover: "Obliques",
      secondary: "Latissimus Dorsi",
      tertiary: "Shoulders"
    },
    movementPatterns: ["Anti-Lateral Flexion", "Isometric Hold"],
    planesOfMotion: ["Frontal Plane"],
    progressionLevel: 8,
    progressesTo: ["Human Flag"],
    regressesFrom: ["Tuck Human Flag"]
  },
  {
    name: "Human Flag",
    aliases: ["Full Human Flag", "Side Lever", "Pole Flag"],
    category: "Calisthenics",
    equipment: ["Pole", "Stall Bars"],
    difficulty: "Expert",
    muscles: {
      targetGroup: "Core",
      primeMover: "Obliques",
      secondary: "Latissimus Dorsi",
      tertiary: "Shoulders"
    },
    movementPatterns: ["Anti-Lateral Flexion", "Isometric Hold"],
    planesOfMotion: ["Frontal Plane"],
    progressionLevel: 9,
    progressesTo: [],
    regressesFrom: ["Straddle Human Flag"]
  },

  // ============================================
  // LEG / SQUAT PROGRESSIONS
  // ============================================
  {
    name: "Assisted Squat",
    aliases: ["Supported Squat", "TRX Squat"],
    category: "Calisthenics",
    equipment: ["TRX", "Support"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Quadriceps",
      primeMover: "Vastus Lateralis",
      secondary: "Gluteus Maximus",
      tertiary: "Hamstrings"
    },
    movementPatterns: ["Squat"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 1,
    progressesTo: ["Bodyweight Squat"],
    regressesFrom: []
  },
  {
    name: "Bodyweight Squat",
    aliases: ["Air Squat", "BW Squat", "Basic Squat"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Quadriceps",
      primeMover: "Vastus Lateralis",
      secondary: "Gluteus Maximus",
      tertiary: "Hamstrings"
    },
    movementPatterns: ["Squat"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 2,
    progressesTo: ["Deep Squat", "Split Squat"],
    regressesFrom: ["Assisted Squat"]
  },
  {
    name: "Deep Squat",
    aliases: ["ATG Squat", "Full Squat", "Ass to Grass Squat"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Quadriceps",
      primeMover: "Vastus Lateralis",
      secondary: "Gluteus Maximus",
      tertiary: "Hamstrings"
    },
    movementPatterns: ["Squat"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 3,
    progressesTo: ["Bulgarian Split Squat", "Cossack Squat"],
    regressesFrom: ["Bodyweight Squat"]
  },
  {
    name: "Split Squat",
    aliases: ["Static Lunge", "Lunge Hold"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Quadriceps",
      primeMover: "Vastus Lateralis",
      secondary: "Gluteus Maximus",
      tertiary: "Hamstrings"
    },
    movementPatterns: ["Lunge"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 3,
    progressesTo: ["Bulgarian Split Squat"],
    regressesFrom: ["Bodyweight Squat"]
  },
  {
    name: "Bulgarian Split Squat",
    aliases: ["Rear Foot Elevated Split Squat", "RFESS"],
    category: "Calisthenics",
    equipment: ["Bench", "Bodyweight"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Quadriceps",
      primeMover: "Vastus Lateralis",
      secondary: "Gluteus Maximus",
      tertiary: "Hamstrings"
    },
    movementPatterns: ["Lunge"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 5,
    progressesTo: ["Assisted Pistol Squat"],
    regressesFrom: ["Split Squat", "Deep Squat"]
  },
  {
    name: "Cossack Squat",
    aliases: ["Side Lunge", "Lateral Squat"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Quadriceps",
      primeMover: "Vastus Lateralis",
      secondary: "Adductors",
      tertiary: "Gluteus Medius"
    },
    movementPatterns: ["Squat", "Lateral Movement"],
    planesOfMotion: ["Sagittal Plane", "Frontal Plane"],
    progressionLevel: 5,
    progressesTo: ["Pistol Squat"],
    regressesFrom: ["Deep Squat"]
  },
  {
    name: "Assisted Pistol Squat",
    aliases: ["Supported Pistol", "TRX Pistol"],
    category: "Calisthenics",
    equipment: ["TRX", "Support"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Quadriceps",
      primeMover: "Vastus Lateralis",
      secondary: "Gluteus Maximus",
      tertiary: "Hip Flexors"
    },
    movementPatterns: ["Single Leg Squat"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 6,
    progressesTo: ["Pistol Squat"],
    regressesFrom: ["Bulgarian Split Squat"]
  },
  {
    name: "Pistol Squat",
    aliases: ["Single Leg Squat", "One Leg Squat"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Quadriceps",
      primeMover: "Vastus Lateralis",
      secondary: "Gluteus Maximus",
      tertiary: "Hip Flexors"
    },
    movementPatterns: ["Single Leg Squat"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 7,
    progressesTo: ["Dragon Squat"],
    regressesFrom: ["Assisted Pistol Squat", "Cossack Squat"]
  },
  {
    name: "Dragon Squat",
    aliases: ["Advanced Pistol", "Airborne Lunge"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Expert",
    muscles: {
      targetGroup: "Quadriceps",
      primeMover: "Vastus Lateralis",
      secondary: "Gluteus Maximus",
      tertiary: "Core"
    },
    movementPatterns: ["Single Leg Squat"],
    planesOfMotion: ["Sagittal Plane", "Transverse Plane"],
    progressionLevel: 9,
    progressesTo: [],
    regressesFrom: ["Pistol Squat"]
  },
  {
    name: "Shrimp Squat",
    aliases: ["Skater Squat"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Quadriceps",
      primeMover: "Vastus Lateralis",
      secondary: "Gluteus Maximus",
      tertiary: "Core"
    },
    movementPatterns: ["Single Leg Squat"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 8,
    progressesTo: ["Dragon Squat"],
    regressesFrom: ["Pistol Squat"]
  },

  // ============================================
  // HAMSTRING / NORDIC PROGRESSIONS
  // ============================================
  {
    name: "Glute Bridge",
    aliases: ["Hip Bridge", "Bridge"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Glutes",
      primeMover: "Gluteus Maximus",
      secondary: "Hamstrings",
      tertiary: "Core"
    },
    movementPatterns: ["Hip Extension"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 1,
    progressesTo: ["Single Leg Glute Bridge"],
    regressesFrom: []
  },
  {
    name: "Single Leg Glute Bridge",
    aliases: ["One Leg Bridge", "Unilateral Bridge"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Glutes",
      primeMover: "Gluteus Maximus",
      secondary: "Hamstrings",
      tertiary: "Core"
    },
    movementPatterns: ["Hip Extension"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 3,
    progressesTo: ["Assisted Nordic Curl"],
    regressesFrom: ["Glute Bridge"]
  },
  {
    name: "Assisted Nordic Curl",
    aliases: ["Band Nordic", "Eccentric Nordic"],
    category: "Calisthenics",
    equipment: ["Resistance Band", "Nordic Bench"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Hamstrings",
      primeMover: "Biceps Femoris",
      secondary: "Semitendinosus",
      tertiary: "Core"
    },
    movementPatterns: ["Knee Flexion"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 5,
    progressesTo: ["Nordic Curl"],
    regressesFrom: ["Single Leg Glute Bridge"]
  },
  {
    name: "Nordic Curl",
    aliases: ["Nordic Hamstring Curl", "NHC", "Leg Curl"],
    category: "Calisthenics",
    equipment: ["Nordic Bench"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Hamstrings",
      primeMover: "Biceps Femoris",
      secondary: "Semitendinosus",
      tertiary: "Gastrocnemius"
    },
    movementPatterns: ["Knee Flexion"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 7,
    progressesTo: [],
    regressesFrom: ["Assisted Nordic Curl"]
  },
  {
    name: "Reverse Nordic",
    aliases: ["Reverse Nordic Curl", "Quad Nordic"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Quadriceps",
      primeMover: "Rectus Femoris",
      secondary: "Vastus Intermedius",
      tertiary: "Hip Flexors"
    },
    movementPatterns: ["Hip Flexion"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 5,
    progressesTo: [],
    regressesFrom: ["Deep Squat"]
  },

  // ============================================
  // BRIDGE / FLEXIBILITY PROGRESSIONS
  // ============================================
  {
    name: "Short Bridge",
    aliases: ["Beginner Bridge", "Supine Bridge"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Glutes",
      primeMover: "Gluteus Maximus",
      secondary: "Erector Spinae",
      tertiary: "Hamstrings"
    },
    movementPatterns: ["Hip Extension"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 2,
    progressesTo: ["Straight Bridge"],
    regressesFrom: []
  },
  {
    name: "Straight Bridge",
    aliases: ["Tabletop", "Reverse Plank"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Glutes",
      primeMover: "Gluteus Maximus",
      secondary: "Erector Spinae",
      tertiary: "Triceps"
    },
    movementPatterns: ["Hip Extension", "Shoulder Extension"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 3,
    progressesTo: ["Wall Bridge"],
    regressesFrom: ["Short Bridge"]
  },
  {
    name: "Wall Bridge",
    aliases: ["Wall Walk Down", "Wall Backbend"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Back",
      primeMover: "Erector Spinae",
      secondary: "Shoulders",
      tertiary: "Glutes"
    },
    movementPatterns: ["Spinal Extension"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 5,
    progressesTo: ["Full Bridge"],
    regressesFrom: ["Straight Bridge"]
  },
  {
    name: "Full Bridge",
    aliases: ["Wheel Pose", "Back Bridge", "Gymnastic Bridge"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Back",
      primeMover: "Erector Spinae",
      secondary: "Shoulders",
      tertiary: "Glutes"
    },
    movementPatterns: ["Spinal Extension"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 6,
    progressesTo: ["Stand to Bridge"],
    regressesFrom: ["Wall Bridge"]
  },
  {
    name: "Stand to Bridge",
    aliases: ["Bridge Kickover", "Standing Backbend"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Back",
      primeMover: "Erector Spinae",
      secondary: "Shoulders",
      tertiary: "Core"
    },
    movementPatterns: ["Spinal Extension"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 8,
    progressesTo: [],
    regressesFrom: ["Full Bridge"]
  },

  // ============================================
  // PLANK VARIATIONS
  // ============================================
  {
    name: "Plank Hold",
    aliases: ["Plank", "Front Plank", "Forearm Plank"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Core",
      primeMover: "Rectus Abdominis",
      secondary: "Transverse Abdominis",
      tertiary: "Erector Spinae"
    },
    movementPatterns: ["Anti-Extension", "Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 1,
    progressesTo: ["Side Plank", "RKC Plank", "Hollow Body Hold"],
    regressesFrom: []
  },
  {
    name: "RKC Plank",
    aliases: ["Hardstyle Plank", "Tension Plank"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Core",
      primeMover: "Rectus Abdominis",
      secondary: "Glutes",
      tertiary: "Quadriceps"
    },
    movementPatterns: ["Anti-Extension", "Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 2,
    progressesTo: ["Long Lever Plank"],
    regressesFrom: ["Plank Hold"]
  },
  {
    name: "Side Plank",
    aliases: ["Lateral Plank", "Side Bridge"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Core",
      primeMover: "Obliques",
      secondary: "Gluteus Medius",
      tertiary: "Quadratus Lumborum"
    },
    movementPatterns: ["Anti-Lateral Flexion", "Isometric Hold"],
    planesOfMotion: ["Frontal Plane"],
    progressionLevel: 2,
    progressesTo: ["Copenhagen Plank"],
    regressesFrom: ["Plank Hold"]
  },
  {
    name: "Copenhagen Plank",
    aliases: ["Copenhagen Hold", "Adductor Plank"],
    category: "Calisthenics",
    equipment: ["Bench"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Adductors",
      primeMover: "Adductor Magnus",
      secondary: "Obliques",
      tertiary: "Hip Flexors"
    },
    movementPatterns: ["Anti-Lateral Flexion", "Isometric Hold"],
    planesOfMotion: ["Frontal Plane"],
    progressionLevel: 5,
    progressesTo: [],
    regressesFrom: ["Side Plank"]
  },
  {
    name: "Long Lever Plank",
    aliases: ["Extended Plank", "Body Saw Prep"],
    category: "Calisthenics",
    equipment: ["Bodyweight"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Core",
      primeMover: "Rectus Abdominis",
      secondary: "Shoulders",
      tertiary: "Latissimus Dorsi"
    },
    movementPatterns: ["Anti-Extension", "Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 4,
    progressesTo: ["Planche Lean"],
    regressesFrom: ["RKC Plank"]
  },

  // ============================================
  // ROW PROGRESSIONS
  // ============================================
  {
    name: "Incline Row",
    aliases: ["Elevated Row", "High Angle Row"],
    category: "Calisthenics",
    equipment: ["Rings", "Bar"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Rhomboids",
      tertiary: "Biceps"
    },
    movementPatterns: ["Horizontal Pull"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 2,
    progressesTo: ["Inverted Row"],
    regressesFrom: []
  },
  {
    name: "Inverted Row",
    aliases: ["Body Row", "Australian Pull-Up", "Horizontal Pull-Up"],
    category: "Calisthenics",
    equipment: ["Bar", "Rings"],
    difficulty: "Beginner",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Rhomboids",
      tertiary: "Biceps"
    },
    movementPatterns: ["Horizontal Pull"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 3,
    progressesTo: ["Feet Elevated Row", "Pull-Up"],
    regressesFrom: ["Incline Row"]
  },
  {
    name: "Feet Elevated Row",
    aliases: ["Elevated Inverted Row", "Decline Row"],
    category: "Calisthenics",
    equipment: ["Bar", "Rings", "Box"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Rhomboids",
      tertiary: "Biceps"
    },
    movementPatterns: ["Horizontal Pull"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 4,
    progressesTo: ["Front Lever Row"],
    regressesFrom: ["Inverted Row"]
  },
  {
    name: "Archer Row",
    aliases: ["Side to Side Row", "Unilateral Row"],
    category: "Calisthenics",
    equipment: ["Rings", "Bar"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Rhomboids",
      tertiary: "Biceps"
    },
    movementPatterns: ["Horizontal Pull"],
    planesOfMotion: ["Sagittal Plane", "Transverse Plane"],
    progressionLevel: 5,
    progressesTo: ["One-Arm Row"],
    regressesFrom: ["Feet Elevated Row"]
  },
  {
    name: "One-Arm Row",
    aliases: ["Single Arm Row", "Unilateral Inverted Row"],
    category: "Calisthenics",
    equipment: ["Rings", "Bar"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Back",
      primeMover: "Latissimus Dorsi",
      secondary: "Rhomboids",
      tertiary: "Core"
    },
    movementPatterns: ["Horizontal Pull"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 7,
    progressesTo: [],
    regressesFrom: ["Archer Row"]
  },

  // ============================================
  // IRON CROSS / ADVANCED RINGS
  // ============================================
  {
    name: "Ring Turned Out Support",
    aliases: ["RTO Support", "Turned Out Support"],
    category: "Calisthenics",
    equipment: ["Gymnastic Rings"],
    difficulty: "Intermediate",
    muscles: {
      targetGroup: "Shoulders",
      primeMover: "Anterior Deltoid",
      secondary: "Triceps",
      tertiary: "Pectoralis Major"
    },
    movementPatterns: ["Isometric Hold"],
    planesOfMotion: ["Sagittal Plane"],
    progressionLevel: 6,
    progressesTo: ["Iron Cross Prep"],
    regressesFrom: ["Ring Support Hold"]
  },
  {
    name: "Iron Cross Prep",
    aliases: ["Cross Pulls", "Assisted Iron Cross"],
    category: "Calisthenics",
    equipment: ["Gymnastic Rings", "Resistance Band"],
    difficulty: "Advanced",
    muscles: {
      targetGroup: "Chest",
      primeMover: "Pectoralis Major",
      secondary: "Anterior Deltoid",
      tertiary: "Biceps"
    },
    movementPatterns: ["Horizontal Adduction", "Isometric Hold"],
    planesOfMotion: ["Frontal Plane"],
    progressionLevel: 8,
    progressesTo: ["Iron Cross"],
    regressesFrom: ["Ring Turned Out Support"]
  },
  {
    name: "Iron Cross",
    aliases: ["Crucifix", "Cross Hold"],
    category: "Calisthenics",
    equipment: ["Gymnastic Rings"],
    difficulty: "Expert",
    muscles: {
      targetGroup: "Chest",
      primeMover: "Pectoralis Major",
      secondary: "Anterior Deltoid",
      tertiary: "Biceps"
    },
    movementPatterns: ["Isometric Hold"],
    planesOfMotion: ["Frontal Plane"],
    progressionLevel: 10,
    progressesTo: [],
    regressesFrom: ["Iron Cross Prep"]
  },
  {
    name: "Maltese",
    aliases: ["Maltese Hold", "Wide Planche"],
    category: "Calisthenics",
    equipment: ["Gymnastic Rings", "Parallettes"],
    difficulty: "Expert",
    muscles: {
      targetGroup: "Chest",
      primeMover: "Pectoralis Major",
      secondary: "Anterior Deltoid",
      tertiary: "Core"
    },
    movementPatterns: ["Isometric Hold"],
    planesOfMotion: ["Frontal Plane"],
    progressionLevel: 10,
    progressesTo: [],
    regressesFrom: ["Full Planche", "Iron Cross"]
  }
];

// ============================================
// MAIN SCRIPT
// ============================================

console.log('Reading existing exercises...');
const existingExercises = JSON.parse(fs.readFileSync(exercisesPath, 'utf-8'));
console.log(`Found ${existingExercises.length} existing exercises`);

// Check for duplicates by name (case-insensitive)
const existingNames = new Set(existingExercises.map(e => e.name.toLowerCase()));
const exercisesToAdd = calisthenicsExercises.filter(e => {
  const exists = existingNames.has(e.name.toLowerCase());
  if (exists) {
    console.log(`  Skipping duplicate: ${e.name}`);
  }
  return !exists;
});

console.log(`\nAdding ${exercisesToAdd.length} new calisthenics exercises...`);

// Merge exercises
const allExercises = [...existingExercises, ...exercisesToAdd];

// Sort alphabetically by name
allExercises.sort((a, b) => a.name.localeCompare(b.name));

// Write back
fs.writeFileSync(exercisesPath, JSON.stringify(allExercises, null, 2));

console.log(`\nSuccess! Database now contains ${allExercises.length} exercises`);
console.log('\nNew calisthenics exercises added by category:');

// Group by progression type for output
const categories = {
  'Push-Up': exercisesToAdd.filter(e => e.name.toLowerCase().includes('push')),
  'Pull-Up': exercisesToAdd.filter(e => e.name.toLowerCase().includes('pull') && !e.name.toLowerCase().includes('push')),
  'Muscle-Up': exercisesToAdd.filter(e => e.name.toLowerCase().includes('muscle')),
  'Front Lever': exercisesToAdd.filter(e => e.name.toLowerCase().includes('front lever')),
  'Back Lever': exercisesToAdd.filter(e => e.name.toLowerCase().includes('back lever') || e.name.toLowerCase().includes('skin')),
  'Planche': exercisesToAdd.filter(e => e.name.toLowerCase().includes('planche') && !e.name.toLowerCase().includes('push')),
  'Handstand': exercisesToAdd.filter(e => e.name.toLowerCase().includes('handstand') || e.name.toLowerCase().includes('90 degree')),
  'Dip': exercisesToAdd.filter(e => e.name.toLowerCase().includes('dip') || e.name.toLowerCase().includes('support')),
  'Core': exercisesToAdd.filter(e => ['l-sit', 'v-sit', 'hollow', 'dragon', 'flag', 'plank', 'manna', 'leg raise', 'toes to bar'].some(k => e.name.toLowerCase().includes(k))),
  'Squat': exercisesToAdd.filter(e => e.name.toLowerCase().includes('squat')),
  'Row': exercisesToAdd.filter(e => e.name.toLowerCase().includes('row') && !e.name.toLowerCase().includes('archer')),
  'Bridge': exercisesToAdd.filter(e => e.name.toLowerCase().includes('bridge')),
  'Other': []
};

for (const [cat, exercises] of Object.entries(categories)) {
  if (exercises.length > 0) {
    console.log(`\n${cat} (${exercises.length}):`);
    exercises.forEach(e => console.log(`  + ${e.name}`));
  }
}

console.log('\n✓ Calisthenics exercise progressions added successfully!');
