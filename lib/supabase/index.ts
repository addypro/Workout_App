// Supabase client and services
export { supabase } from './client';
export type { User, Session } from './client';

// Types
export * from './types';

// Services
export * as programsService from './services/programs';
export * as exercisesService from './services/exercises';
export * as workoutLogsService from './services/workout-logs';
export * as authService from './services/auth';
