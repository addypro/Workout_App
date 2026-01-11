/**
 * Offline Sync Queue
 *
 * Manages a persistent queue of items waiting to be synced.
 * Uses AsyncStorage for persistence across app restarts.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueuedItem, SyncableWorkout } from './types';

const QUEUE_KEY = '@sync_queue';
const MAX_RETRIES = 5;

class SyncQueue {
  private queue: QueuedItem[] = [];
  private loaded = false;

  /**
   * Load queue from AsyncStorage
   */
  async load(): Promise<void> {
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

  /**
   * Save queue to AsyncStorage
   */
  private async save(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  /**
   * Add a workout to the sync queue
   */
  async addWorkout(workout: SyncableWorkout): Promise<void> {
    await this.load();

    // Check if already queued (by localId)
    const existing = this.queue.find(
      item => item.type === 'workout' && item.data.localId === workout.localId
    );

    if (existing) {
      // Update existing item
      existing.data = workout;
      existing.createdAt = new Date().toISOString();
    } else {
      // Add new item
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

  /**
   * Get all pending items
   */
  async getPending(): Promise<QueuedItem[]> {
    await this.load();
    return this.queue.filter(item => item.retryCount < MAX_RETRIES);
  }

  /**
   * Get count of pending items
   */
  async getPendingCount(): Promise<number> {
    await this.load();
    return this.queue.filter(item => item.retryCount < MAX_RETRIES).length;
  }

  /**
   * Mark an item as successfully synced (remove from queue)
   */
  async markSynced(itemId: string): Promise<void> {
    await this.load();
    this.queue = this.queue.filter(item => item.id !== itemId);
    await this.save();
  }

  /**
   * Mark an item as failed (increment retry count)
   */
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

  /**
   * Get failed items (exceeded retry limit)
   */
  async getFailedItems(): Promise<QueuedItem[]> {
    await this.load();
    return this.queue.filter(item => item.retryCount >= MAX_RETRIES);
  }

  /**
   * Clear failed items
   */
  async clearFailed(): Promise<void> {
    await this.load();
    this.queue = this.queue.filter(item => item.retryCount < MAX_RETRIES);
    await this.save();
  }

  /**
   * Clear entire queue
   */
  async clear(): Promise<void> {
    this.queue = [];
    await this.save();
  }

  /**
   * Reset retry count for all items (useful after reconnecting)
   */
  async resetRetries(): Promise<void> {
    await this.load();
    this.queue.forEach(item => {
      item.retryCount = 0;
      item.error = undefined;
    });
    await this.save();
  }
}

export const syncQueue = new SyncQueue();
