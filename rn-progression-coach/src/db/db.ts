import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) throw new Error('DB not initialized');
  return db;
}

export async function initDb(): Promise<void> {
  if (db) return;
  db = await SQLite.openDatabaseAsync('progression_coach.db');

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS active_program_plan (
      plan_id TEXT PRIMARY KEY,
      program_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      current_workout_index INTEGER NOT NULL,
      unit_system TEXT NOT NULL,
      default_upper_increment REAL NOT NULL,
      default_lower_increment REAL NOT NULL,
      progression_profile TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exercise_context (
      canonical_name TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      est1rm REAL,
      last_working_weight REAL,
      preferred_increment REAL,
      last_avg_rpe REAL,
      difficulty_level INTEGER,
      last_duration_seconds INTEGER,
      last_distance_meters INTEGER,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workout_log (
      workout_log_id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      program_id TEXT NOT NULL,
      workout_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT
    );

    CREATE TABLE IF NOT EXISTS exercise_log (
      id TEXT PRIMARY KEY,
      workout_log_id TEXT NOT NULL,
      canonical_name TEXT NOT NULL,
      raw_name TEXT NOT NULL,
      kind TEXT NOT NULL,
      notes TEXT,
      FOREIGN KEY(workout_log_id) REFERENCES workout_log(workout_log_id)
    );

    CREATE TABLE IF NOT EXISTS set_log (
      id TEXT PRIMARY KEY,
      exercise_log_id TEXT NOT NULL,
      set_index INTEGER NOT NULL,
      target_reps INTEGER,
      target_seconds INTEGER,
      suggested_load REAL,
      actual_reps INTEGER,
      actual_seconds INTEGER,
      actual_load REAL,
      rpe REAL,
      is_completed INTEGER NOT NULL,
      FOREIGN KEY(exercise_log_id) REFERENCES exercise_log(id)
    );

    CREATE INDEX IF NOT EXISTS idx_workout_log_plan ON workout_log(plan_id);
    CREATE INDEX IF NOT EXISTS idx_exercise_log_workout ON exercise_log(workout_log_id);
    CREATE INDEX IF NOT EXISTS idx_set_log_exercise ON set_log(exercise_log_id);
  `);
}
