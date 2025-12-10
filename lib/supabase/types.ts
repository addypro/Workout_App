// Database types generated from Prisma schema
// These types match the Supabase PostgreSQL tables

export type UserRole = 'CONSUMER' | 'COACH';
export type SourceType = 'PDF' | 'CSV' | 'EXCEL' | 'IMAGE';
export type ProgramStatus = 'PARSING' | 'MAPPING' | 'READY' | 'ERROR';
export type MembershipTier = 'FREE' | 'BASIC' | 'PREMIUM';
export type FitnessGoal = 'WEIGHT_LOSS' | 'MUSCLE_GAIN' | 'STRENGTH' | 'ENDURANCE' | 'GENERAL_FITNESS' | 'FLEXIBILITY';
export type FitnessLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';

// Database row types (what comes from Supabase)
export interface DbUser {
  id: string;
  email: string;
  name: string | null;
  password: string;
  role: UserRole;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DbProgram {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  sourceFileUri: string;
  sourceType: SourceType;
  status: ProgramStatus;
  parsedData: ParsedProgramData | null;
  createdAt: string;
  updatedAt: string;
}

export interface DbExerciseDatabase {
  id: string;
  name: string;
  aliases: string[];
  category: string | null;
  equipment: string[];
  muscleGroups: string[] | null;
  videoUrl: string | null;
  instructions: string | null;
  createdAt: string;
}

export interface DbUserProfile {
  id: string;
  userId: string;
  fitnessGoal: FitnessGoal | null;
  fitnessLevel: FitnessLevel | null;
  age: number | null;
  height: number | null;
  weight: number | null;
  bio: string | null;
  location: string | null;
  preferredWorkoutTime: string | null;
  workoutDaysPerWeek: number | null;
  preferredEquipment: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DbWorkoutLog {
  id: string;
  userId: string;
  programId: string | null;
  workoutId: string | null;
  week: number | null;
  day: number | null;
  completedAt: string;
  duration: number | null;
  notes: string | null;
  rating: number | null;
}

export interface DbWorkoutLogExercise {
  id: string;
  workoutLogId: string;
  exerciseName: string;
  sets: number;
  reps: string | null;
  weight: string | null;
  completed: boolean;
  notes: string | null;
  rpe: number | null;
  order: number;
}

export interface DbActivity {
  id: string;
  userId: string;
  date: string;
  steps: number | null;
  calories: number | null;
  heartRate: number | null;
  distance: number | null;
  activeMinutes: number | null;
  source: string | null;
  sourceId: string | null;
  createdAt: string;
}

export interface DbMembership {
  id: string;
  userId: string;
  tier: MembershipTier;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DbChallenge {
  id: string;
  createdById: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  goal: string | null;
  rules: Record<string, unknown> | null;
  isActive: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DbChallengeParticipant {
  id: string;
  userId: string;
  challengeId: string;
  progress: Record<string, unknown> | null;
  completed: boolean;
  completedAt: string | null;
  joinedAt: string;
}

// Parsed data types (stored as JSONB in database)
export interface ParsedProgramData {
  name: string;
  description?: string;
  workouts: ParsedWorkout[];
}

export interface ParsedWorkout {
  week: number;
  day: number;
  name?: string;
  exercises: ParsedExercise[];
  order: number;
}

export interface ParsedExercise {
  name: string;
  originalName?: string;
  sets: number;
  reps?: string;
  weight?: string;
  restSeconds?: number;
  notes?: string;
  order: number;
}

// Input types for creating/updating records
export interface CreateProgramInput {
  userId: string;
  name: string;
  description?: string;
  sourceFileUri: string;
  sourceType: SourceType;
  status?: ProgramStatus;
  parsedData?: ParsedProgramData;
}

export interface UpdateProgramInput {
  name?: string;
  description?: string;
  status?: ProgramStatus;
  parsedData?: ParsedProgramData;
}

export interface CreateWorkoutLogInput {
  userId: string;
  programId?: string;
  workoutId?: string;
  week?: number;
  day?: number;
  duration?: number;
  notes?: string;
  rating?: number;
  exercises: CreateWorkoutLogExerciseInput[];
}

export interface CreateWorkoutLogExerciseInput {
  exerciseName: string;
  sets: number;
  reps?: string;
  weight?: string;
  completed?: boolean;
  notes?: string;
  rpe?: number;
  order: number;
}

export interface CreateUserProfileInput {
  userId: string;
  fitnessGoal?: FitnessGoal;
  fitnessLevel?: FitnessLevel;
  age?: number;
  height?: number;
  weight?: number;
  bio?: string;
  location?: string;
  preferredWorkoutTime?: string;
  workoutDaysPerWeek?: number;
  preferredEquipment?: string[];
}

// Response types with relations
export interface ProgramWithDetails extends DbProgram {
  user?: DbUser;
  workoutLogs?: DbWorkoutLog[];
}

export interface WorkoutLogWithExercises extends DbWorkoutLog {
  exercises: DbWorkoutLogExercise[];
  program?: DbProgram;
}

export interface UserWithProfile extends DbUser {
  profile?: DbUserProfile;
  membership?: DbMembership;
}
