import { useState, useCallback, useMemo } from 'react';
import * as Haptics from 'expo-haptics';

export type SelectionState<T extends { id: string }> = {
  selectedIds: Set<string>;
  selectedCount: number;
  hasSelection: boolean;
  isSelected: (item: T) => boolean;
  toggle: (item: T) => void;
  select: (item: T) => void;
  deselect: (item: T) => void;
  selectAll: (items: T[]) => void;
  clear: () => void;
  getSelected: (items: T[]) => T[];
};

/**
 * Hook for managing multi-select state with haptic feedback.
 *
 * @example
 * const selection = useSelection<ProgramDisplayItem>();
 *
 * // In render:
 * <ProgramCard
 *   isSelected={selection.isSelected(program)}
 *   onToggle={() => selection.toggle(program)}
 * />
 *
 * // Get selected items:
 * const selectedPrograms = selection.getSelected(allPrograms);
 */
export function useSelection<T extends { id: string }>(
  options: {
    haptics?: boolean;
  } = {}
): SelectionState<T> {
  const { haptics = true } = options;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((item: T) => {
    if (haptics) {
      Haptics.selectionAsync();
    }
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  }, [haptics]);

  const select = useCallback((item: T) => {
    if (haptics) {
      Haptics.selectionAsync();
    }
    setSelectedIds(prev => {
      if (prev.has(item.id)) return prev;
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
  }, [haptics]);

  const deselect = useCallback((item: T) => {
    if (haptics) {
      Haptics.selectionAsync();
    }
    setSelectedIds(prev => {
      if (!prev.has(item.id)) return prev;
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
  }, [haptics]);

  const selectAll = useCallback((items: T[]) => {
    if (haptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedIds(new Set(items.map(item => item.id)));
  }, [haptics]);

  const clear = useCallback(() => {
    if (haptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedIds(new Set());
  }, [haptics]);

  const isSelected = useCallback((item: T) => {
    return selectedIds.has(item.id);
  }, [selectedIds]);

  const getSelected = useCallback((items: T[]) => {
    return items.filter(item => selectedIds.has(item.id));
  }, [selectedIds]);

  return useMemo(() => ({
    selectedIds,
    selectedCount: selectedIds.size,
    hasSelection: selectedIds.size > 0,
    isSelected,
    toggle,
    select,
    deselect,
    selectAll,
    clear,
    getSelected,
  }), [selectedIds, isSelected, toggle, select, deselect, selectAll, clear, getSelected]);
}
