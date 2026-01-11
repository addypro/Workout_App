/**
 * Strength-focused workout programs
 * Programs designed for building raw strength and power
 */

import { WorkoutProgram, ProgramType, DifficultyLevel, ProgramCategory } from '../types';

export const STRENGTH_PROGRAMS: WorkoutProgram[] = [
  {
    id: 'stronglifts-5x5',
    name: 'StrongLifts 5x5',
    description: 'The classic 5x5 program. Simple, effective strength building through progressive overload on compound lifts.',
    type: ProgramType.STRENGTH,
    difficulty: DifficultyLevel.BEGINNER,
    category: ProgramCategory.POPULAR,
    duration: 12,
    daysPerWeek: 3,
    muscleGroups: ['Full Body'],
    equipment: ['Barbell', 'Squat Rack', 'Bench'],
    tags: ['compound', 'progressive-overload', 'minimalist'],
    workouts: [
      {
        week: 1, day: 1, name: 'Workout A',
        exercises: [
          { name: 'Squats', sets: 5, reps: '5', restTime: 180, notes: 'Add 5 lbs each session' },
          { name: 'Bench Press', sets: 5, reps: '5', restTime: 180 },
          { name: 'Barbell Rows', sets: 5, reps: '5', restTime: 180 },
        ],
      },
      {
        week: 1, day: 2, name: 'Workout B',
        exercises: [
          { name: 'Squats', sets: 5, reps: '5', restTime: 180 },
          { name: 'Overhead Press', sets: 5, reps: '5', restTime: 180 },
          { name: 'Deadlift', sets: 1, reps: '5', restTime: 180, notes: 'One heavy set' },
        ],
      },
      {
        week: 1, day: 3, name: 'Workout A',
        exercises: [
          { name: 'Squats', sets: 5, reps: '5', restTime: 180 },
          { name: 'Bench Press', sets: 5, reps: '5', restTime: 180 },
          { name: 'Barbell Rows', sets: 5, reps: '5', restTime: 180 },
        ],
      },
    ],
  },
  {
    id: 'starting-strength',
    name: 'Starting Strength',
    description: 'Mark Rippetoe\'s legendary novice program. Master the fundamentals with 3x5 on key compound movements.',
    type: ProgramType.STRENGTH,
    difficulty: DifficultyLevel.BEGINNER,
    category: ProgramCategory.POPULAR,
    duration: 12,
    daysPerWeek: 3,
    muscleGroups: ['Full Body'],
    equipment: ['Barbell', 'Squat Rack', 'Bench'],
    tags: ['compound', 'linear-progression', 'fundamental'],
    workouts: [
      {
        week: 1, day: 1, name: 'Workout A',
        exercises: [
          { name: 'Squats', sets: 3, reps: '5', restTime: 180 },
          { name: 'Bench Press', sets: 3, reps: '5', restTime: 180 },
          { name: 'Deadlift', sets: 1, reps: '5', restTime: 180 },
        ],
      },
      {
        week: 1, day: 2, name: 'Workout B',
        exercises: [
          { name: 'Squats', sets: 3, reps: '5', restTime: 180 },
          { name: 'Overhead Press', sets: 3, reps: '5', restTime: 180 },
          { name: 'Power Clean', sets: 5, reps: '3', restTime: 180 },
        ],
      },
      {
        week: 1, day: 3, name: 'Workout A',
        exercises: [
          { name: 'Squats', sets: 3, reps: '5', restTime: 180 },
          { name: 'Bench Press', sets: 3, reps: '5', restTime: 180 },
          { name: 'Deadlift', sets: 1, reps: '5', restTime: 180 },
        ],
      },
    ],
  },
  {
    id: 'madcow-5x5',
    name: 'Madcow 5x5',
    description: 'Intermediate 5x5 variation with weekly progression. Perfect for lifters who\'ve stalled on linear programs.',
    type: ProgramType.STRENGTH,
    difficulty: DifficultyLevel.INTERMEDIATE,
    category: ProgramCategory.STRENGTH,
    duration: 12,
    daysPerWeek: 3,
    muscleGroups: ['Full Body'],
    equipment: ['Barbell', 'Squat Rack', 'Bench'],
    tags: ['intermediate', 'weekly-progression', '5x5'],
    workouts: [
      {
        week: 1, day: 1, name: 'Monday - Heavy',
        exercises: [
          { name: 'Squats', sets: 5, reps: '5', restTime: 180, notes: 'Ramping sets to top set' },
          { name: 'Bench Press', sets: 5, reps: '5', restTime: 180 },
          { name: 'Barbell Rows', sets: 5, reps: '5', restTime: 180 },
        ],
      },
      {
        week: 1, day: 2, name: 'Wednesday - Light',
        exercises: [
          { name: 'Squats', sets: 4, reps: '5', restTime: 120, notes: 'Light day - 80% of Monday' },
          { name: 'Overhead Press', sets: 4, reps: '5', restTime: 120 },
          { name: 'Deadlift', sets: 4, reps: '5', restTime: 180, notes: 'Light sets' },
        ],
      },
      {
        week: 1, day: 3, name: 'Friday - Medium',
        exercises: [
          { name: 'Squats', sets: 4, reps: '5', restTime: 180, notes: 'Work up to new 5RM' },
          { name: 'Bench Press', sets: 4, reps: '5', restTime: 180 },
          { name: 'Barbell Rows', sets: 4, reps: '5', restTime: 180 },
        ],
      },
    ],
  },
  {
    id: 'texas-method',
    name: 'Texas Method',
    description: 'Volume/Recovery/Intensity structure for intermediate lifters. Weekly PRs with smart periodization.',
    type: ProgramType.STRENGTH,
    difficulty: DifficultyLevel.INTERMEDIATE,
    category: ProgramCategory.STRENGTH,
    duration: 12,
    daysPerWeek: 3,
    muscleGroups: ['Full Body'],
    equipment: ['Barbell', 'Squat Rack', 'Bench'],
    tags: ['intermediate', 'periodization', 'weekly-pr'],
    workouts: [
      {
        week: 1, day: 1, name: 'Volume Day',
        exercises: [
          { name: 'Squats', sets: 5, reps: '5', restTime: 180, notes: '90% of 5RM' },
          { name: 'Bench Press / OHP', sets: 5, reps: '5', restTime: 180 },
          { name: 'Deadlift', sets: 1, reps: '5', restTime: 180 },
        ],
      },
      {
        week: 1, day: 2, name: 'Recovery Day',
        exercises: [
          { name: 'Squats', sets: 2, reps: '5', restTime: 120, notes: '80% of Volume Day' },
          { name: 'OHP / Bench Press', sets: 3, reps: '5', restTime: 120 },
          { name: 'Chin-ups', sets: 3, reps: 'AMRAP', restTime: 90 },
          { name: 'Back Extensions', sets: 5, reps: '10', restTime: 60 },
        ],
      },
      {
        week: 1, day: 3, name: 'Intensity Day',
        exercises: [
          { name: 'Squats', sets: 1, reps: '5', restTime: 300, notes: 'New 5RM PR attempt' },
          { name: 'Bench Press / OHP', sets: 1, reps: '5', restTime: 300 },
          { name: 'Power Clean', sets: 5, reps: '3', restTime: 180 },
        ],
      },
    ],
  },
  {
    id: 'wendler-531',
    name: 'Wendler 5/3/1',
    description: 'Jim Wendler\'s slow and steady strength builder. Monthly progression with AMRAP sets for guaranteed gains.',
    type: ProgramType.STRENGTH,
    difficulty: DifficultyLevel.INTERMEDIATE,
    category: ProgramCategory.POPULAR,
    duration: 16,
    daysPerWeek: 4,
    muscleGroups: ['Chest', 'Back', 'Shoulders', 'Legs'],
    equipment: ['Barbell', 'Squat Rack', 'Bench'],
    tags: ['monthly-progression', 'amrap', 'proven'],
    workouts: [
      {
        week: 1, day: 1, name: 'Squat Day',
        exercises: [
          { name: 'Squats', sets: 3, reps: '5/5/5+', restTime: 180, notes: '65%, 75%, 85% - AMRAP last set' },
          { name: 'Leg Press', sets: 5, reps: '10', restTime: 90 },
          { name: 'Leg Curls', sets: 5, reps: '10', restTime: 60 },
          { name: 'Ab Work', sets: 5, reps: '15', restTime: 45 },
        ],
      },
      {
        week: 1, day: 2, name: 'Bench Day',
        exercises: [
          { name: 'Bench Press', sets: 3, reps: '5/5/5+', restTime: 180, notes: '65%, 75%, 85% - AMRAP last set' },
          { name: 'Dumbbell Press', sets: 5, reps: '10', restTime: 90 },
          { name: 'Dumbbell Rows', sets: 5, reps: '10', restTime: 60 },
          { name: 'Tricep Pushdowns', sets: 5, reps: '15', restTime: 45 },
        ],
      },
      {
        week: 1, day: 3, name: 'Deadlift Day',
        exercises: [
          { name: 'Deadlift', sets: 3, reps: '5/5/5+', restTime: 180, notes: '65%, 75%, 85% - AMRAP last set' },
          { name: 'Good Mornings', sets: 5, reps: '10', restTime: 90 },
          { name: 'Hanging Leg Raises', sets: 5, reps: '15', restTime: 45 },
        ],
      },
      {
        week: 1, day: 4, name: 'OHP Day',
        exercises: [
          { name: 'Overhead Press', sets: 3, reps: '5/5/5+', restTime: 180, notes: '65%, 75%, 85% - AMRAP last set' },
          { name: 'Chin-ups', sets: 5, reps: '10', restTime: 90 },
          { name: 'Dips', sets: 5, reps: '10', restTime: 60 },
          { name: 'Face Pulls', sets: 5, reps: '15', restTime: 45 },
        ],
      },
    ],
  },
  {
    id: 'greyskull-lp',
    name: 'Greyskull LP',
    description: 'Modern twist on Starting Strength with AMRAP final sets. Better for aesthetics while building strength.',
    type: ProgramType.STRENGTH,
    difficulty: DifficultyLevel.BEGINNER,
    category: ProgramCategory.BEGINNER,
    duration: 12,
    daysPerWeek: 3,
    muscleGroups: ['Full Body'],
    equipment: ['Barbell', 'Squat Rack', 'Bench'],
    tags: ['linear-progression', 'amrap', 'beginner-friendly'],
    workouts: [
      {
        week: 1, day: 1, name: 'Workout A',
        exercises: [
          { name: 'Bench Press', sets: 3, reps: '5/5/5+', restTime: 180, notes: 'AMRAP last set' },
          { name: 'Barbell Rows', sets: 3, reps: '5/5/5+', restTime: 180 },
          { name: 'Squats', sets: 3, reps: '5/5/5+', restTime: 180 },
        ],
      },
      {
        week: 1, day: 2, name: 'Workout B',
        exercises: [
          { name: 'Overhead Press', sets: 3, reps: '5/5/5+', restTime: 180, notes: 'AMRAP last set' },
          { name: 'Chin-ups', sets: 3, reps: '6-8', restTime: 120 },
          { name: 'Deadlift', sets: 1, reps: '5+', restTime: 180, notes: 'AMRAP set' },
        ],
      },
      {
        week: 1, day: 3, name: 'Workout A',
        exercises: [
          { name: 'Bench Press', sets: 3, reps: '5/5/5+', restTime: 180 },
          { name: 'Barbell Rows', sets: 3, reps: '5/5/5+', restTime: 180 },
          { name: 'Squats', sets: 3, reps: '5/5/5+', restTime: 180 },
        ],
      },
    ],
  },
  {
    id: 'nSuns-531-lp',
    name: 'nSuns 5/3/1 LP',
    description: 'High volume 5/3/1 variant with T1 and T2 lifts. Aggressive progression for intermediate lifters.',
    type: ProgramType.STRENGTH,
    difficulty: DifficultyLevel.INTERMEDIATE,
    category: ProgramCategory.ADVANCED,
    duration: 12,
    daysPerWeek: 5,
    muscleGroups: ['Full Body'],
    equipment: ['Barbell', 'Squat Rack', 'Bench'],
    tags: ['high-volume', '531-variant', 'aggressive-progression'],
    workouts: [
      {
        week: 1, day: 1, name: 'Bench / OHP',
        exercises: [
          { name: 'Bench Press', sets: 9, reps: '5/3/1 + back-offs', restTime: 120, notes: 'T1 - Main lift' },
          { name: 'Overhead Press', sets: 8, reps: '3-10', restTime: 90, notes: 'T2 - Secondary' },
          { name: 'Chest Accessory', sets: 3, reps: '8-12', restTime: 60 },
          { name: 'Back Accessory', sets: 3, reps: '8-12', restTime: 60 },
        ],
      },
      {
        week: 1, day: 2, name: 'Squat / Sumo DL',
        exercises: [
          { name: 'Squats', sets: 9, reps: '5/3/1 + back-offs', restTime: 180, notes: 'T1' },
          { name: 'Sumo Deadlift', sets: 8, reps: '3-10', restTime: 120, notes: 'T2' },
          { name: 'Leg Accessory', sets: 3, reps: '8-12', restTime: 60 },
        ],
      },
      {
        week: 1, day: 3, name: 'OHP / Incline',
        exercises: [
          { name: 'Overhead Press', sets: 9, reps: '5/3/1 + back-offs', restTime: 120, notes: 'T1' },
          { name: 'Incline Bench', sets: 8, reps: '3-10', restTime: 90, notes: 'T2' },
          { name: 'Shoulder Accessory', sets: 3, reps: '12-15', restTime: 60 },
          { name: 'Back Accessory', sets: 3, reps: '8-12', restTime: 60 },
        ],
      },
      {
        week: 1, day: 4, name: 'Deadlift / Front Squat',
        exercises: [
          { name: 'Deadlift', sets: 9, reps: '5/3/1 + back-offs', restTime: 180, notes: 'T1' },
          { name: 'Front Squats', sets: 8, reps: '3-10', restTime: 120, notes: 'T2' },
          { name: 'Hamstring Accessory', sets: 3, reps: '10-15', restTime: 60 },
        ],
      },
      {
        week: 1, day: 5, name: 'Bench / Close Grip',
        exercises: [
          { name: 'Bench Press', sets: 9, reps: '5/3/1 + back-offs', restTime: 120, notes: 'T1' },
          { name: 'Close Grip Bench', sets: 8, reps: '3-10', restTime: 90, notes: 'T2' },
          { name: 'Tricep Accessory', sets: 3, reps: '10-15', restTime: 60 },
          { name: 'Back Accessory', sets: 3, reps: '8-12', restTime: 60 },
        ],
      },
    ],
  },
];

