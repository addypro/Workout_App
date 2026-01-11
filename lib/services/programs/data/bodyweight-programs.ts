/**
 * Bodyweight workout programs
 * No equipment needed - perfect for home, travel, or outdoor workouts
 */

import { WorkoutProgram, ProgramType, DifficultyLevel, ProgramCategory } from '../types';

export const BODYWEIGHT_PROGRAMS: WorkoutProgram[] = [
  {
    id: 'bodyweight-home',
    name: 'Home Bodyweight Program',
    description: 'No equipment needed! A complete bodyweight program you can do anywhere. Perfect for home workouts.',
    type: ProgramType.BODYWEIGHT,
    difficulty: DifficultyLevel.BEGINNER,
    category: ProgramCategory.BODYWEIGHT,
    duration: 6,
    daysPerWeek: 4,
    muscleGroups: ['Chest', 'Back', 'Legs', 'Core', 'Arms'],
    equipment: ['None (Bodyweight)'],
    tags: ['no-equipment', 'home', 'beginner-friendly'],
    workouts: [
      {
        week: 1, day: 1, name: 'Upper Body Push',
        exercises: [
          { name: 'Push-ups', sets: 4, reps: '10-15', restTime: 60 },
          { name: 'Diamond Push-ups', sets: 3, reps: '8-12', restTime: 60 },
          { name: 'Pike Push-ups', sets: 3, reps: '8-10', restTime: 60 },
          { name: 'Tricep Dips (chair)', sets: 3, reps: '10-15', restTime: 60 },
          { name: 'Plank to Push-up', sets: 3, reps: '8-10', restTime: 45 },
        ],
      },
      {
        week: 1, day: 2, name: 'Lower Body',
        exercises: [
          { name: 'Bodyweight Squats', sets: 4, reps: '15-20', restTime: 60 },
          { name: 'Lunges', sets: 3, reps: '12 each', restTime: 60 },
          { name: 'Glute Bridges', sets: 3, reps: '15-20', restTime: 45 },
          { name: 'Single-leg Deadlift', sets: 3, reps: '10 each', restTime: 60 },
          { name: 'Calf Raises', sets: 4, reps: '20-25', restTime: 30 },
          { name: 'Wall Sit', sets: 3, reps: '30-45 sec', restTime: 45 },
        ],
      },
      {
        week: 1, day: 3, name: 'Upper Body Pull + Core',
        exercises: [
          { name: 'Inverted Rows (table)', sets: 4, reps: '8-12', restTime: 60 },
          { name: 'Superman Hold', sets: 3, reps: '10-12', restTime: 45 },
          { name: 'Reverse Snow Angels', sets: 3, reps: '12-15', restTime: 45 },
          { name: 'Plank', sets: 3, reps: '45-60 sec', restTime: 45 },
          { name: 'Dead Bug', sets: 3, reps: '10 each', restTime: 30 },
          { name: 'Mountain Climbers', sets: 3, reps: '20 each', restTime: 45 },
        ],
      },
      {
        week: 1, day: 4, name: 'HIIT Circuit',
        exercises: [
          { name: 'Burpees', sets: 4, reps: '10', restTime: 30 },
          { name: 'Jump Squats', sets: 4, reps: '15', restTime: 30 },
          { name: 'High Knees', sets: 4, reps: '30 sec', restTime: 30 },
          { name: 'Push-ups', sets: 4, reps: '10-12', restTime: 30 },
          { name: 'Jumping Lunges', sets: 4, reps: '10 each', restTime: 30 },
          { name: 'Plank Jacks', sets: 4, reps: '20', restTime: 30 },
        ],
      },
    ],
  },
  {
    id: 'recommended-routine',
    name: 'Reddit Recommended Routine',
    description: 'The famous r/bodyweightfitness routine. Progressive calisthenics for strength and skill.',
    type: ProgramType.BODYWEIGHT,
    difficulty: DifficultyLevel.BEGINNER,
    category: ProgramCategory.BODYWEIGHT,
    duration: 12,
    daysPerWeek: 3,
    muscleGroups: ['Full Body'],
    equipment: ['Pull-up Bar', 'Dip Bars (optional)'],
    tags: ['calisthenics', 'progressive', 'reddit'],
    workouts: [
      {
        week: 1, day: 1, name: 'Full Body A',
        exercises: [
          { name: 'Pull-up Progression', sets: 3, reps: '5-8', restTime: 90, notes: 'Negative, assisted, or full' },
          { name: 'Squat Progression', sets: 3, reps: '5-8', restTime: 90, notes: 'Assisted, regular, or pistol' },
          { name: 'Dip Progression', sets: 3, reps: '5-8', restTime: 90, notes: 'Bench, parallel, or ring' },
          { name: 'Hinge Progression', sets: 3, reps: '5-8', restTime: 90, notes: 'Romanian single leg or nordic curl' },
          { name: 'Row Progression', sets: 3, reps: '5-8', restTime: 90, notes: 'Incline to horizontal rows' },
          { name: 'Push-up Progression', sets: 3, reps: '5-8', restTime: 90, notes: 'Diamond, pseudo planche, or archer' },
          { name: 'Core Triplet', sets: 3, reps: '8-12', restTime: 60, notes: 'Anti-extension, anti-rotation, extension' },
        ],
      },
      {
        week: 1, day: 2, name: 'Full Body B',
        exercises: [
          { name: 'Pull-up Progression', sets: 3, reps: '5-8', restTime: 90 },
          { name: 'Squat Progression', sets: 3, reps: '5-8', restTime: 90 },
          { name: 'Dip Progression', sets: 3, reps: '5-8', restTime: 90 },
          { name: 'Hinge Progression', sets: 3, reps: '5-8', restTime: 90 },
          { name: 'Row Progression', sets: 3, reps: '5-8', restTime: 90 },
          { name: 'Push-up Progression', sets: 3, reps: '5-8', restTime: 90 },
          { name: 'Core Triplet', sets: 3, reps: '8-12', restTime: 60 },
        ],
      },
      {
        week: 1, day: 3, name: 'Full Body C',
        exercises: [
          { name: 'Pull-up Progression', sets: 3, reps: '5-8', restTime: 90 },
          { name: 'Squat Progression', sets: 3, reps: '5-8', restTime: 90 },
          { name: 'Dip Progression', sets: 3, reps: '5-8', restTime: 90 },
          { name: 'Hinge Progression', sets: 3, reps: '5-8', restTime: 90 },
          { name: 'Row Progression', sets: 3, reps: '5-8', restTime: 90 },
          { name: 'Push-up Progression', sets: 3, reps: '5-8', restTime: 90 },
          { name: 'Core Triplet', sets: 3, reps: '8-12', restTime: 60 },
        ],
      },
    ],
  },
  {
    id: 'convict-conditioning',
    name: 'Convict Conditioning',
    description: 'Prison-style progressive calisthenics. Master 6 movements from easy to superhuman.',
    type: ProgramType.BODYWEIGHT,
    difficulty: DifficultyLevel.BEGINNER,
    category: ProgramCategory.BODYWEIGHT,
    duration: 52,
    daysPerWeek: 3,
    muscleGroups: ['Full Body'],
    equipment: ['None', 'Basketball (optional)', 'Wall'],
    tags: ['progressive', 'minimalist', 'strength'],
    workouts: [
      {
        week: 1, day: 1, name: 'Push/Legs',
        exercises: [
          { name: 'Push-up Progression', sets: 3, reps: 'Work up to 50', restTime: 60, notes: 'Start: Wall push-ups' },
          { name: 'Squat Progression', sets: 3, reps: 'Work up to 50', restTime: 60, notes: 'Start: Shoulderstand squats' },
          { name: 'Leg Raise Progression', sets: 3, reps: 'Work up to 30', restTime: 45, notes: 'Start: Knee tucks' },
        ],
      },
      {
        week: 1, day: 2, name: 'Pull/Bridge',
        exercises: [
          { name: 'Pull-up Progression', sets: 3, reps: 'Work up to 30', restTime: 90, notes: 'Start: Vertical pulls' },
          { name: 'Bridge Progression', sets: 3, reps: 'Work up to 30', restTime: 60, notes: 'Start: Short bridges' },
          { name: 'Handstand Progression', sets: 3, reps: 'Work up to 2 min', restTime: 60, notes: 'Start: Wall headstand' },
        ],
      },
      {
        week: 1, day: 3, name: 'Full Body',
        exercises: [
          { name: 'Push-up Progression', sets: 2, reps: 'Half max', restTime: 60 },
          { name: 'Pull-up Progression', sets: 2, reps: 'Half max', restTime: 90 },
          { name: 'Squat Progression', sets: 2, reps: 'Half max', restTime: 60 },
          { name: 'Leg Raise Progression', sets: 2, reps: 'Half max', restTime: 45 },
          { name: 'Bridge Progression', sets: 2, reps: 'Half max', restTime: 60 },
          { name: 'Handstand Work', sets: 2, reps: '30-60 sec', restTime: 60 },
        ],
      },
    ],
  },
  {
    id: 'minimalist-strength',
    name: 'Minimalist Strength',
    description: '20 minutes, 3 days a week. Push-ups, pull-ups, and squats - that\'s it. Simple but effective.',
    type: ProgramType.BODYWEIGHT,
    difficulty: DifficultyLevel.BEGINNER,
    category: ProgramCategory.BEGINNER,
    duration: 8,
    daysPerWeek: 3,
    muscleGroups: ['Full Body'],
    equipment: ['Pull-up Bar'],
    tags: ['minimalist', 'quick', 'simple'],
    workouts: [
      {
        week: 1, day: 1, name: 'Full Body',
        exercises: [
          { name: 'Push-ups', sets: 5, reps: 'AMRAP', restTime: 60, notes: 'Max reps each set' },
          { name: 'Pull-ups', sets: 5, reps: 'AMRAP', restTime: 90 },
          { name: 'Squats', sets: 5, reps: 'AMRAP', restTime: 60 },
        ],
      },
      {
        week: 1, day: 2, name: 'Full Body',
        exercises: [
          { name: 'Push-ups', sets: 5, reps: 'AMRAP', restTime: 60 },
          { name: 'Pull-ups', sets: 5, reps: 'AMRAP', restTime: 90 },
          { name: 'Squats', sets: 5, reps: 'AMRAP', restTime: 60 },
        ],
      },
      {
        week: 1, day: 3, name: 'Full Body',
        exercises: [
          { name: 'Push-ups', sets: 5, reps: 'AMRAP', restTime: 60 },
          { name: 'Pull-ups', sets: 5, reps: 'AMRAP', restTime: 90 },
          { name: 'Squats', sets: 5, reps: 'AMRAP', restTime: 60 },
        ],
      },
    ],
  },
  {
    id: 'calisthenics-skills',
    name: 'Calisthenics Skills Program',
    description: 'Work towards advanced skills: muscle-ups, handstands, L-sits, and levers.',
    type: ProgramType.BODYWEIGHT,
    difficulty: DifficultyLevel.INTERMEDIATE,
    category: ProgramCategory.BODYWEIGHT,
    duration: 16,
    daysPerWeek: 4,
    muscleGroups: ['Full Body'],
    equipment: ['Pull-up Bar', 'Parallel Bars', 'Rings (optional)'],
    tags: ['skills', 'advanced', 'calisthenics'],
    workouts: [
      {
        week: 1, day: 1, name: 'Push + Handstand',
        exercises: [
          { name: 'Handstand Practice', sets: 5, reps: '30-60 sec', restTime: 90, notes: 'Wall or freestanding' },
          { name: 'Pike Push-ups', sets: 4, reps: '8-10', restTime: 60 },
          { name: 'Pseudo Planche Push-ups', sets: 4, reps: '6-10', restTime: 60 },
          { name: 'Dips', sets: 4, reps: '8-12', restTime: 60 },
          { name: 'Planche Lean', sets: 3, reps: '20-30 sec', restTime: 60 },
        ],
      },
      {
        week: 1, day: 2, name: 'Pull + Front Lever',
        exercises: [
          { name: 'Front Lever Progression', sets: 5, reps: '10-20 sec', restTime: 120, notes: 'Tuck to full' },
          { name: 'Pull-ups', sets: 4, reps: '8-10', restTime: 90 },
          { name: 'Archer Pull-ups', sets: 3, reps: '5-8 each', restTime: 90 },
          { name: 'Inverted Rows', sets: 3, reps: '10-12', restTime: 60 },
          { name: 'Face Pulls (band)', sets: 3, reps: '15-20', restTime: 45 },
        ],
      },
      {
        week: 1, day: 3, name: 'Legs + L-Sit',
        exercises: [
          { name: 'L-Sit Progression', sets: 5, reps: '15-30 sec', restTime: 90 },
          { name: 'Pistol Squat Progression', sets: 4, reps: '5-8 each', restTime: 90 },
          { name: 'Nordic Curl Progression', sets: 3, reps: '5-8', restTime: 90 },
          { name: 'Shrimp Squats', sets: 3, reps: '8-10 each', restTime: 60 },
          { name: 'Calf Raises', sets: 4, reps: '15-20', restTime: 45 },
        ],
      },
      {
        week: 1, day: 4, name: 'Muscle-up + Back Lever',
        exercises: [
          { name: 'Muscle-up Progression', sets: 5, reps: '3-5', restTime: 180, notes: 'Jumping, band, or full' },
          { name: 'Back Lever Progression', sets: 4, reps: '10-20 sec', restTime: 120 },
          { name: 'Explosive Pull-ups', sets: 4, reps: '5-8', restTime: 90 },
          { name: 'Straight Bar Dips', sets: 3, reps: '8-10', restTime: 60 },
          { name: 'Dragon Flag Progression', sets: 3, reps: '5-8', restTime: 90 },
        ],
      },
    ],
  },
];

