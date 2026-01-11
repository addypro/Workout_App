/**
 * Optimistic Update Hook
 *
 * Enables instant-feel UI by updating state immediately while syncing in background.
 * Provides automatic rollback on error with toast notification.
 *
 * Features:
 * - Immediate UI updates (zero perceived latency)
 * - Background sync with retry
 * - Automatic rollback on failure
 * - Pending state tracking
 * - Error handling with recovery
 */

import { useCallback, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// ============================================================================
// TYPES
// ============================================================================

export interface OptimisticState<T> {
  /** The current optimistic value */
  value: T;
  /** Whether an async operation is pending */
  isPending: boolean;
  /** The last error that occurred */
  error: Error | null;
  /** Whether we're in a rollback state */
  isRolledBack: boolean;
}

export interface OptimisticOptions {
  /** Retry count on failure (default: 0) */
  retries?: number;
  /** Delay between retries in ms (default: 1000) */
  retryDelay?: number;
  /** Callback when update succeeds */
  onSuccess?: () => void;
  /** Callback when update fails after all retries */
  onError?: (error: Error) => void;
  /** Callback when rollback occurs */
  onRollback?: (previousValue: unknown) => void;
  /** Whether to provide haptic feedback (default: true) */
  hapticFeedback?: boolean;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for optimistic updates with automatic rollback
 *
 * @example
 * ```tsx
 * const { value, isPending, update } = useOptimistic(
 *   workout.sets,
 *   async (newSets) => {
 *     await api.updateSets(workoutId, newSets);
 *   }
 * );
 *
 * // In your UI:
 * <Button onPress={() => update([...value, newSet])}>
 *   Add Set
 * </Button>
 * ```
 */
export function useOptimistic<T>(
  initialValue: T,
  asyncAction: (value: T) => Promise<void>,
  options: OptimisticOptions = {}
): OptimisticState<T> & {
  update: (newValue: T | ((prev: T) => T)) => void;
  reset: () => void;
} {
  const {
    retries = 0,
    retryDelay = 1000,
    onSuccess,
    onError,
    onRollback,
    hapticFeedback = true,
  } = options;

  const [state, setState] = useState<OptimisticState<T>>({
    value: initialValue,
    isPending: false,
    error: null,
    isRolledBack: false,
  });

  // Keep track of the last confirmed value for rollback
  const confirmedValueRef = useRef<T>(initialValue);

  // Track pending operations to handle race conditions
  const pendingOperationRef = useRef<number>(0);

  const triggerHaptic = useCallback(
    (type: 'success' | 'error' | 'light') => {
      if (!hapticFeedback || Platform.OS === 'web') return;

      switch (type) {
        case 'success':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'error':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
        case 'light':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
      }
    },
    [hapticFeedback]
  );

  const update = useCallback(
    async (newValue: T | ((prev: T) => T)) => {
      const operationId = ++pendingOperationRef.current;
      const previousValue = state.value;

      // Resolve the new value if it's a function
      const resolvedValue =
        typeof newValue === 'function'
          ? (newValue as (prev: T) => T)(previousValue)
          : newValue;

      // Immediately update UI (optimistic update)
      setState((prev) => ({
        ...prev,
        value: resolvedValue,
        isPending: true,
        error: null,
        isRolledBack: false,
      }));

      triggerHaptic('light');

      // Attempt async action with retries
      let lastError: Error | null = null;
      let attempts = 0;

      while (attempts <= retries) {
        try {
          await asyncAction(resolvedValue);

          // Check if this operation is still relevant
          if (operationId !== pendingOperationRef.current) {
            return; // A newer operation has started, ignore this result
          }

          // Success! Update confirmed value
          confirmedValueRef.current = resolvedValue;
          setState((prev) => ({
            ...prev,
            isPending: false,
            error: null,
          }));

          triggerHaptic('success');
          onSuccess?.();
          return;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          attempts++;

          if (attempts <= retries) {
            // Wait before retry
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
          }
        }
      }

      // Check if this operation is still relevant
      if (operationId !== pendingOperationRef.current) {
        return;
      }

      // All retries failed - rollback
      setState({
        value: confirmedValueRef.current,
        isPending: false,
        error: lastError,
        isRolledBack: true,
      });

      triggerHaptic('error');
      onRollback?.(previousValue);
      onError?.(lastError!);
    },
    [
      state.value,
      asyncAction,
      retries,
      retryDelay,
      onSuccess,
      onError,
      onRollback,
      triggerHaptic,
    ]
  );

  const reset = useCallback(() => {
    setState({
      value: confirmedValueRef.current,
      isPending: false,
      error: null,
      isRolledBack: false,
    });
  }, []);

  return {
    ...state,
    update,
    reset,
  };
}

// ============================================================================
// LIST OPTIMISTIC HOOK
// ============================================================================

/**
 * Specialized hook for optimistic list operations (add, remove, update)
 */
export function useOptimisticList<T extends { id: string | number }>(
  initialItems: T[],
  syncAction: (items: T[]) => Promise<void>,
  options: OptimisticOptions = {}
) {
  const {
    value: items,
    isPending,
    error,
    isRolledBack,
    update,
    reset,
  } = useOptimistic(initialItems, syncAction, options);

  const addItem = useCallback(
    (item: T) => {
      update((prev) => [...prev, item]);
    },
    [update]
  );

  const removeItem = useCallback(
    (id: T['id']) => {
      update((prev) => prev.filter((item) => item.id !== id));
    },
    [update]
  );

  const updateItem = useCallback(
    (id: T['id'], updates: Partial<T>) => {
      update((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, ...updates } : item
        )
      );
    },
    [update]
  );

  const reorderItems = useCallback(
    (fromIndex: number, toIndex: number) => {
      update((prev) => {
        const result = [...prev];
        const [removed] = result.splice(fromIndex, 1);
        result.splice(toIndex, 0, removed);
        return result;
      });
    },
    [update]
  );

  return {
    items,
    isPending,
    error,
    isRolledBack,
    addItem,
    removeItem,
    updateItem,
    reorderItems,
    reset,
  };
}

// ============================================================================
// TOGGLE OPTIMISTIC HOOK
// ============================================================================

/**
 * Specialized hook for optimistic boolean toggles
 */
export function useOptimisticToggle(
  initialValue: boolean,
  asyncAction: (value: boolean) => Promise<void>,
  options: OptimisticOptions = {}
) {
  const { value, isPending, error, update, reset } = useOptimistic(
    initialValue,
    asyncAction,
    options
  );

  const toggle = useCallback(() => {
    update((prev) => !prev);
  }, [update]);

  const setOn = useCallback(() => {
    update(true);
  }, [update]);

  const setOff = useCallback(() => {
    update(false);
  }, [update]);

  return {
    isOn: value,
    isPending,
    error,
    toggle,
    setOn,
    setOff,
    reset,
  };
}

// ============================================================================
// COUNTER OPTIMISTIC HOOK
// ============================================================================

/**
 * Specialized hook for optimistic counter operations
 */
export function useOptimisticCounter(
  initialValue: number,
  asyncAction: (value: number) => Promise<void>,
  options: OptimisticOptions & { min?: number; max?: number } = {}
) {
  const { min = -Infinity, max = Infinity, ...restOptions } = options;

  const { value, isPending, error, update, reset } = useOptimistic(
    initialValue,
    asyncAction,
    restOptions
  );

  const increment = useCallback(
    (by = 1) => {
      update((prev) => Math.min(max, prev + by));
    },
    [update, max]
  );

  const decrement = useCallback(
    (by = 1) => {
      update((prev) => Math.max(min, prev - by));
    },
    [update, min]
  );

  const setValue = useCallback(
    (newValue: number) => {
      update(Math.max(min, Math.min(max, newValue)));
    },
    [update, min, max]
  );

  return {
    count: value,
    isPending,
    error,
    increment,
    decrement,
    setValue,
    reset,
  };
}
