/**
 * Storage Key Collision Prevention Test
 *
 * Verifies that two active workouts with the same raw UUID but different sources
 * do NOT collide in AsyncStorage or SQLite.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  setActiveWorkoutState,
  getActiveWorkoutState,
  clearActiveWorkoutState,
  type ActiveWorkoutState,
  type StoredWorkoutSession,
} from '@/lib/db/storage';

// Mock getDatabase to avoid SQLite in tests
jest.mock('@/lib/db/sqlite', () => ({
  getDatabase: jest.fn().mockResolvedValue(null),
  ensureStorageTables: jest.fn().mockResolvedValue(false),
}));

describe('Storage Key Collision Prevention', () => {
  const userId = 'test-user-123';
  const sharedWorkoutKey = 'collision-test-uuid';

  const createMockSession = (source: 'self' | 'assigned', workoutName: string): StoredWorkoutSession => ({
    id: `session-${source}`,
    workoutKey: sharedWorkoutKey,
    source,
    workoutName,
    exercises: [],
    startTime: new Date().toISOString(),
    currentExerciseIndex: 0,
    isResting: false,
    restTimeRemaining: 0,
    status: 'in_progress',
  });

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it('should NOT collide when same workoutKey used for self and assigned sources', async () => {
    // Create two active workouts with same UUID but different sources
    const selfSession = createMockSession('self', 'My Self Program');
    const assignedSession = createMockSession('assigned', 'Coach Assigned Workout');

    const selfState: ActiveWorkoutState = {
      session: selfSession,
      elapsedSeconds: 100,
      lastUpdatedAt: Date.now(),
    };

    const assignedState: ActiveWorkoutState = {
      session: assignedSession,
      elapsedSeconds: 200,
      lastUpdatedAt: Date.now(),
    };

    // Write both to storage
    await setActiveWorkoutState(userId, 'self', sharedWorkoutKey, selfState);
    await setActiveWorkoutState(userId, 'assigned', sharedWorkoutKey, assignedState);

    // Verify both can be retrieved independently
    const retrievedSelf = await getActiveWorkoutState(userId, 'self', sharedWorkoutKey);
    const retrievedAssigned = await getActiveWorkoutState(userId, 'assigned', sharedWorkoutKey);

    // Both should exist
    expect(retrievedSelf).not.toBeNull();
    expect(retrievedAssigned).not.toBeNull();

    // Both should have correct data
    expect(retrievedSelf?.session.workoutName).toBe('My Self Program');
    expect(retrievedSelf?.session.source).toBe('self');
    expect(retrievedSelf?.elapsedSeconds).toBe(100);

    expect(retrievedAssigned?.session.workoutName).toBe('Coach Assigned Workout');
    expect(retrievedAssigned?.session.source).toBe('assigned');
    expect(retrievedAssigned?.elapsedSeconds).toBe(200);

    // Verify storage keys are different
    const allKeys = await AsyncStorage.getAllKeys();
    const activeWorkoutKeys = allKeys.filter(k => k.startsWith('@active_workout:'));

    expect(activeWorkoutKeys).toHaveLength(2);
    expect(activeWorkoutKeys).toContain(`@active_workout:${userId}:self:${sharedWorkoutKey}`);
    expect(activeWorkoutKeys).toContain(`@active_workout:${userId}:assigned:${sharedWorkoutKey}`);
  });

  it('should clear only the specified source without affecting the other', async () => {
    const selfSession = createMockSession('self', 'My Self Program');
    const assignedSession = createMockSession('assigned', 'Coach Assigned Workout');

    const selfState: ActiveWorkoutState = {
      session: selfSession,
      elapsedSeconds: 100,
      lastUpdatedAt: Date.now(),
    };

    const assignedState: ActiveWorkoutState = {
      session: assignedSession,
      elapsedSeconds: 200,
      lastUpdatedAt: Date.now(),
    };

    // Write both
    await setActiveWorkoutState(userId, 'self', sharedWorkoutKey, selfState);
    await setActiveWorkoutState(userId, 'assigned', sharedWorkoutKey, assignedState);

    // Clear only self
    await clearActiveWorkoutState(userId, 'self', sharedWorkoutKey);

    // Self should be gone
    const retrievedSelf = await getActiveWorkoutState(userId, 'self', sharedWorkoutKey);
    expect(retrievedSelf).toBeNull();

    // Assigned should still exist
    const retrievedAssigned = await getActiveWorkoutState(userId, 'assigned', sharedWorkoutKey);
    expect(retrievedAssigned).not.toBeNull();
    expect(retrievedAssigned?.session.workoutName).toBe('Coach Assigned Workout');
  });

  it('should handle legacy keys without collision with new format', async () => {
    // Simulate legacy key (pre-migration)
    const legacyKey = `@active_workout:${userId}:${sharedWorkoutKey}`;
    const legacySession = createMockSession('self', 'Legacy Workout');
    const legacyState: ActiveWorkoutState = {
      session: legacySession,
      elapsedSeconds: 50,
      lastUpdatedAt: Date.now(),
    };
    await AsyncStorage.setItem(legacyKey, JSON.stringify(legacyState));

    // Write new format assigned workout
    const assignedSession = createMockSession('assigned', 'New Format Assigned');
    const assignedState: ActiveWorkoutState = {
      session: assignedSession,
      elapsedSeconds: 150,
      lastUpdatedAt: Date.now(),
    };
    await setActiveWorkoutState(userId, 'assigned', sharedWorkoutKey, assignedState);

    // Verify both keys exist (legacy not yet migrated)
    const allKeys = await AsyncStorage.getAllKeys();
    expect(allKeys).toContain(legacyKey);
    expect(allKeys).toContain(`@active_workout:${userId}:assigned:${sharedWorkoutKey}`);

    // Reading with 'self' source should find and migrate legacy key
    const retrievedSelf = await getActiveWorkoutState(userId, 'self', sharedWorkoutKey);
    expect(retrievedSelf).not.toBeNull();
    expect(retrievedSelf?.session.workoutName).toBe('Legacy Workout');

    // After migration, legacy key should be removed and new key should exist
    const keysAfterMigration = await AsyncStorage.getAllKeys();
    expect(keysAfterMigration).not.toContain(legacyKey);
    expect(keysAfterMigration).toContain(`@active_workout:${userId}:self:${sharedWorkoutKey}`);

    // Assigned should still be there
    const retrievedAssigned = await getActiveWorkoutState(userId, 'assigned', sharedWorkoutKey);
    expect(retrievedAssigned).not.toBeNull();
    expect(retrievedAssigned?.session.workoutName).toBe('New Format Assigned');
  });
});
