/**
 * Additional workout programs
 * More variety for users to choose from
 */

import { WorkoutProgram, ProgramType, DifficultyLevel, ProgramCategory } from '../types';

export const MORE_PROGRAMS: WorkoutProgram[] = [
  // ============================================
  // BEGINNER PROGRAMS
  // ============================================
  {
    id: 'couch-to-fit',
    name: 'Couch to Fit (4 Weeks)',
    description: 'Perfect for absolute beginners. Start your fitness journey with simple movements and build habits.',
    type: ProgramType.FULL_BODY,
    difficulty: DifficultyLevel.BEGINNER,
    category: ProgramCategory.BEGINNER,
    duration: 16,
    daysPerWeek: 5,
    muscleGroups: ['Full Body'],
    equipment: ['None', 'Light Dumbbells (optional)'],
    workouts: [],
    tags: ['absolute-beginner', 'habit-building', 'low-impact'],
  },
  {
    id: 'machine-only-beginner',
    name: 'Machine-Only Beginner',
    description: 'Learn proper movement patterns using machines. Great for gym newbies who are intimidated by free weights.',
    type: ProgramType.HYPERTROPHY,
    difficulty: DifficultyLevel.BEGINNER,
    category: ProgramCategory.BEGINNER,
    duration: 12,
    daysPerWeek: 1,
    muscleGroups: ['Full Body'],
    equipment: ['Gym Machines'],
    workouts: [],
    tags: ['machines', 'safe', 'beginner-friendly'],
  },

  // ============================================
  // DUMBBELL ONLY PROGRAMS
  // ============================================
  {
    id: 'dumbbell-only-ppl',
    name: 'Dumbbell Only PPL',
    description: 'Full Push/Pull/Legs split using only dumbbells. Perfect for home gyms or hotel workouts.',
    type: ProgramType.HYPERTROPHY,
    difficulty: DifficultyLevel.INTERMEDIATE,
    category: ProgramCategory.MUSCLE_BUILDING,
    duration: 12,
    daysPerWeek: 3,
    muscleGroups: ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs'],
    equipment: ['Dumbbells', 'Adjustable Bench'],
    workouts: [],
    tags: ['dumbbells', 'home-gym', 'minimal-equipment'],
  },
  {
    id: 'dumbbell-full-body',
    name: 'Dumbbell Full Body 3x',
    description: 'Simple and effective full-body workouts using only dumbbells. 3 days per week.',
    type: ProgramType.FULL_BODY,
    difficulty: DifficultyLevel.BEGINNER,
    category: ProgramCategory.BEGINNER,
    duration: 8,
    daysPerWeek: 3,
    muscleGroups: ['Full Body'],
    equipment: ['Dumbbells'],
    workouts: [],
    tags: ['dumbbells', 'simple', 'efficient'],
  },

  // ============================================
  // SPECIFIC GOAL PROGRAMS
  // ============================================
  {
    id: 'arm-specialization',
    name: 'Arm Specialization',
    description: 'Focus on building bigger arms while maintaining overall fitness. Extra arm volume.',
    type: ProgramType.HYPERTROPHY,
    difficulty: DifficultyLevel.INTERMEDIATE,
    category: ProgramCategory.SPECIALIZED,
    duration: 8,
    daysPerWeek: 5,
    muscleGroups: ['Arms', 'Chest', 'Back', 'Legs'],
    equipment: ['Barbell', 'Dumbbells', 'Cable Machine'],
    workouts: [],
    tags: ['arms', 'biceps', 'triceps', 'specialization'],
  },
  {
    id: 'back-width-thickness',
    name: 'Back Width & Thickness',
    description: 'Build a wide, thick back with pull emphasis. V-taper focus.',
    type: ProgramType.HYPERTROPHY,
    difficulty: DifficultyLevel.INTERMEDIATE,
    category: ProgramCategory.SPECIALIZED,
    duration: 16,
    daysPerWeek: 4,
    muscleGroups: ['Back', 'Chest', 'Shoulders', 'Legs'],
    equipment: ['Full Gym'],
    workouts: [],
    tags: ['back', 'lats', 'v-taper', 'width'],
  },
  {
    id: 'glute-builder',
    name: 'Glute Builder',
    description: 'Target and grow your glutes with hip-dominant movements and isolation work.',
    type: ProgramType.HYPERTROPHY,
    difficulty: DifficultyLevel.INTERMEDIATE,
    category: ProgramCategory.SPECIALIZED,
    duration: 12,
    daysPerWeek: 7,
    muscleGroups: ['Glutes', 'Legs', 'Core'],
    equipment: ['Barbell', 'Dumbbells', 'Resistance Bands', 'Cable Machine'],
    workouts: [],
    tags: ['glutes', 'booty', 'lower-body'],
  },

  // ============================================
  // QUICK WORKOUTS
  // ============================================
  {
    id: '30-min-full-body',
    name: '30-Minute Full Body',
    description: 'Get in, get out. Efficient full-body workouts for busy people.',
    type: ProgramType.FULL_BODY,
    difficulty: DifficultyLevel.BEGINNER,
    category: ProgramCategory.BEGINNER,
    duration: 12,
    daysPerWeek: 2,
    muscleGroups: ['Full Body'],
    equipment: ['Barbell', 'Dumbbells'],
    workouts: [],
    tags: ['quick', 'efficient', 'busy'],
  },
  {
    id: 'lunch-break-workout',
    name: 'Lunch Break Workout',
    description: '20-25 minute workouts you can do during lunch. Minimal equipment, maximum results.',
    type: ProgramType.FULL_BODY,
    difficulty: DifficultyLevel.BEGINNER,
    category: ProgramCategory.BEGINNER,
    duration: 16,
    daysPerWeek: 6,
    muscleGroups: ['Full Body'],
    equipment: ['Dumbbells (optional)'],
    workouts: [],
    tags: ['quick', 'lunch', 'office'],
  },

  // ============================================
  // SPORT-SPECIFIC
  // ============================================
  {
    id: 'basketball-training',
    name: 'Basketball Athletic Training',
    description: 'Improve vertical jump, explosiveness, and court endurance for basketball.',
    type: ProgramType.ATHLETIC,
    difficulty: DifficultyLevel.INTERMEDIATE,
    category: ProgramCategory.SPORT,
    duration: 12,
    daysPerWeek: 4,
    muscleGroups: ['Legs', 'Core', 'Upper Body'],
    equipment: ['Barbell', 'Dumbbells', 'Box', 'Resistance Bands'],
    workouts: [],
    tags: ['basketball', 'vertical', 'explosiveness'],
  },
  {
    id: 'golf-fitness',
    name: 'Golf Fitness Program',
    description: 'Improve rotational power, hip mobility, and core stability for better golf performance.',
    type: ProgramType.ATHLETIC,
    difficulty: DifficultyLevel.BEGINNER,
    category: ProgramCategory.SPORT,
    duration: 4,
    daysPerWeek: 4,
    muscleGroups: ['Core', 'Hips', 'Shoulders', 'Back'],
    equipment: ['Dumbbells', 'Resistance Bands', 'Med Ball'],
    workouts: [],
    tags: ['golf', 'rotational', 'mobility'],
  },
  {
    id: 'soccer-conditioning',
    name: 'Soccer Conditioning',
    description: 'Build endurance, speed, and leg power for soccer players.',
    type: ProgramType.ATHLETIC,
    difficulty: DifficultyLevel.INTERMEDIATE,
    category: ProgramCategory.SPORT,
    duration: 8,
    daysPerWeek: 5,
    muscleGroups: ['Legs', 'Core', 'Full Body'],
    equipment: ['Barbell', 'Dumbbells', 'Cones'],
    workouts: [],
    tags: ['soccer', 'endurance', 'speed'],
  },

  // ============================================
  // MOBILITY & RECOVERY
  // ============================================
  {
    id: 'mobility-flexibility',
    name: 'Mobility & Flexibility',
    description: 'Improve range of motion and reduce injury risk. Great as a supplement to strength training.',
    type: ProgramType.MOBILITY,
    difficulty: DifficultyLevel.BEGINNER,
    category: ProgramCategory.SPECIALIZED,
    duration: 7,
    daysPerWeek: 5,
    muscleGroups: ['Full Body'],
    equipment: ['Foam Roller', 'Resistance Bands', 'Yoga Mat'],
    workouts: [],
    tags: ['mobility', 'flexibility', 'recovery'],
  },
];

