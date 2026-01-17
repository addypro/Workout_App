/**
 * Offline Sync Queue
 *
 * Stores queued items in SQLite with AsyncStorage fallback (web/test environments).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { ensureSyncQueueTable, getDatabase } from '@/lib/db/sqlite';
import type { QueuedItem, SyncableWorkout } from './types';

const QUEUE_KEY = '@sync_queue';
const MAX_RETRIES = 5;

interface QueueBackend {
  initialize(): Promise<boolean>;
  addWorkout(workout: SyncableWorkout): Promise<void>;
  getPending(): Promise<QueuedItem[]>;
  getPendingCount(): Promise<number>;
  markSynced(itemId: string): Promise<void>;
  markFailed(itemId: string, error: string): Promise<void>;
  getFailedItems(): Promise<QueuedItem[]>;
  clearFailed(): Promise<void>;
  clear(): Promise<void>;
  resetRetries(): Promise<void>;
}

class AsyncStorageQueueBackend implements QueueBackend {
  private queue: QueuedItem[] = [];
  private loaded = false;

  async initialize(): Promise<boolean> {
    await this.load();
    return true;
  }

  private async load(): Promise<void> {
    if (this.loaded) return;

    try {
      const data = await AsyncStorage.getItem(QUEUE_KEY);
      this.queue = data ? JSON.parse(data) : [];
      this.loaded = true;
    } catch (error) {
      console.error('Failed to load sync queue:', error);
      this.queue = [];
      this.loaded = true;
    }
  }

  private async save(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  async addWorkout(workout: SyncableWorkout): Promise<void> {
    await this.load();

    const existing = this.queue.find(
      item => item.type === 'workout' && (item.data as SyncableWorkout).localId === workout.localId
    );

    if (existing) {
      existing.data = workout;
      existing.createdAt = new Date().toISOString();
    } else {
      const item: QueuedItem = {
        id: `workout_${workout.localId}`,
        type: 'workout',
        data: workout,
        createdAt: new Date().toISOString(),
        retryCount: 0,
      };
      this.queue.push(item);
    }

    await this.save();
  }

  async getPending(): Promise<QueuedItem[]> {
    await this.load();
    return this.queue.filter(item => item.retryCount < MAX_RETRIES);
  }

  async getPendingCount(): Promise<number> {
    await this.load();
    return this.queue.filter(item => item.retryCount < MAX_RETRIES).length;
  }

  async markSynced(itemId: string): Promise<void> {
    await this.load();
    this.queue = this.queue.filter(item => item.id !== itemId);
    await this.save();
  }

  async markFailed(itemId: string, error: string): Promise<void> {
    await this.load();
    const item = this.queue.find(i => i.id === itemId);
    if (item) {
      item.retryCount++;
      item.lastAttempt = new Date().toISOString();
      item.error = error;
      await this.save();
    }
  }

  async getFailedItems(): Promise<QueuedItem[]> {
    await this.load();
    return this.queue.filter(item => item.retryCount >= MAX_RETRIES);
  }

  async clearFailed(): Promise<void> {
    await this.load();
    this.queue = this.queue.filter(item => item.retryCount < MAX_RETRIES);
    await this.save();
  }

  async clear(): Promise<void> {
    this.queue = [];
    await this.save();
  }

  async resetRetries(): Promise<void> {
    await this.load();
    this.queue.forEach(item => {
      item.retryCount = 0;
      item.error = undefined;
    });
    await this.save();
  }
}

type SyncQueueRow = {
  id: string;
  type: string;
  data: string;
  created_at: string;
  retry_count: number;
  last_attempt: string | null;
  error: string | null;
};

class SQLiteQueueBackend implements QueueBackend {
  private ready: Promise<boolean> | null = null;

  async initialize(): Promise<boolean> {
    if (!this.ready) {
      this.ready = ensureSyncQueueTable();
    }
    return this.ready;
  }

  private async getDb() {
    const ready = await this.initialize();
    if (!ready) return null;
    return getDatabase();
  }

  private toItem(row: SyncQueueRow): QueuedItem | null {
    if (row.type !== 'workout') {
      return null;
    }

    try {
      const data = JSON.parse(row.data) as SyncableWorkout;
      return {
        id: row.id,
        type: 'workout',
        data,
        createdAt: row.created_at,
        retryCount: row.retry_count,
        lastAttempt: row.last_attempt ?? undefined,
        error: row.error ?? undefined,
      };
    } catch (error) {
      console.warn('[SyncQueue] Failed to parse queued item:', error);
      return null;
    }
  }

  async addWorkout(workout: SyncableWorkout): Promise<void> {
    const db = await this.getDb();
    if (!db) return;

    const itemId = `workout_${workout.localId}`;
    const now = new Date().toISOString();
    const payload = JSON.stringify(workout);

    try {
      const update = await db.runAsync(
        'UPDATE sync_queue SET data = ?, created_at = ? WHERE id = ?',
        [payload, now, itemId]
      );

      if (update.changes === 0) {
        await db.runAsync(
          'INSERT INTO sync_queue (id, type, data, created_at, retry_count) VALUES (?, ?, ?, ?, 0)',
          [itemId, 'workout', payload, now]
        );
      }
    } catch (error) {
      console.warn('[SyncQueue] Failed to enqueue workout:', error);
    }
  }

  async getPending(): Promise<QueuedItem[]> {
    const db = await this.getDb();
    if (!db) return [];

    try {
      const rows = await db.getAllAsync<SyncQueueRow>(
        'SELECT id, type, data, created_at, retry_count, last_attempt, error FROM sync_queue WHERE retry_count < ? ORDER BY created_at ASC',
        [MAX_RETRIES]
      );

      return rows
        .map(row => this.toItem(row))
        .filter((item): item is QueuedItem => item !== null);
    } catch (error) {
      console.warn('[SyncQueue] Failed to load pending queue:', error);
      return [];
    }
  }

  async getPendingCount(): Promise<number> {
    const db = await this.getDb();
    if (!db) return 0;

    try {
      const row = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM sync_queue WHERE retry_count < ?',
        [MAX_RETRIES]
      );
      return row?.count ?? 0;
    } catch (error) {
      console.warn('[SyncQueue] Failed to count pending queue:', error);
      return 0;
    }
  }

  async markSynced(itemId: string): Promise<void> {
    const db = await this.getDb();
    if (!db) return;

    try {
      await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [itemId]);
    } catch (error) {
      console.warn('[SyncQueue] Failed to remove synced item:', error);
    }
  }

  async markFailed(itemId: string, error: string): Promise<void> {
    const db = await this.getDb();
    if (!db) return;

    try {
      await db.runAsync(
        'UPDATE sync_queue SET retry_count = retry_count + 1, last_attempt = ?, error = ? WHERE id = ?',
        [new Date().toISOString(), error, itemId]
      );
    } catch (err) {
      console.warn('[SyncQueue] Failed to mark item failed:', err);
    }
  }

  async getFailedItems(): Promise<QueuedItem[]> {
    const db = await this.getDb();
    if (!db) return [];

    try {
      const rows = await db.getAllAsync<SyncQueueRow>(
        'SELECT id, type, data, created_at, retry_count, last_attempt, error FROM sync_queue WHERE retry_count >= ? ORDER BY created_at ASC',
        [MAX_RETRIES]
      );

      return rows
        .map(row => this.toItem(row))
        .filter((item): item is QueuedItem => item !== null);
    } catch (error) {
      console.warn('[SyncQueue] Failed to load failed items:', error);
      return [];
    }
  }

  async clearFailed(): Promise<void> {
    const db = await this.getDb();
    if (!db) return;

    try {
      await db.runAsync('DELETE FROM sync_queue WHERE retry_count >= ?', [MAX_RETRIES]);
    } catch (error) {
      console.warn('[SyncQueue] Failed to clear failed items:', error);
    }
  }

  async clear(): Promise<void> {
    const db = await this.getDb();
    if (!db) return;

    try {
      await db.runAsync('DELETE FROM sync_queue');
    } catch (error) {
      console.warn('[SyncQueue] Failed to clear queue:', error);
    }
  }

  async resetRetries(): Promise<void> {
    const db = await this.getDb();
    if (!db) return;

    try {
      await db.runAsync('UPDATE sync_queue SET retry_count = 0, error = NULL');
    } catch (error) {
      console.warn('[SyncQueue] Failed to reset retries:', error);
    }
  }
}

class SyncQueue {
  private backend: QueueBackend | null = null;
  private backendInit: Promise<void> | null = null;

  private async getBackend(): Promise<QueueBackend> {
    if (!this.backendInit) {
      this.backendInit = (async () => {
        const sqliteBackend = new SQLiteQueueBackend();
        const sqliteReady = await sqliteBackend.initialize();

        if (sqliteReady) {
          this.backend = sqliteBackend;
          return;
        }

        const asyncBackend = new AsyncStorageQueueBackend();
        await asyncBackend.initialize();
        this.backend = asyncBackend;
      })();
    }

    await this.backendInit;
    return this.backend as QueueBackend;
  }

  async addWorkout(workout: SyncableWorkout): Promise<void> {
    const backend = await this.getBackend();
    await backend.addWorkout(workout);
  }

  async getPending(): Promise<QueuedItem[]> {
    const backend = await this.getBackend();
    return backend.getPending();
  }

  async getPendingCount(): Promise<number> {
    const backend = await this.getBackend();
    return backend.getPendingCount();
  }

  async markSynced(itemId: string): Promise<void> {
    const backend = await this.getBackend();
    await backend.markSynced(itemId);
  }

  async markFailed(itemId: string, error: string): Promise<void> {
    const backend = await this.getBackend();
    await backend.markFailed(itemId, error);
  }

  async getFailedItems(): Promise<QueuedItem[]> {
    const backend = await this.getBackend();
    return backend.getFailedItems();
  }

  async clearFailed(): Promise<void> {
    const backend = await this.getBackend();
    await backend.clearFailed();
  }

  async clear(): Promise<void> {
    const backend = await this.getBackend();
    await backend.clear();
  }

  async resetRetries(): Promise<void> {
    const backend = await this.getBackend();
    await backend.resetRetries();
  }
}

export const syncQueue = new SyncQueue();
