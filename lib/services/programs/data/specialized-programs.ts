/**
 * Specialized workout programs
 * Full body, athletic, sport-specific, and other specialized routines
 */

import { WorkoutProgram, ProgramType, DifficultyLevel, ProgramCategory } from '../types';

export const SPECIALIZED_PROGRAMS: WorkoutProgram[] = [
  {
    id: 'full-body-3x',
    name: 'Full Body 3x/Week',
    description: 'Efficient full-body training. Hit every muscle 3 times per week with compound lifts. Great for busy schedules.',
    type: ProgramType.FULL_BODY,
    difficulty: DifficultyLevel.BEGINNER,
    category: ProgramCategory.POPULAR,
    duration: 8,
    daysPerWeek: 3,
    muscleGroups: ['Full Body'],
    equipment: ['Barbell', 'Dumbbells', 'Bench'],
    tags: ['efficient', 'compound', 'frequency'],
    workouts: [
      {
        week: 1, day: 1, name: 'Full Body A',
        exercises: [
          { name: 'Squats', sets: 3, reps: '8-10', restTime: 120 },
          { name: 'Bench Press', sets: 3, reps: '8-10', restTime: 90 },
          { name: 'Barbell Rows', sets: 3, reps: '8-10', restTime: 90 },
          { name: 'Dumbbell Lunges', sets: 2, reps: '10 each', restTime: 60 },
          { name: 'Plank', sets: 3, reps: '30-45 sec', restTime: 45 },
        ],
      },
      {
        week: 1, day: 2, name: 'Full Body B',
        exercises: [
          { name: 'Deadlift', sets: 3, reps: '6-8', restTime: 120 },
          { name: 'Overhead Press', sets: 3, reps: '8-10', restTime: 90 },
          { name: 'Pull-ups/Lat Pulldown', sets: 3, reps: '8-12', restTime: 90 },
          { name: 'Leg Press', sets: 3, reps: '12-15', restTime: 60 },
          { name: 'Face Pulls', sets: 3, reps: '15-20', restTime: 45 },
        ],
      },
      {
        week: 1, day: 3, name: 'Full Body C',
        exercises: [
          { name: 'Front Squats', sets: 3, reps: '8-10', restTime: 120 },
          { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12', restTime: 60 },
          { name: 'Cable Rows', sets: 3, reps: '10-12', restTime: 60 },
          { name: 'Romanian Deadlift', sets: 3, reps: '10-12', restTime: 90 },
          { name: 'Dumbbell Curls', sets: 2, reps: '12-15', restTime: 45 },
          { name: 'Tricep Dips', sets: 2, reps: '12-15', restTime: 45 },
        ],
      },
    ],
  },
  {
    id: 'gzclp',
    name: 'GZCLP',
    description: 'Cody Lefever\'s linear progression. T1/T2/T3 tiered structure for strength and hypertrophy balance.',
    type: ProgramType.STRENGTH,
    difficulty: DifficultyLevel.BEGINNER,
    category: ProgramCategory.STRENGTH,
    duration: 12,
    daysPerWeek: 4,
    muscleGroups: ['Full Body'],
    equipment: ['Barbell', 'Squat Rack', 'Bench'],
    tags: ['tiered', 'linear-progression', 'structured'],
    workouts: [
      {
        week: 1, day: 1, name: 'Day 1',
        exercises: [
          { name: 'Squat (T1)', sets: 5, reps: '3', restTime: 180, notes: 'Main lift - add 5lbs/session' },
          { name: 'Bench Press (T2)', sets: 3, reps: '10', restTime: 120, notes: 'Secondary volume' },
          { name: 'Lat Pulldown (T3)', sets: 3, reps: '15', restTime: 60, notes: 'Accessory' },
        ],
      },
      {
        week: 1, day: 2, name: 'Day 2',
        exercises: [
          { name: 'OHP (T1)', sets: 5, reps: '3', restTime: 180 },
          { name: 'Deadlift (T2)', sets: 3, reps: '10', restTime: 120 },
          { name: 'Dumbbell Row (T3)', sets: 3, reps: '15', restTime: 60 },
        ],
      },
      {
        week: 1, day: 3, name: 'Day 3',
        exercises: [
          { name: 'Bench Press (T1)', sets: 5, reps: '3', restTime: 180 },
          { name: 'Squat (T2)', sets: 3, reps: '10', restTime: 120 },
          { name: 'Leg Curl (T3)', sets: 3, reps: '15', restTime: 60 },
        ],
      },
      {
        week: 1, day: 4, name: 'Day 4',
        exercises: [
          { name: 'Deadlift (T1)', sets: 5, reps: '3', restTime: 180 },
          { name: 'OHP (T2)', sets: 3, reps: '10', restTime: 120 },
          { name: 'Cable Fly (T3)', sets: 3, reps: '15', restTime: 60 },
        ],
      },
    ],
  },
  {
    id: 'fierce-5',
    name: 'Fierce 5',
    description: 'A refined beginner program with dedicated squat and deadlift days. Better than SL5x5 for many.',
    type: ProgramType.STRENGTH,
    difficulty: DifficultyLevel.BEGINNER,
    category: ProgramCategory.BEGINNER,
    duration: 12,
    daysPerWeek: 3,
    muscleGroups: ['Full Body'],
    equipment: ['Barbell', 'Dumbbells', 'Cable Machine'],
    tags: ['linear-progression', 'beginner', 'balanced'],
    workouts: [
      {
        week: 1, day: 1, name: 'Workout A',
        exercises: [
          { name: 'Squat', sets: 3, reps: '5', restTime: 180 },
          { name: 'Bench Press', sets: 3, reps: '5', restTime: 180 },
          { name: 'Pendlay Row', sets: 3, reps: '5', restTime: 180 },
          { name: 'Face Pulls', sets: 3, reps: '10-15', restTime: 60 },
          { name: 'Calf Work', sets: 2, reps: '15-20', restTime: 45 },
        ],
      },
      {
        week: 1, day: 2, name: 'Workout B',
        exercises: [
          { name: 'Front Squat', sets: 3, reps: '5', restTime: 180 },
          { name: 'Overhead Press', sets: 3, reps: '5', restTime: 180 },
          { name: 'Romanian Deadlift', sets: 3, reps: '8', restTime: 120 },
          { name: 'Lat Pulldown', sets: 3, reps: '8-10', restTime: 60 },
          { name: 'Ab Work', sets: 2, reps: '15-20', restTime: 45 },
        ],
      },
      {
        week: 1, day: 3, name: 'Workout C',
        exercises: [
          { name: 'Squat', sets: 3, reps: '5', restTime: 180 },
          { name: 'Bench Press', sets: 3, reps: '5', restTime: 180 },
          { name: 'Deadlift', sets: 1, reps: '5', restTime: 300, notes: 'One heavy set' },
          { name: 'Face Pulls', sets: 3, reps: '10-15', restTime: 60 },
          { name: 'Bicep Curls', sets: 2, reps: '10-12', restTime: 45 },
        ],
      },
    ],
  },
  {
    id: 'athletic-conditioning',
    name: 'Athletic Conditioning',
    description: 'Build explosive power, speed, and endurance. Perfect for athletes or fitness enthusiasts.',
    type: ProgramType.ATHLETIC,
    difficulty: DifficultyLevel.INTERMEDIATE,
    category: ProgramCategory.SPORT,
    duration: 8,
    daysPerWeek: 4,
    muscleGroups: ['Full Body'],
    equipment: ['Barbell', 'Kettlebells', 'Box', 'Med Ball'],
    tags: ['explosive', 'conditioning', 'athletic'],
    workouts: [
      {
        week: 1, day: 1, name: 'Power Day',
        exercises: [
          { name: 'Box Jumps', sets: 5, reps: '3', restTime: 120 },
          { name: 'Power Clean', sets: 5, reps: '3', restTime: 120 },
          { name: 'Push Press', sets: 4, reps: '5', restTime: 90 },
          { name: 'Med Ball Slams', sets: 3, reps: '10', restTime: 60 },
          { name: 'Sprint Intervals', sets: 6, reps: '30 sec', restTime: 90, notes: 'On/Off' },
        ],
      },
      {
        week: 1, day: 2, name: 'Strength Day',
        exercises: [
          { name: 'Squat', sets: 5, reps: '5', restTime: 180 },
          { name: 'Romanian Deadlift', sets: 4, reps: '6-8', restTime: 120 },
          { name: 'Single Leg Press', sets: 3, reps: '10 each', restTime: 90 },
          { name: 'Nordic Curls', sets: 3, reps: '6-8', restTime: 90 },
          { name: 'Planks', sets: 3, reps: '45 sec', restTime: 45 },
        ],
      },
      {
        week: 1, day: 3, name: 'Upper Power',
        exercises: [
          { name: 'Bench Press', sets: 5, reps: '3', restTime: 180 },
          { name: 'Weighted Pull-ups', sets: 5, reps: '3', restTime: 180 },
          { name: 'Med Ball Chest Pass', sets: 4, reps: '8', restTime: 60 },
          { name: 'Plyo Push-ups', sets: 3, reps: '8', restTime: 90 },
          { name: 'Battle Ropes', sets: 4, reps: '30 sec', restTime: 60 },
        ],
      },
      {
        week: 1, day: 4, name: 'Conditioning',
        exercises: [
          { name: 'Kettlebell Swings', sets: 5, reps: '15', restTime: 45 },
          { name: 'Burpees', sets: 4, reps: '10', restTime: 45 },
          { name: 'Sled Push', sets: 4, reps: '40m', restTime: 90 },
          { name: 'Farmer Carries', sets: 3, reps: '40m', restTime: 60 },
          { name: 'Rowing Intervals', sets: 5, reps: '500m', restTime: 120 },
        ],
      },
    ],
  },
  {
    id: 'phat',
    name: 'PHAT (Power Hypertrophy Adaptive)',
    description: 'Layne Norton\'s 5-day program. Combines powerlifting and bodybuilding for strength and size.',
    type: ProgramType.HYPERTROPHY,
    difficulty: DifficultyLevel.ADVANCED,
    category: ProgramCategory.ADVANCED,
    duration: 12,
    daysPerWeek: 5,
    muscleGroups: ['Full Body'],
    equipment: ['Full Gym'],
    tags: ['powerbuilding', 'advanced', 'high-volume'],
    workouts: [
      {
        week: 1, day: 1, name: 'Upper Power',
        exercises: [
          { name: 'Pendlay Rows', sets: 3, reps: '3-5', restTime: 180 },
          { name: 'Weighted Pull-ups', sets: 2, reps: '6-10', restTime: 120 },
          { name: 'Rack Chins', sets: 2, reps: '6-10', restTime: 90 },
          { name: 'Flat Bench Press', sets: 3, reps: '3-5', restTime: 180 },
          { name: 'Weighted Dips', sets: 2, reps: '6-10', restTime: 90 },
          { name: 'Seated Dumbbell Press', sets: 3, reps: '6-10', restTime: 90 },
          { name: 'Cambered Bar Curls', sets: 3, reps: '6-10', restTime: 60 },
          { name: 'Skull Crushers', sets: 3, reps: '6-10', restTime: 60 },
        ],
      },
      {
        week: 1, day: 2, name: 'Lower Power',
        exercises: [
          { name: 'Squats', sets: 3, reps: '3-5', restTime: 180 },
          { name: 'Hack Squats', sets: 2, reps: '6-10', restTime: 120 },
          { name: 'Leg Press', sets: 2, reps: '6-10', restTime: 90 },
          { name: 'Stiff Leg Deadlifts', sets: 3, reps: '5-8', restTime: 120 },
          { name: 'Lying Leg Curls', sets: 2, reps: '6-10', restTime: 60 },
          { name: 'Standing Calf Raises', sets: 3, reps: '6-10', restTime: 60 },
          { name: 'Seated Calf Raises', sets: 2, reps: '6-10', restTime: 45 },
        ],
      },
      {
        week: 1, day: 3, name: 'Back & Shoulders Hypertrophy',
        exercises: [
          { name: 'Speed Pendlay Rows', sets: 6, reps: '3', restTime: 60, notes: '65-70% max' },
          { name: 'Rack Chins', sets: 3, reps: '8-12', restTime: 60 },
          { name: 'Seated Cable Row', sets: 3, reps: '8-12', restTime: 60 },
          { name: 'Dumbbell Rows', sets: 2, reps: '12-15', restTime: 45 },
          { name: 'Close Grip Pulldowns', sets: 2, reps: '15-20', restTime: 45 },
          { name: 'Seated Dumbbell Press', sets: 3, reps: '8-12', restTime: 60 },
          { name: 'Upright Rows', sets: 2, reps: '12-15', restTime: 45 },
          { name: 'Side Lateral Raises', sets: 3, reps: '12-20', restTime: 30 },
        ],
      },
      {
        week: 1, day: 4, name: 'Lower Hypertrophy',
        exercises: [
          { name: 'Speed Squats', sets: 6, reps: '3', restTime: 60, notes: '65-70% max' },
          { name: 'Hack Squats', sets: 3, reps: '8-12', restTime: 90 },
          { name: 'Leg Press', sets: 2, reps: '12-15', restTime: 60 },
          { name: 'Leg Extensions', sets: 3, reps: '15-20', restTime: 45 },
          { name: 'Romanian Deadlifts', sets: 3, reps: '8-12', restTime: 90 },
          { name: 'Lying Leg Curls', sets: 2, reps: '12-15', restTime: 45 },
          { name: 'Seated Leg Curls', sets: 2, reps: '15-20', restTime: 45 },
          { name: 'Donkey Calf Raises', sets: 4, reps: '10-15', restTime: 45 },
          { name: 'Seated Calf Raises', sets: 3, reps: '15-20', restTime: 30 },
        ],
      },
      {
        week: 1, day: 5, name: 'Chest & Arms Hypertrophy',
        exercises: [
          { name: 'Speed Bench Press', sets: 6, reps: '3', restTime: 60, notes: '65-70% max' },
          { name: 'Incline Dumbbell Press', sets: 3, reps: '8-12', restTime: 60 },
          { name: 'Hammer Strength Chest', sets: 3, reps: '12-15', restTime: 45 },
          { name: 'Incline Cable Flyes', sets: 2, reps: '15-20', restTime: 30 },
          { name: 'Cambered Bar Preacher Curls', sets: 3, reps: '8-12', restTime: 60 },
          { name: 'Dumbbell Concentration Curls', sets: 2, reps: '12-15', restTime: 45 },
          { name: 'Spider Curls', sets: 2, reps: '15-20', restTime: 30 },
          { name: 'Seated Tricep Extension', sets: 3, reps: '8-12', restTime: 60 },
          { name: 'Cable Pressdowns', sets: 2, reps: '12-15', restTime: 45 },
          { name: 'Cable Kickbacks', sets: 2, reps: '15-20', restTime: 30 },
        ],
      },
    ],
  },
  {
    id: 'kettlebell-simple',
    name: 'Simple & Sinister',
    description: 'Pavel\'s minimalist kettlebell program. Just swings and get-ups, but devastatingly effective.',
    type: ProgramType.ATHLETIC,
    difficulty: DifficultyLevel.BEGINNER,
    category: ProgramCategory.SPECIALIZED,
    duration: 12,
    daysPerWeek: 6,
    muscleGroups: ['Full Body'],
    equipment: ['Kettlebell'],
    tags: ['kettlebell', 'minimalist', 'daily'],
    workouts: [
      {
        week: 1, day: 1, name: 'Practice',
        exercises: [
          { name: 'Goblet Squats (Warmup)', sets: 3, reps: '5', restTime: 60 },
          { name: 'Hip Bridges (Warmup)', sets: 3, reps: '5', restTime: 30 },
          { name: 'Halos (Warmup)', sets: 3, reps: '5 each', restTime: 30 },
          { name: 'One-Arm Swings', sets: 10, reps: '10', restTime: 30, notes: 'Total 100 reps' },
          { name: 'Turkish Get-Up', sets: 5, reps: '1 each', restTime: 60, notes: 'Alternating sides' },
        ],
      },
      {
        week: 1, day: 2, name: 'Practice',
        exercises: [
          { name: 'Goblet Squats (Warmup)', sets: 3, reps: '5', restTime: 60 },
          { name: 'Hip Bridges (Warmup)', sets: 3, reps: '5', restTime: 30 },
          { name: 'Halos (Warmup)', sets: 3, reps: '5 each', restTime: 30 },
          { name: 'One-Arm Swings', sets: 10, reps: '10', restTime: 30 },
          { name: 'Turkish Get-Up', sets: 5, reps: '1 each', restTime: 60 },
        ],
      },
      {
        week: 1, day: 3, name: 'Practice',
        exercises: [
          { name: 'Goblet Squats (Warmup)', sets: 3, reps: '5', restTime: 60 },
          { name: 'Hip Bridges (Warmup)', sets: 3, reps: '5', restTime: 30 },
          { name: 'Halos (Warmup)', sets: 3, reps: '5 each', restTime: 30 },
          { name: 'One-Arm Swings', sets: 10, reps: '10', restTime: 30 },
          { name: 'Turkish Get-Up', sets: 5, reps: '1 each', restTime: 60 },
        ],
      },
      {
        week: 1, day: 4, name: 'Practice',
        exercises: [
          { name: 'Goblet Squats (Warmup)', sets: 3, reps: '5', restTime: 60 },
          { name: 'Hip Bridges (Warmup)', sets: 3, reps: '5', restTime: 30 },
          { name: 'Halos (Warmup)', sets: 3, reps: '5 each', restTime: 30 },
          { name: 'One-Arm Swings', sets: 10, reps: '10', restTime: 30 },
          { name: 'Turkish Get-Up', sets: 5, reps: '1 each', restTime: 60 },
        ],
      },
      {
        week: 1, day: 5, name: 'Practice',
        exercises: [
          { name: 'Goblet Squats (Warmup)', sets: 3, reps: '5', restTime: 60 },
          { name: 'Hip Bridges (Warmup)', sets: 3, reps: '5', restTime: 30 },
          { name: 'Halos (Warmup)', sets: 3, reps: '5 each', restTime: 30 },
          { name: 'One-Arm Swings', sets: 10, reps: '10', restTime: 30 },
          { name: 'Turkish Get-Up', sets: 5, reps: '1 each', restTime: 60 },
        ],
      },
      {
        week: 1, day: 6, name: 'Practice',
        exercises: [
          { name: 'Goblet Squats (Warmup)', sets: 3, reps: '5', restTime: 60 },
          { name: 'Hip Bridges (Warmup)', sets: 3, reps: '5', restTime: 30 },
          { name: 'Halos (Warmup)', sets: 3, reps: '5 each', restTime: 30 },
          { name: 'One-Arm Swings', sets: 10, reps: '10', restTime: 30 },
          { name: 'Turkish Get-Up', sets: 5, reps: '1 each', restTime: 60 },
        ],
      },
    ],
  },
];

