import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

const DB_NAME = 'workout.db';

let dbPromise: Promise<SQLiteDatabase | null> | null = null;

async function openDatabase(): Promise<SQLiteDatabase | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    return await openDatabaseAsync(DB_NAME);
  } catch (error) {
    console.warn('[SQLite] Failed to open database:', error);
    return null;
  }
}

export async function getDatabase(): Promise<SQLiteDatabase | null> {
  if (!dbPromise) {
    dbPromise = openDatabase();
  }
  return dbPromise;
}

export async function ensureSyncQueueTable(): Promise<boolean> {
  const db = await getDatabase();
  if (!db) {
    return false;
  }

  try {
    await db.runAsync(
      `CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_attempt TEXT,
        error TEXT
      );`
    );
    return true;
  } catch (error) {
    console.warn('[SQLite] Failed to ensure sync_queue table:', error);
    return false;
  }
}

export async function ensureStorageTables(): Promise<boolean> {
  const db = await getDatabase();
  if (!db) {
    return false;
  }

  try {
    const statements = [
      `CREATE TABLE IF NOT EXISTS programs (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        source_file_uri TEXT,
        source_type TEXT NOT NULL,
        status TEXT NOT NULL,
        parsed_data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_programs_user_updated
        ON programs(user_id, updated_at DESC);`,
      `CREATE TABLE IF NOT EXISTS program_templates (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        base_program_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        parsed_data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_program_templates_user_base
        ON program_templates(user_id, base_program_id);`,
      `CREATE TABLE IF NOT EXISTS pending_workout_edits (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        program_id TEXT NOT NULL,
        parsed_data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_workout_edits_user_program
        ON pending_workout_edits(user_id, program_id);`,
      `CREATE TABLE IF NOT EXISTS active_workout_state (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        program_id TEXT NOT NULL,
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_active_workout_state_user_program
        ON active_workout_state(user_id, program_id);`,
      `CREATE TABLE IF NOT EXISTS unified_workout_history (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        program_id TEXT,
        program_name TEXT,
        workout_name TEXT NOT NULL,
        week INTEGER,
        day INTEGER,
        completed_at TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        exercises_json TEXT NOT NULL,
        difficulty TEXT,
        notes TEXT,
        total_volume REAL,
        gym_id TEXT,
        gym_name TEXT
      );`,
      `CREATE INDEX IF NOT EXISTS idx_unified_history_user_date
        ON unified_workout_history(user_id, completed_at DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_unified_history_user_program
        ON unified_workout_history(user_id, program_id);`,
      `CREATE TABLE IF NOT EXISTS workout_history (
        id TEXT PRIMARY KEY NOT NULL,
        program_id TEXT NOT NULL,
        week INTEGER NOT NULL,
        day INTEGER NOT NULL,
        completed_at TEXT NOT NULL,
        duration_seconds INTEGER
      );`,
      `CREATE INDEX IF NOT EXISTS idx_workout_history_program_date
        ON workout_history(program_id, completed_at DESC);`,
      `CREATE TABLE IF NOT EXISTS saved_workout_templates (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        exercises_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_saved_templates_user_date
        ON saved_workout_templates(user_id, created_at DESC);`,
    ];

    for (const statement of statements) {
      await db.runAsync(statement);
    }
    return true;
  } catch (error) {
    console.warn('[SQLite] Failed to ensure storage tables:', error);
    return false;
  }
}

export async function ensureCustomExerciseTables(): Promise<boolean> {
  const db = await getDatabase();
  if (!db) {
    return false;
  }

  try {
    const statements = [
      `CREATE TABLE IF NOT EXISTS custom_exercises (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        equipment_json TEXT,
        muscle_groups_json TEXT,
        movement_pattern TEXT,
        difficulty TEXT,
        notes TEXT,
        usage_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL,
        last_synced_at TEXT,
        is_promoted INTEGER NOT NULL DEFAULT 0
      );`,
      `CREATE INDEX IF NOT EXISTS idx_custom_exercises_user_name
        ON custom_exercises(user_id, normalized_name);`,
      `CREATE TABLE IF NOT EXISTS custom_exercise_sync_queue (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL,
        exercise_json TEXT,
        exercise_id TEXT,
        timestamp INTEGER NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_custom_exercise_sync_queue_ts
        ON custom_exercise_sync_queue(timestamp DESC);`,
    ];

    for (const statement of statements) {
      await db.runAsync(statement);
    }
    return true;
  } catch (error) {
    console.warn('[SQLite] Failed to ensure custom exercise tables:', error);
    return false;
  }
}

export async function ensureExerciseSearchTables(): Promise<boolean> {
  const db = await getDatabase();
  if (!db) {
    return false;
  }

  try {
    await db.runAsync(
      `CREATE VIRTUAL TABLE IF NOT EXISTS exercise_search USING fts5(
        id UNINDEXED,
        name,
        aliases,
        equipment,
        muscles,
        movement,
        category
      );`
    );
    await db.runAsync(
      `CREATE TABLE IF NOT EXISTS exercise_search_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );`
    );
    return true;
  } catch (error) {
    console.warn('[SQLite] Failed to ensure exercise search tables:', error);
    return false;
  }
}

/**
 * Ensure curated programs workout cache table exists.
 * This stores pre-extracted multi-week workout data from Kaggle
 * for the ~38 curated programs shown in the Discover UI.
 */
export async function ensureCuratedProgramsTable(): Promise<boolean> {
  const db = await getDatabase();
  if (!db) {
    return false;
  }

  try {
    await db.runAsync(
      `CREATE TABLE IF NOT EXISTS curated_program_workouts (
        program_id TEXT PRIMARY KEY NOT NULL,
        program_name TEXT NOT NULL,
        workouts_json TEXT NOT NULL,
        kaggle_source_id TEXT,
        data_source TEXT,
        coverage_weeks INTEGER,
        program_duration INTEGER,
        is_full_plan INTEGER,
        preloaded_at TEXT NOT NULL
      );`
    );
    await db.runAsync(
      `CREATE TABLE IF NOT EXISTS curated_programs_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );`
    );

    const columns = await db.getAllAsync<{ name: string }>(
      'PRAGMA table_info(curated_program_workouts)'
    );
    const columnNames = new Set(columns.map((col) => col.name));

    const addColumnIfMissing = async (name: string, ddl: string) => {
      if (columnNames.has(name)) return;
      await db.runAsync(`ALTER TABLE curated_program_workouts ADD COLUMN ${ddl};`);
    };

    await addColumnIfMissing('data_source', 'data_source TEXT');
    await addColumnIfMissing('coverage_weeks', 'coverage_weeks INTEGER');
    await addColumnIfMissing('program_duration', 'program_duration INTEGER');
    await addColumnIfMissing('is_full_plan', 'is_full_plan INTEGER');
    return true;
  } catch (error) {
    console.warn('[SQLite] Failed to ensure curated programs table:', error);
    return false;
  }
}
