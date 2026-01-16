import { ensureExerciseSearchTables, getDatabase } from '@/lib/db/sqlite';
import { getExerciseDatabase, type ExerciseDatabaseEntry } from './database';

const INDEX_VERSION = '1';

let indexReady = false;
let indexPromise: Promise<void> | null = null;

function normalizeMatchQuery(query: string): string | null {
  const terms = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map(term => term.replace(/[^a-z0-9_]/g, ''))
    .filter(Boolean);

  if (terms.length === 0) {
    return null;
  }

  return terms.map(term => `${term}*`).join(' ');
}

function buildSearchRow(exercise: ExerciseDatabaseEntry) {
  const aliases = (exercise.aliases || []).join(' ');
  const equipment = (exercise.equipment || []).join(' ');
  const muscles = [
    exercise.muscles?.targetGroup,
    exercise.muscles?.primeMover,
    exercise.muscles?.secondary,
    exercise.muscles?.tertiary,
  ]
    .filter(Boolean)
    .join(' ');
  const movement = [
    ...(exercise.movementPatterns || []),
    exercise.movementCategory,
  ]
    .filter(Boolean)
    .join(' ');
  const category = [
    exercise.category,
    exercise.bodyRegion,
    exercise.equipmentCategory,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    id: exercise.id,
    name: exercise.name,
    aliases,
    equipment,
    muscles,
    movement,
    category,
  };
}

export async function ensureExerciseSearchIndex(): Promise<void> {
  if (indexReady) return;
  if (indexPromise) return indexPromise;

  indexPromise = (async () => {
    const db = await getDatabase();
    if (!db) {
      indexPromise = null;
      return;
    }

    const ready = await ensureExerciseSearchTables();
    if (!ready) {
      indexPromise = null;
      return;
    }

    try {
      const database = await getExerciseDatabase();
      const versionRow = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM exercise_search_meta WHERE key = ?',
        ['index_version']
      );
      const countRow = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM exercise_search_meta WHERE key = ?',
        ['exercise_count']
      );
      const storedCount = Number(countRow?.value ?? 0);

      if (versionRow?.value === INDEX_VERSION && storedCount === database.length) {
        indexReady = true;
        return;
      }

      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM exercise_search');

        for (const exercise of database) {
          const row = buildSearchRow(exercise);
          await db.runAsync(
            `INSERT INTO exercise_search (
              id, name, aliases, equipment, muscles, movement, category
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              row.id,
              row.name,
              row.aliases,
              row.equipment,
              row.muscles,
              row.movement,
              row.category,
            ]
          );
        }

        await db.runAsync(
          'INSERT OR REPLACE INTO exercise_search_meta (key, value) VALUES (?, ?)',
          ['index_version', INDEX_VERSION]
        );
        await db.runAsync(
          'INSERT OR REPLACE INTO exercise_search_meta (key, value) VALUES (?, ?)',
          ['exercise_count', String(database.length)]
        );
        await db.runAsync(
          'INSERT OR REPLACE INTO exercise_search_meta (key, value) VALUES (?, ?)',
          ['built_at', new Date().toISOString()]
        );
      });

      indexReady = true;
    } catch (error) {
      console.warn('[SearchIndex] Failed to build exercise search index:', error);
      indexPromise = null;
    }
  })();

  return indexPromise;
}

export async function queryExerciseSearchIndex(query: string, limit = 300): Promise<string[]> {
  const db = await getDatabase();
  if (!db) {
    return [];
  }

  await ensureExerciseSearchIndex();
  const matchQuery = normalizeMatchQuery(query);
  if (!matchQuery) {
    return [];
  }

  try {
    const rows = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM exercise_search WHERE exercise_search MATCH ? ORDER BY bm25(exercise_search) LIMIT ?',
      [matchQuery, limit]
    );
    return rows.map(row => row.id);
  } catch (error) {
    console.warn('[SearchIndex] Failed to query exercise search index:', error);
    return [];
  }
}
