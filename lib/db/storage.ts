// Storage utilities using AsyncStorage for React Native
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SyncableWorkout } from '@/lib/services/sync/types';
import type { SetType } from '@/lib/types/workout-session';

import { ensureStorageTables, getDatabase } from '@/lib/db/sqlite';

const PROGRAMS_KEY = '@workout_programs';

// Sync callback for workout completion
type WorkoutSyncCallback = (workout: SyncableWorkout) => Promise<void>;
let syncCallback: WorkoutSyncCallback | null = null;

/**
 * Register a callback to be called when workouts are saved
 * Used by the sync service to queue workouts for syncing
 */
export function registerWorkoutSyncCallback(callback: WorkoutSyncCallback): void {
  syncCallback = callback;
}

/**
 * Unregister the sync callback
 */
export function unregisterWorkoutSyncCallback(): void {
  syncCallback = null;
}
const PROGRAM_TEMPLATES_KEY_PREFIX = '@workout_program_templates:'; // + userId
const WORKOUT_PENDING_EDITS_KEY_PREFIX = '@workout_pending_edits:'; // + userId + ':' + programId
const ACTIVE_WORKOUT_KEY_PREFIX = '@active_workout:'; // + userId + ':' + programId
const WORKOUT_HISTORY_KEY_PREFIX = '@workout_history:'; // + programId

async function getStorageDb() {
  const db = await getDatabase();
  if (!db) {
    return null;
  }

  const ready = await ensureStorageTables();
  if (!ready) {
    return null;
  }

  return db;
}

type WorkoutHistoryRow = {
  week: number;
  day: number;
  completed_at: string;
  duration_seconds: number | null;
};

type ProgramRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  source_file_uri: string | null;
  source_type: Program['sourceType'];
  status: Program['status'];
  parsed_data: string;
  created_at: string;
  updated_at: string;
};

type ProgramTemplateRow = {
  id: string;
  user_id: string;
  base_program_id: string;
  name: string;
  description: string | null;
  parsed_data: string;
  created_at: string;
  updated_at: string;
};

type PendingEditsRow = {
  parsed_data: string;
};

type ActiveWorkoutRow = {
  state_json: string;
};

type ActiveWorkoutListRow = {
  program_id: string;
  state_json: string;
  updated_at: string;
};

type UnifiedHistoryRow = {
  id: string;
  user_id: string;
  type: string;
  program_id: string | null;
  program_name: string | null;
  workout_name: string;
  week: number | null;
  day: number | null;
  completed_at: string;
  duration_seconds: number;
  exercises_json: string;
  difficulty: string | null;
  notes: string | null;
  total_volume: number | null;
  gym_id: string | null;
  gym_name: string | null;
};

type SavedWorkoutTemplateRow = {
  id: string;
  user_id: string;
  name: string;
  exercises_json: string;
  created_at: string;
};

export interface Program {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  sourceFileUri: string | null;
  sourceType: 'CSV' | 'PDF' | 'EXCEL' | 'IMAGE' | 'KAGGLE' | 'BUILTIN';
  status: 'PARSING' | 'MAPPING' | 'READY' | 'ERROR';
  parsedData: any;
  createdAt: string;
  updatedAt: string;
}

export interface ProgramTemplate {
  id: string;
  userId: string;
  /** The original saved program this template customizes */
  baseProgramId: string;
  name: string;
  description: string | null;
  /** Same shape as Program.parsedData (workouts/exercises), but user-edited */
  parsedData: any;
  createdAt: string;
  updatedAt: string;
}

function mapProgramRow(row: ProgramRow): Program {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    sourceFileUri: row.source_file_uri,
    sourceType: row.source_type,
    status: row.status,
    parsedData: JSON.parse(row.parsed_data),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProgramTemplateRow(row: ProgramTemplateRow): ProgramTemplate {
  return {
    id: row.id,
    userId: row.user_id,
    baseProgramId: row.base_program_id,
    name: row.name,
    description: row.description,
    parsedData: JSON.parse(row.parsed_data),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadProgramsFromAsyncStorage(): Promise<Program[]> {
  try {
    const data = await AsyncStorage.getItem(PROGRAMS_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading programs:', error);
    return [];
  }
}

async function loadProgramTemplatesFromAsyncStorage(userId: string): Promise<ProgramTemplate[]> {
  try {
    const data = await AsyncStorage.getItem(templatesKey(userId));
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading program templates:', error);
    return [];
  }
}

type StoredWorkoutSet = {
  id: string;
  reps: number | string;
  weight?: number;
  isCompleted: boolean;
  completedAt?: string;
  actualReps?: number;
  actualWeight?: number;
  rpe?: number;
};

type StoredWorkoutExercise = {
  id: string;
  name: string;
  sets: StoredWorkoutSet[];
  restTime: number;
  notes?: string;
  videoUrl?: string;
  muscleGroups?: string[];
  equipment?: string[];
  currentSetIndex: number;
};

export type StoredWorkoutSession = {
  id: string;
  programId?: string;
  workoutName: string;
  exercises: StoredWorkoutExercise[];
  startTime: string;
  endTime?: string;
  currentExerciseIndex: number;
  isResting: boolean;
  restTimeRemaining: number;
  status: 'in_progress' | 'paused' | 'completed' | 'cancelled';
};

export type ActiveWorkoutState = {
  session: StoredWorkoutSession;
  elapsedSeconds: number;
  /** epoch ms of last persist tick (used to catch up elapsed time when restored) */
  lastUpdatedAt: number;
};

export type WorkoutCompletion = {
  week: number;
  day: number;
  completedAt: string;
  durationSeconds?: number;
};

export type WorkoutHistory = {
  programId: string;
  completions: WorkoutCompletion[];
};

export async function getPrograms(): Promise<Program[]> {
  const db = await getStorageDb();
  if (db) {
    try {
      const rows = await db.getAllAsync<ProgramRow>(
        `SELECT id, user_id, name, description, source_file_uri, source_type, status,
            parsed_data, created_at, updated_at
         FROM programs
         ORDER BY updated_at DESC`
      );

      if (rows.length > 0) {
        return rows.map(mapProgramRow);
      }

      const legacy = await loadProgramsFromAsyncStorage();
      if (legacy.length > 0) {
        await db.withTransactionAsync(async () => {
          for (const program of legacy) {
            await db.runAsync(
              `INSERT OR REPLACE INTO programs (
                id, user_id, name, description, source_file_uri, source_type, status,
                parsed_data, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                program.id,
                program.userId,
                program.name,
                program.description,
                program.sourceFileUri,
                program.sourceType,
                program.status,
                JSON.stringify(program.parsedData),
                program.createdAt,
                program.updatedAt,
              ]
            );
          }
        });
      }

      return legacy;
    } catch (error) {
      console.error('Error loading programs:', error);
    }
  }

  return loadProgramsFromAsyncStorage();
}

export async function getProgram(id: string): Promise<Program | null> {
  const db = await getStorageDb();
  if (db) {
    try {
      const row = await db.getFirstAsync<ProgramRow>(
        `SELECT id, user_id, name, description, source_file_uri, source_type, status,
            parsed_data, created_at, updated_at
         FROM programs
         WHERE id = ?`,
        [id]
      );
      return row ? mapProgramRow(row) : null;
    } catch (error) {
      console.error('Error loading program:', error);
    }
  }

  try {
    const programs = await getPrograms();
    return programs.find(p => p.id === id) || null;
  } catch (error) {
    console.error('Error loading program:', error);
    return null;
  }
}

export async function getProgramByName(name: string): Promise<Program | null> {
  const db = await getStorageDb();
  if (db) {
    try {
      const row = await db.getFirstAsync<ProgramRow>(
        `SELECT id, user_id, name, description, source_file_uri, source_type, status,
            parsed_data, created_at, updated_at
         FROM programs
         WHERE lower(name) = lower(?)`,
        [name]
      );
      return row ? mapProgramRow(row) : null;
    } catch (error) {
      console.error('Error finding program by name:', error);
    }
  }

  try {
    const programs = await getPrograms();
    return programs.find(p => p.name.toLowerCase() === name.toLowerCase()) || null;
  } catch (error) {
    console.error('Error finding program by name:', error);
    return null;
  }
}

/**
 * Get programs that were uploaded by the user (CSV, Excel, etc.)
 */
export async function getUploadedPrograms(): Promise<Program[]> {
  const db = await getStorageDb();
  if (db) {
    try {
      const rows = await db.getAllAsync<ProgramRow>(
        `SELECT id, user_id, name, description, source_file_uri, source_type, status,
            parsed_data, created_at, updated_at
         FROM programs
         WHERE source_type IN ('CSV', 'PDF', 'EXCEL')
         ORDER BY updated_at DESC`
      );
      return rows.map(mapProgramRow);
    } catch (error) {
      console.error('Error loading uploaded programs:', error);
    }
  }

  try {
    const programs = await getPrograms();
    return programs.filter(p => p.sourceType === 'CSV' || p.sourceType === 'PDF' || p.sourceType === 'EXCEL');
  } catch (error) {
    console.error('Error loading uploaded programs:', error);
    return [];
  }
}

export async function saveProgram(program: Omit<Program, 'id' | 'createdAt' | 'updatedAt'>): Promise<Program> {
  const newProgram: Program = {
    ...program,
    id: `prog-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const db = await getStorageDb();
  if (db) {
    try {
      await db.runAsync(
        `INSERT OR REPLACE INTO programs (
          id, user_id, name, description, source_file_uri, source_type, status,
          parsed_data, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newProgram.id,
          newProgram.userId,
          newProgram.name,
          newProgram.description,
          newProgram.sourceFileUri,
          newProgram.sourceType,
          newProgram.status,
          JSON.stringify(newProgram.parsedData),
          newProgram.createdAt,
          newProgram.updatedAt,
        ]
      );
      return newProgram;
    } catch (error) {
      console.error('Error saving program:', error);
    }
  }

  try {
    const programs = await loadProgramsFromAsyncStorage();
    programs.push(newProgram);
    await AsyncStorage.setItem(PROGRAMS_KEY, JSON.stringify(programs));
    return newProgram;
  } catch (error) {
    console.error('Error saving program:', error);
    throw error;
  }
}

/**
 * Create a new empty program for the user to customize.
 * Starts with 1 week, 1 day, and 0 exercises.
 */
export async function createProgram(name: string, description?: string): Promise<Program> {
  const newProgram: Program = {
    id: `prog-${Date.now()}`,
    userId: 'local',
    name,
    description: description || null,
    sourceFileUri: null,
    sourceType: 'BUILTIN',
    status: 'READY',
    parsedData: {
      workouts: [
        { week: 1, day: 1, name: 'Day 1', exercises: [], order: 0 }
      ]
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const db = await getStorageDb();
  if (db) {
    try {
      await db.runAsync(
        `INSERT OR REPLACE INTO programs (
          id, user_id, name, description, source_file_uri, source_type, status,
          parsed_data, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newProgram.id,
          newProgram.userId,
          newProgram.name,
          newProgram.description,
          newProgram.sourceFileUri,
          newProgram.sourceType,
          newProgram.status,
          JSON.stringify(newProgram.parsedData),
          newProgram.createdAt,
          newProgram.updatedAt,
        ]
      );
      return newProgram;
    } catch (error) {
      console.error('Error creating program:', error);
    }
  }

  try {
    const programs = await loadProgramsFromAsyncStorage();
    programs.push(newProgram);
    await AsyncStorage.setItem(PROGRAMS_KEY, JSON.stringify(programs));
    return newProgram;
  } catch (error) {
    console.error('Error creating program:', error);
    throw error;
  }
}

export async function updateProgram(id: string, updates: Partial<Program>): Promise<Program | null> {
  const db = await getStorageDb();
  if (db) {
    try {
      const existing = await db.getFirstAsync<ProgramRow>(
        `SELECT id, user_id, name, description, source_file_uri, source_type, status,
            parsed_data, created_at, updated_at
         FROM programs
         WHERE id = ?`,
        [id]
      );
      if (!existing) return null;

      const updated: Program = {
        ...mapProgramRow(existing),
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await db.runAsync(
        `INSERT OR REPLACE INTO programs (
          id, user_id, name, description, source_file_uri, source_type, status,
          parsed_data, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          updated.id,
          updated.userId,
          updated.name,
          updated.description,
          updated.sourceFileUri,
          updated.sourceType,
          updated.status,
          JSON.stringify(updated.parsedData),
          updated.createdAt,
          updated.updatedAt,
        ]
      );

      return updated;
    } catch (error) {
      console.error('Error updating program:', error);
    }
  }

  try {
    const programs = await getPrograms();
    const index = programs.findIndex(p => p.id === id);
    if (index === -1) return null;

    programs[index] = {
      ...programs[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(PROGRAMS_KEY, JSON.stringify(programs));
    return programs[index];
  } catch (error) {
    console.error('Error updating program:', error);
    throw error;
  }
}

export async function deleteProgram(id: string): Promise<boolean> {
  const db = await getStorageDb();
  if (db) {
    try {
      await db.runAsync('DELETE FROM programs WHERE id = ?', [id]);
      return true;
    } catch (error) {
      console.error('Error deleting program:', error);
    }
  }

  try {
    const programs = await getPrograms();
    const filtered = programs.filter(p => p.id !== id);
    await AsyncStorage.setItem(PROGRAMS_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error deleting program:', error);
    return false;
  }
}

function templatesKey(userId: string) {
  return `${PROGRAM_TEMPLATES_KEY_PREFIX}${userId}`;
}

export async function getProgramTemplates(userId: string): Promise<ProgramTemplate[]> {
  const db = await getStorageDb();
  if (db) {
    try {
      const rows = await db.getAllAsync<ProgramTemplateRow>(
        `SELECT id, user_id, base_program_id, name, description, parsed_data, created_at, updated_at
         FROM program_templates
         WHERE user_id = ?
         ORDER BY updated_at DESC`,
        [userId]
      );

      if (rows.length > 0) {
        return rows.map(mapProgramTemplateRow);
      }

      const legacy = await loadProgramTemplatesFromAsyncStorage(userId);
      if (legacy.length > 0) {
        await db.withTransactionAsync(async () => {
          for (const template of legacy) {
            await db.runAsync(
              `INSERT OR REPLACE INTO program_templates (
                id, user_id, base_program_id, name, description, parsed_data, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                template.id,
                template.userId,
                template.baseProgramId,
                template.name,
                template.description,
                JSON.stringify(template.parsedData),
                template.createdAt,
                template.updatedAt,
              ]
            );
          }
        });
      }

      return legacy;
    } catch (error) {
      console.error('Error loading program templates:', error);
    }
  }

  return loadProgramTemplatesFromAsyncStorage(userId);
}

export async function getTemplateForProgram(userId: string, baseProgramId: string): Promise<ProgramTemplate | null> {
  const db = await getStorageDb();
  if (db) {
    try {
      const row = await db.getFirstAsync<ProgramTemplateRow>(
        `SELECT id, user_id, base_program_id, name, description, parsed_data, created_at, updated_at
         FROM program_templates
         WHERE user_id = ? AND base_program_id = ?`,
        [userId, baseProgramId]
      );
      return row ? mapProgramTemplateRow(row) : null;
    } catch (error) {
      console.error('Error loading program template:', error);
    }
  }

  const templates = await getProgramTemplates(userId);
  return templates.find(t => t.baseProgramId === baseProgramId) || null;
}

export async function upsertProgramTemplate(
  template: Omit<ProgramTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ProgramTemplate> {
  const { userId, baseProgramId } = template;
  const now = new Date().toISOString();

  const db = await getStorageDb();
  if (db) {
    try {
      const existing = await db.getFirstAsync<ProgramTemplateRow>(
        `SELECT id, user_id, base_program_id, name, description, parsed_data, created_at, updated_at
         FROM program_templates
         WHERE user_id = ? AND base_program_id = ?`,
        [userId, baseProgramId]
      );

      const updated: ProgramTemplate = existing
        ? {
            ...mapProgramTemplateRow(existing),
            ...template,
            updatedAt: now,
          }
        : {
            ...template,
            id: `tmpl-${Date.now()}`,
            createdAt: now,
            updatedAt: now,
          };

      await db.runAsync(
        `INSERT OR REPLACE INTO program_templates (
          id, user_id, base_program_id, name, description, parsed_data, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          updated.id,
          updated.userId,
          updated.baseProgramId,
          updated.name,
          updated.description,
          JSON.stringify(updated.parsedData),
          updated.createdAt,
          updated.updatedAt,
        ]
      );

      return updated;
    } catch (error) {
      console.error('Error upserting program template:', error);
    }
  }

  try {
    const templates = await getProgramTemplates(userId);
    const idx = templates.findIndex(t => t.baseProgramId === baseProgramId);

    if (idx === -1) {
      const newTemplate: ProgramTemplate = {
        ...template,
        id: `tmpl-${Date.now()}`,
        createdAt: now,
        updatedAt: now,
      };
      templates.push(newTemplate);
      await AsyncStorage.setItem(templatesKey(userId), JSON.stringify(templates));
      return newTemplate;
    }

    templates[idx] = {
      ...templates[idx],
      ...template,
      updatedAt: now,
    };
    await AsyncStorage.setItem(templatesKey(userId), JSON.stringify(templates));
    return templates[idx];
  } catch (error) {
    console.error('Error upserting program template:', error);
    throw error;
  }
}

export async function deleteProgramTemplate(userId: string, baseProgramId: string): Promise<boolean> {
  const db = await getStorageDb();
  if (db) {
    try {
      await db.runAsync(
        'DELETE FROM program_templates WHERE user_id = ? AND base_program_id = ?',
        [userId, baseProgramId]
      );
      return true;
    } catch (error) {
      console.error('Error deleting program template:', error);
    }
  }

  try {
    const templates = await getProgramTemplates(userId);
    const filtered = templates.filter(t => t.baseProgramId !== baseProgramId);
    await AsyncStorage.setItem(templatesKey(userId), JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error deleting program template:', error);
    return false;
  }
}

/**
 * Returns template.parsedData if the user has customized the program; otherwise returns program.parsedData.
 */
export async function getEffectiveProgramData(program: Program): Promise<any> {
  const tmpl = await getTemplateForProgram(program.userId, program.id);
  return tmpl?.parsedData ?? program.parsedData;
}

function pendingEditsKey(userId: string, programId: string) {
  return `${WORKOUT_PENDING_EDITS_KEY_PREFIX}${userId}:${programId}`;
}

function pendingEditsRowId(userId: string, programId: string) {
  return `pwe-${userId}-${programId}`;
}

export async function setPendingWorkoutEdits(userId: string, programId: string, parsedData: any): Promise<void> {
  const db = await getStorageDb();
  if (db) {
    try {
      await db.runAsync(
        `INSERT OR REPLACE INTO pending_workout_edits (
          id, user_id, program_id, parsed_data, updated_at
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          pendingEditsRowId(userId, programId),
          userId,
          programId,
          JSON.stringify(parsedData),
          new Date().toISOString(),
        ]
      );
      return;
    } catch (error) {
      console.error('Error saving pending workout edits:', error);
    }
  }

  try {
    await AsyncStorage.setItem(pendingEditsKey(userId, programId), JSON.stringify(parsedData));
  } catch (error) {
    console.error('Error saving pending workout edits:', error);
  }
}

export async function getPendingWorkoutEdits(userId: string, programId: string): Promise<any | null> {
  const db = await getStorageDb();
  if (db) {
    try {
      const row = await db.getFirstAsync<PendingEditsRow>(
        'SELECT parsed_data FROM pending_workout_edits WHERE user_id = ? AND program_id = ?',
        [userId, programId]
      );

      if (row) {
        return JSON.parse(row.parsed_data);
      }

      const data = await AsyncStorage.getItem(pendingEditsKey(userId, programId));
      if (!data) return null;
      const parsed = JSON.parse(data);
      await db.runAsync(
        `INSERT OR REPLACE INTO pending_workout_edits (
          id, user_id, program_id, parsed_data, updated_at
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          pendingEditsRowId(userId, programId),
          userId,
          programId,
          data,
          new Date().toISOString(),
        ]
      );
      return parsed;
    } catch (error) {
      console.error('Error loading pending workout edits:', error);
    }
  }

  try {
    const data = await AsyncStorage.getItem(pendingEditsKey(userId, programId));
    if (!data) return null;
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading pending workout edits:', error);
    return null;
  }
}

export async function clearPendingWorkoutEdits(userId: string, programId: string): Promise<void> {
  const db = await getStorageDb();
  if (db) {
    try {
      await db.runAsync(
        'DELETE FROM pending_workout_edits WHERE user_id = ? AND program_id = ?',
        [userId, programId]
      );
    } catch (error) {
      console.error('Error clearing pending workout edits:', error);
    }
  }

  try {
    await AsyncStorage.removeItem(pendingEditsKey(userId, programId));
  } catch (error) {
    console.error('Error clearing pending workout edits:', error);
  }
}

function activeWorkoutKey(userId: string, programId: string) {
  return `${ACTIVE_WORKOUT_KEY_PREFIX}${userId}:${programId}`;
}

function activeWorkoutRowId(userId: string, programId: string) {
  return `aws-${userId}-${programId}`;
}

export async function setActiveWorkoutState(userId: string, programId: string, state: ActiveWorkoutState): Promise<void> {
  const db = await getStorageDb();
  if (db) {
    try {
      await db.runAsync(
        `INSERT OR REPLACE INTO active_workout_state (
          id, user_id, program_id, state_json, updated_at
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          activeWorkoutRowId(userId, programId),
          userId,
          programId,
          JSON.stringify(state),
          new Date().toISOString(),
        ]
      );
      return;
    } catch (error) {
      console.error('Error saving active workout state:', error);
    }
  }

  try {
    await AsyncStorage.setItem(activeWorkoutKey(userId, programId), JSON.stringify(state));
  } catch (error) {
    console.error('Error saving active workout state:', error);
  }
}

export async function getActiveWorkoutState(userId: string, programId: string): Promise<ActiveWorkoutState | null> {
  const db = await getStorageDb();
  if (db) {
    try {
      const row = await db.getFirstAsync<ActiveWorkoutRow>(
        'SELECT state_json FROM active_workout_state WHERE user_id = ? AND program_id = ?',
        [userId, programId]
      );

      if (row) {
        return JSON.parse(row.state_json);
      }

      const data = await AsyncStorage.getItem(activeWorkoutKey(userId, programId));
      if (!data) return null;
      const parsed = JSON.parse(data);
      await db.runAsync(
        `INSERT OR REPLACE INTO active_workout_state (
          id, user_id, program_id, state_json, updated_at
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          activeWorkoutRowId(userId, programId),
          userId,
          programId,
          data,
          new Date().toISOString(),
        ]
      );
      return parsed;
    } catch (error) {
      console.error('Error loading active workout state:', error);
    }
  }

  try {
    const data = await AsyncStorage.getItem(activeWorkoutKey(userId, programId));
    if (!data) return null;
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading active workout state:', error);
    return null;
  }
}

export async function clearActiveWorkoutState(userId: string, programId: string): Promise<void> {
  const db = await getStorageDb();
  if (db) {
    try {
      await db.runAsync(
        'DELETE FROM active_workout_state WHERE user_id = ? AND program_id = ?',
        [userId, programId]
      );
    } catch (error) {
      console.error('Error clearing active workout state:', error);
    }
  }

  try {
    await AsyncStorage.removeItem(activeWorkoutKey(userId, programId));
  } catch (error) {
    console.error('Error clearing active workout state:', error);
  }
}

export async function getLatestActiveWorkoutState(userId: string): Promise<{
  programId: string;
  state: ActiveWorkoutState;
} | null> {
  const db = await getStorageDb();
  if (db) {
    try {
      const rows = await db.getAllAsync<ActiveWorkoutListRow>(
        'SELECT program_id, state_json, updated_at FROM active_workout_state WHERE user_id = ? ORDER BY updated_at DESC',
        [userId]
      );

      for (const row of rows) {
        try {
          const parsed = JSON.parse(row.state_json) as ActiveWorkoutState;
          const status = parsed?.session?.status;
          if (status === 'in_progress' || status === 'paused') {
            return { programId: row.program_id, state: parsed };
          }
        } catch (error) {
          console.warn('Invalid active workout state JSON:', error);
        }
      }
    } catch (error) {
      console.error('Error loading latest active workout state:', error);
    }
  }

  try {
    const keys = await AsyncStorage.getAllKeys();
    const prefix = `${ACTIVE_WORKOUT_KEY_PREFIX}${userId}:`;
    const workoutKeys = keys.filter((key) => key.startsWith(prefix));

    for (const key of workoutKeys) {
      const data = await AsyncStorage.getItem(key);
      if (!data) continue;
      try {
        const parsed = JSON.parse(data) as ActiveWorkoutState;
        const status = parsed?.session?.status;
        if (status === 'in_progress' || status === 'paused') {
          const programId = key.replace(prefix, '');
          return { programId, state: parsed };
        }
      } catch (error) {
        console.warn('Invalid active workout state JSON in AsyncStorage:', error);
      }
    }
  } catch (error) {
    console.error('Error loading latest active workout state from AsyncStorage:', error);
  }

  return null;
}

// Workout History Functions
function workoutHistoryKey(programId: string) {
  return `${WORKOUT_HISTORY_KEY_PREFIX}${programId}`;
}

async function loadWorkoutHistoryFromAsyncStorage(programId: string): Promise<WorkoutHistory> {
  try {
    const data = await AsyncStorage.getItem(workoutHistoryKey(programId));
    if (!data) return { programId, completions: [] };
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading workout history:', error);
    return { programId, completions: [] };
  }
}

export async function getWorkoutHistory(programId: string): Promise<WorkoutHistory> {
  const db = await getStorageDb();
  if (db) {
    try {
      const rows = await db.getAllAsync<WorkoutHistoryRow>(
        'SELECT week, day, completed_at, duration_seconds FROM workout_history WHERE program_id = ? ORDER BY completed_at ASC',
        [programId]
      );

      if (rows.length > 0) {
        return {
          programId,
          completions: rows.map(row => ({
            week: row.week,
            day: row.day,
            completedAt: row.completed_at,
            durationSeconds: row.duration_seconds ?? undefined,
          })),
        };
      }

      const legacy = await loadWorkoutHistoryFromAsyncStorage(programId);
      if (legacy.completions.length > 0) {
        await db.withTransactionAsync(async () => {
          for (const completion of legacy.completions) {
            await db.runAsync(
              'INSERT INTO workout_history (id, program_id, week, day, completed_at, duration_seconds) VALUES (?, ?, ?, ?, ?, ?)',
              [
                `wh-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                programId,
                completion.week,
                completion.day,
                completion.completedAt,
                completion.durationSeconds ?? null,
              ]
            );
          }
        });
      }

      return legacy;
    } catch (error) {
      console.error('Error loading workout history:', error);
    }
  }

  return loadWorkoutHistoryFromAsyncStorage(programId);
}

export async function markWorkoutCompleted(
  programId: string,
  week: number,
  day: number,
  durationSeconds?: number
): Promise<void> {
  const completedAt = new Date().toISOString();
  const db = await getStorageDb();

  if (db) {
    try {
      await db.runAsync(
        'INSERT INTO workout_history (id, program_id, week, day, completed_at, duration_seconds) VALUES (?, ?, ?, ?, ?, ?)',
        [
          `wh-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          programId,
          week,
          day,
          completedAt,
          durationSeconds ?? null,
        ]
      );
      return;
    } catch (error) {
      console.error('Error marking workout completed:', error);
    }
  }

  try {
    const history = await loadWorkoutHistoryFromAsyncStorage(programId);

    history.completions.push({
      week,
      day,
      completedAt,
      durationSeconds,
    });

    await AsyncStorage.setItem(workoutHistoryKey(programId), JSON.stringify(history));
  } catch (error) {
    console.error('Error marking workout completed:', error);
  }
}

export async function isWorkoutCompleted(programId: string, week: number, day: number): Promise<boolean> {
  const history = await getWorkoutHistory(programId);
  return history.completions.some(c => c.week === week && c.day === day);
}

export async function getCompletedWorkouts(programId: string): Promise<Set<string>> {
  const history = await getWorkoutHistory(programId);
  const completed = new Set<string>();
  history.completions.forEach(c => {
    completed.add(`${c.week}-${c.day}`);
  });
  return completed;
}

export async function clearWorkoutHistory(programId: string): Promise<void> {
  const db = await getStorageDb();
  if (db) {
    try {
      await db.runAsync('DELETE FROM workout_history WHERE program_id = ?', [programId]);
      return;
    } catch (error) {
      console.error('Error clearing workout history:', error);
    }
  }

  try {
    await AsyncStorage.removeItem(workoutHistoryKey(programId));
  } catch (error) {
    console.error('Error clearing workout history:', error);
  }
}

// ============================================
// UNIFIED WORKOUT HISTORY
// Tracks all workouts (program-based and quick) for a user
// ============================================

const UNIFIED_HISTORY_KEY = '@unified_workout_history';

export type UnifiedWorkoutRecord = {
  id: string;
  type: 'program' | 'quick';
  programId?: string;
  programName?: string;
  workoutName: string;
  week?: number;
  day?: number;
  completedAt: string;
  durationSeconds: number;
  exercises: {
    name: string;
    setsCompleted: number;
    totalSets: number;
    bestSet?: { reps: number; weight?: number };
    sets?: { reps: number; weight?: number; isCompleted: boolean; setType?: SetType }[];
  }[];
  userId: string;
  difficulty?: 'easy' | 'moderate' | 'challenging' | 'very_hard';
  notes?: string;
  totalVolume?: number;
  gymId?: string;
  gymName?: string;
};

function mapUnifiedHistoryRow(row: UnifiedHistoryRow): UnifiedWorkoutRecord {
  return {
    id: row.id,
    type: row.type === 'quick' ? 'quick' : 'program',
    programId: row.program_id ?? undefined,
    programName: row.program_name ?? undefined,
    workoutName: row.workout_name,
    week: row.week ?? undefined,
    day: row.day ?? undefined,
    completedAt: row.completed_at,
    durationSeconds: row.duration_seconds,
    exercises: JSON.parse(row.exercises_json),
    userId: row.user_id,
    difficulty: (row.difficulty as UnifiedWorkoutRecord['difficulty']) ?? undefined,
    notes: row.notes ?? undefined,
    totalVolume: row.total_volume ?? undefined,
    gymId: row.gym_id ?? undefined,
    gymName: row.gym_name ?? undefined,
  };
}

export async function getUnifiedHistory(userId: string = 'local'): Promise<UnifiedWorkoutRecord[]> {
  const db = await getStorageDb();
  if (db) {
    try {
      const rows = await db.getAllAsync<UnifiedHistoryRow>(
        `SELECT id, user_id, type, program_id, program_name, workout_name, week, day, completed_at,
            duration_seconds, exercises_json, difficulty, notes, total_volume, gym_id, gym_name
         FROM unified_workout_history
         WHERE user_id = ?
         ORDER BY completed_at DESC`,
        [userId]
      );

      if (rows.length > 0) {
        return rows.map(mapUnifiedHistoryRow);
      }

      const legacyData = await AsyncStorage.getItem(UNIFIED_HISTORY_KEY);
      const allRecords: UnifiedWorkoutRecord[] = legacyData ? JSON.parse(legacyData) : [];
      const filtered = allRecords
        .filter(r => r.userId === userId)
        .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

      if (filtered.length > 0) {
        await db.withTransactionAsync(async () => {
          for (const record of filtered) {
            await db.runAsync(
              `INSERT OR REPLACE INTO unified_workout_history (
                id, user_id, type, program_id, program_name, workout_name, week, day, completed_at,
                duration_seconds, exercises_json, difficulty, notes, total_volume, gym_id, gym_name
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                record.id,
                record.userId,
                record.type,
                record.programId ?? null,
                record.programName ?? null,
                record.workoutName,
                record.week ?? null,
                record.day ?? null,
                record.completedAt,
                record.durationSeconds,
                JSON.stringify(record.exercises),
                record.difficulty ?? null,
                record.notes ?? null,
                record.totalVolume ?? null,
                record.gymId ?? null,
                record.gymName ?? null,
              ]
            );
          }
        });
      }

      return filtered;
    } catch (error) {
      console.error('Error loading unified history:', error);
    }
  }

  try {
    const data = await AsyncStorage.getItem(UNIFIED_HISTORY_KEY);
    if (!data) return [];
    const allRecords: UnifiedWorkoutRecord[] = JSON.parse(data);
    return allRecords
      .filter(r => r.userId === userId)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  } catch (error) {
    console.error('Error loading unified history:', error);
    return [];
  }
}

/**
 * Count how many times user has performed each exercise
 * Returns: { "bench press": 15, "squats": 12, ... }
 */
export async function getUserExerciseFrequency(
  userId: string = 'local'
): Promise<Record<string, number>> {
  try {
    const history = await getUnifiedHistory(userId);
    const frequency: Record<string, number> = {};

    for (const workout of history) {
      for (const exercise of workout.exercises) {
        const name = exercise.name.toLowerCase().trim();
        frequency[name] = (frequency[name] || 0) + 1;
      }
    }

    return frequency;
  } catch (error) {
    console.error('Error getting user exercise frequency:', error);
    return {};
  }
}

export type PreviousExerciseData = {
  exerciseName: string;
  date: string;
  sets: { reps: number; weight?: number; setType?: SetType }[];
};

/**
 * Get previous workout data for exercises by name
 * Returns the most recent workout data for each exercise name
 */
export async function getPreviousExerciseData(
  exerciseNames: string[],
  userId: string = 'local'
): Promise<Record<string, PreviousExerciseData>> {
  try {
    const history = await getUnifiedHistory(userId);
    const result: Record<string, PreviousExerciseData> = {};

    // Normalize exercise names for comparison
    const normalizedNames = exerciseNames.map(n => n.toLowerCase().trim());

    // Go through history from newest to oldest
    for (const record of history) {
      for (const exercise of record.exercises) {
        const normalizedName = exercise.name.toLowerCase().trim();

        // Check if this exercise matches any we're looking for
        const matchIndex = normalizedNames.findIndex(n => n === normalizedName);
        if (matchIndex >= 0 && !result[exerciseNames[matchIndex]]) {
          result[exerciseNames[matchIndex]] = {
            exerciseName: exercise.name,
            date: record.completedAt,
            sets: exercise.sets?.map(s => ({
              reps: s.reps,
              weight: s.weight,
              setType: s.setType,
            })) || [],
          };
        }
      }

      // Stop early if we found data for all exercises
      if (Object.keys(result).length === exerciseNames.length) break;
    }

    return result;
  } catch (error) {
    console.error('Error loading previous exercise data:', error);
    return {};
  }
}

export async function saveWorkoutToHistory(
  record: Omit<UnifiedWorkoutRecord, 'id'>
): Promise<UnifiedWorkoutRecord> {
  const newRecord: UnifiedWorkoutRecord = {
    ...record,
    id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  };

  let savedToSqlite = false;
  const db = await getStorageDb();
  if (db) {
    try {
      await db.runAsync(
        `INSERT OR REPLACE INTO unified_workout_history (
          id, user_id, type, program_id, program_name, workout_name, week, day, completed_at,
          duration_seconds, exercises_json, difficulty, notes, total_volume, gym_id, gym_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newRecord.id,
          newRecord.userId,
          newRecord.type,
          newRecord.programId ?? null,
          newRecord.programName ?? null,
          newRecord.workoutName,
          newRecord.week ?? null,
          newRecord.day ?? null,
          newRecord.completedAt,
          newRecord.durationSeconds,
          JSON.stringify(newRecord.exercises),
          newRecord.difficulty ?? null,
          newRecord.notes ?? null,
          newRecord.totalVolume ?? null,
          newRecord.gymId ?? null,
          newRecord.gymName ?? null,
        ]
      );
      savedToSqlite = true;
    } catch (error) {
      console.error('Error saving workout to history:', error);
    }
  }

  if (!savedToSqlite) {
    try {
      const existingData = await AsyncStorage.getItem(UNIFIED_HISTORY_KEY);
      const allRecords: UnifiedWorkoutRecord[] = existingData ? JSON.parse(existingData) : [];
      allRecords.push(newRecord);
      await AsyncStorage.setItem(UNIFIED_HISTORY_KEY, JSON.stringify(allRecords));
    } catch (error) {
      console.error('Error saving workout to history:', error);
      throw error;
    }
  }

  if (syncCallback) {
    try {
      const syncableWorkout = convertToSyncableWorkout(newRecord);
      await syncCallback(syncableWorkout);
    } catch (syncError) {
      console.warn('Sync callback failed:', syncError);
    }
  }

  return newRecord;
}

/**
 * Convert a UnifiedWorkoutRecord to a SyncableWorkout for the sync service
 */
function convertToSyncableWorkout(record: UnifiedWorkoutRecord): SyncableWorkout {
  return {
    id: record.id,
    localId: record.id,
    workoutName: record.workoutName,
    workoutType: record.type,
    completedAt: record.completedAt,
    durationSeconds: record.durationSeconds,
    exercises: record.exercises.map(ex => ({
      exerciseName: ex.name,
      canonicalName: ex.name.toLowerCase().replace(/\s+/g, '_'),
      sets: Array.from({ length: ex.totalSets }, (_, i) => ({
        setNumber: i + 1,
        weight: ex.bestSet?.weight,
        reps: i < ex.setsCompleted ? (ex.bestSet?.reps || 0) : 0,
        completed: i < ex.setsCompleted,
      })),
    })),
  };
}

export async function getWorkoutRecordById(id: string): Promise<UnifiedWorkoutRecord | null> {
  const db = await getStorageDb();
  if (db) {
    try {
      const row = await db.getFirstAsync<UnifiedHistoryRow>(
        `SELECT id, user_id, type, program_id, program_name, workout_name, week, day, completed_at,
            duration_seconds, exercises_json, difficulty, notes, total_volume, gym_id, gym_name
         FROM unified_workout_history
         WHERE id = ?`,
        [id]
      );
      return row ? mapUnifiedHistoryRow(row) : null;
    } catch (error) {
      console.error('Error getting workout record:', error);
    }
  }

  try {
    const data = await AsyncStorage.getItem(UNIFIED_HISTORY_KEY);
    if (!data) return null;
    const allRecords: UnifiedWorkoutRecord[] = JSON.parse(data);
    return allRecords.find(r => r.id === id) || null;
  } catch (error) {
    console.error('Error getting workout record:', error);
    return null;
  }
}

export async function deleteWorkoutRecord(id: string): Promise<boolean> {
  const db = await getStorageDb();
  if (db) {
    try {
      const result = await db.runAsync('DELETE FROM unified_workout_history WHERE id = ?', [id]);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting workout record:', error);
    }
  }

  try {
    const data = await AsyncStorage.getItem(UNIFIED_HISTORY_KEY);
    if (!data) return false;
    const allRecords: UnifiedWorkoutRecord[] = JSON.parse(data);
    const filtered = allRecords.filter(r => r.id !== id);
    await AsyncStorage.setItem(UNIFIED_HISTORY_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error deleting workout record:', error);
    return false;
  }
}

/**
 * Get workout history grouped by time period
 */
export function groupHistoryByPeriod(records: UnifiedWorkoutRecord[]): {
  period: string;
  records: UnifiedWorkoutRecord[];
}[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

  const groups: Record<string, UnifiedWorkoutRecord[]> = {
    'Today': [],
    'This Week': [],
    'Last Week': [],
  };
  const monthGroups: Record<string, UnifiedWorkoutRecord[]> = {};

  records.forEach(record => {
    const date = new Date(record.completedAt);
    const recordDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (recordDate.getTime() === today.getTime()) {
      groups['Today'].push(record);
    } else if (recordDate >= weekAgo) {
      groups['This Week'].push(record);
    } else if (recordDate >= twoWeeksAgo) {
      groups['Last Week'].push(record);
    } else {
      const monthKey = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!monthGroups[monthKey]) {
        monthGroups[monthKey] = [];
      }
      monthGroups[monthKey].push(record);
    }
  });

  const result: { period: string; records: UnifiedWorkoutRecord[] }[] = [];

  // Add time-based groups first
  if (groups['Today'].length > 0) {
    result.push({ period: 'Today', records: groups['Today'] });
  }
  if (groups['This Week'].length > 0) {
    result.push({ period: 'This Week', records: groups['This Week'] });
  }
  if (groups['Last Week'].length > 0) {
    result.push({ period: 'Last Week', records: groups['Last Week'] });
  }

  // Add month groups sorted by date
  const sortedMonths = Object.entries(monthGroups).sort((a, b) => {
    const dateA = new Date(a[1][0].completedAt);
    const dateB = new Date(b[1][0].completedAt);
    return dateB.getTime() - dateA.getTime();
  });

  sortedMonths.forEach(([month, recs]) => {
    result.push({ period: month, records: recs });
  });

  return result;
}

/**
 * Get workout stats for a user
 */
export async function getWorkoutStats(userId: string = 'local'): Promise<{
  totalWorkouts: number;
  thisWeek: number;
  thisMonth: number;
  currentStreak: number;
  totalDurationMinutes: number;
}> {
  try {
    const records = await getUnifiedHistory(userId);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let currentStreak = 0;
    let lastWorkoutDate: Date | null = null;

    // Calculate streak (days in a row with at least one workout)
    const workoutDays = new Set<string>();
    records.forEach(r => {
      const date = new Date(r.completedAt);
      const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      workoutDays.add(dayKey);
    });

    // Count streak from today backwards
    const checkDate = new Date(now);
    while (true) {
      const dayKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
      if (workoutDays.has(dayKey)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (checkDate.toDateString() !== now.toDateString()) {
        // If it's not today and no workout, streak breaks
        break;
      } else {
        // Today without workout - check yesterday
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }

    return {
      totalWorkouts: records.length,
      thisWeek: records.filter(r => new Date(r.completedAt) >= weekAgo).length,
      thisMonth: records.filter(r => new Date(r.completedAt) >= monthStart).length,
      currentStreak,
      totalDurationMinutes: Math.round(
        records.reduce((sum, r) => sum + r.durationSeconds, 0) / 60
      ),
    };
  } catch (error) {
    console.error('Error getting workout stats:', error);
    return {
      totalWorkouts: 0,
      thisWeek: 0,
      thisMonth: 0,
      currentStreak: 0,
      totalDurationMinutes: 0,
    };
  }
}

// ============================================
// SAVED WORKOUT TEMPLATES
// Reusable single-session workout templates
// ============================================

const SAVED_WORKOUT_TEMPLATES_KEY = '@saved_workout_templates';

export interface SavedWorkoutTemplate {
  id: string;
  name: string;
  exercises: {
    name: string;
    sets: number;
    reps?: string;
    weight?: string;
  }[];
  createdAt: string;
  userId: string;
}

/**
 * Get all saved workout templates for a user
 */
export async function getSavedWorkoutTemplates(
  userId: string = 'local'
): Promise<SavedWorkoutTemplate[]> {
  const db = await getStorageDb();
  if (db) {
    try {
      const rows = await db.getAllAsync<SavedWorkoutTemplateRow>(
        `SELECT id, user_id, name, exercises_json, created_at
         FROM saved_workout_templates
         WHERE user_id = ?
         ORDER BY created_at DESC`,
        [userId]
      );

      if (rows.length > 0) {
        return rows.map(row => ({
          id: row.id,
          name: row.name,
          exercises: JSON.parse(row.exercises_json),
          createdAt: row.created_at,
          userId: row.user_id,
        }));
      }

      const legacyData = await AsyncStorage.getItem(SAVED_WORKOUT_TEMPLATES_KEY);
      const allTemplates: SavedWorkoutTemplate[] = legacyData ? JSON.parse(legacyData) : [];
      const filtered = allTemplates
        .filter(t => t.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (filtered.length > 0) {
        await db.withTransactionAsync(async () => {
          for (const template of filtered) {
            await db.runAsync(
              `INSERT OR REPLACE INTO saved_workout_templates
                (id, user_id, name, exercises_json, created_at)
               VALUES (?, ?, ?, ?, ?)`,
              [
                template.id,
                template.userId,
                template.name,
                JSON.stringify(template.exercises),
                template.createdAt,
              ]
            );
          }
        });
      }

      return filtered;
    } catch (error) {
      console.error('Error getting workout templates:', error);
    }
  }

  try {
    const data = await AsyncStorage.getItem(SAVED_WORKOUT_TEMPLATES_KEY);
    if (!data) return [];
    const allTemplates: SavedWorkoutTemplate[] = JSON.parse(data);
    return allTemplates
      .filter(t => t.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('Error getting workout templates:', error);
    return [];
  }
}

/**
 * Save a new workout template
 */
export async function saveWorkoutTemplate(
  template: Omit<SavedWorkoutTemplate, 'id' | 'createdAt'>
): Promise<SavedWorkoutTemplate> {
  const newTemplate: SavedWorkoutTemplate = {
    ...template,
    id: `wt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
  };

  let savedToSqlite = false;
  const db = await getStorageDb();
  if (db) {
    try {
      await db.runAsync(
        `INSERT OR REPLACE INTO saved_workout_templates
          (id, user_id, name, exercises_json, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          newTemplate.id,
          newTemplate.userId,
          newTemplate.name,
          JSON.stringify(newTemplate.exercises),
          newTemplate.createdAt,
        ]
      );
      savedToSqlite = true;
    } catch (error) {
      console.error('Error saving workout template:', error);
    }
  }

  if (!savedToSqlite) {
    try {
      const existing = await AsyncStorage.getItem(SAVED_WORKOUT_TEMPLATES_KEY);
      const templates: SavedWorkoutTemplate[] = existing ? JSON.parse(existing) : [];
      templates.push(newTemplate);
      await AsyncStorage.setItem(SAVED_WORKOUT_TEMPLATES_KEY, JSON.stringify(templates));
    } catch (error) {
      console.error('Error saving workout template:', error);
      throw error;
    }
  }

  return newTemplate;
}

/**
 * Delete a saved workout template
 */
export async function deleteWorkoutTemplate(templateId: string): Promise<boolean> {
  const db = await getStorageDb();
  if (db) {
    try {
      const result = await db.runAsync(
        'DELETE FROM saved_workout_templates WHERE id = ?',
        [templateId]
      );
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting workout template:', error);
    }
  }

  try {
    const existing = await AsyncStorage.getItem(SAVED_WORKOUT_TEMPLATES_KEY);
    if (!existing) return false;

    const templates: SavedWorkoutTemplate[] = JSON.parse(existing);
    const filtered = templates.filter(t => t.id !== templateId);

    if (filtered.length === templates.length) return false;

    await AsyncStorage.setItem(SAVED_WORKOUT_TEMPLATES_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error deleting workout template:', error);
    return false;
  }
}
