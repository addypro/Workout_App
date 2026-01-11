/**
 * Tab Context Provider
 *
 * Context-aware navigation system where tabs act as "mini-apps" with specific rules.
 * Auto-filters content and auto-tags new entries based on active context.
 *
 * Features:
 * - Persistent filter state per tab
 * - Context inheritance between screens
 * - Auto-tagging for new entries
 * - URL parameter sync
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useEffect,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// TYPES
// ============================================================================

export type TabName = 'programs' | 'discover' | 'exercises' | 'tools';

export interface ContextFilters {
  /** Filter by muscle group */
  muscleGroup?: string;
  /** Filter by equipment */
  equipment?: string;
  /** Filter by difficulty level */
  difficulty?: string;
  /** Filter by program ID (when coming from a specific program) */
  programId?: string;
  /** Filter by workout type */
  workoutType?: string;
  /** Search query */
  searchQuery?: string;
}

export interface TabState {
  /** Current active filters */
  filters: ContextFilters;
  /** Auto-tags to apply to new entries */
  autoTags: string[];
  /** Last scroll position for restoration */
  scrollPosition: number;
  /** Source context (where user came from) */
  sourceContext?: {
    tab: TabName;
    label: string;
  };
}

export interface TabContextState {
  /** Currently active tab */
  activeTab: TabName;
  /** State for each tab */
  tabStates: Record<TabName, TabState>;
  /** Whether context inheritance is enabled */
  inheritContext: boolean;
}

type TabContextAction =
  | { type: 'SET_ACTIVE_TAB'; tab: TabName }
  | { type: 'SET_FILTER'; tab: TabName; key: keyof ContextFilters; value: string | undefined }
  | { type: 'SET_FILTERS'; tab: TabName; filters: Partial<ContextFilters> }
  | { type: 'CLEAR_FILTERS'; tab: TabName }
  | { type: 'SET_AUTO_TAGS'; tab: TabName; tags: string[] }
  | { type: 'SET_SCROLL_POSITION'; tab: TabName; position: number }
  | { type: 'SET_SOURCE_CONTEXT'; tab: TabName; source: TabState['sourceContext'] }
  | { type: 'INHERIT_CONTEXT'; fromTab: TabName; toTab: TabName }
  | { type: 'TOGGLE_INHERIT_CONTEXT' }
  | { type: 'RESTORE_STATE'; state: TabContextState };

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialTabState: TabState = {
  filters: {},
  autoTags: [],
  scrollPosition: 0,
  sourceContext: undefined,
};

const initialState: TabContextState = {
  activeTab: 'programs',
  tabStates: {
    programs: { ...initialTabState },
    discover: { ...initialTabState },
    exercises: { ...initialTabState },
    tools: { ...initialTabState },
  },
  inheritContext: true,
};

// ============================================================================
// REDUCER
// ============================================================================

function tabContextReducer(
  state: TabContextState,
  action: TabContextAction
): TabContextState {
  switch (action.type) {
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.tab };

    case 'SET_FILTER':
      return {
        ...state,
        tabStates: {
          ...state.tabStates,
          [action.tab]: {
            ...state.tabStates[action.tab],
            filters: {
              ...state.tabStates[action.tab].filters,
              [action.key]: action.value,
            },
          },
        },
      };

    case 'SET_FILTERS':
      return {
        ...state,
        tabStates: {
          ...state.tabStates,
          [action.tab]: {
            ...state.tabStates[action.tab],
            filters: {
              ...state.tabStates[action.tab].filters,
              ...action.filters,
            },
          },
        },
      };

    case 'CLEAR_FILTERS':
      return {
        ...state,
        tabStates: {
          ...state.tabStates,
          [action.tab]: {
            ...state.tabStates[action.tab],
            filters: {},
            autoTags: [],
          },
        },
      };

    case 'SET_AUTO_TAGS':
      return {
        ...state,
        tabStates: {
          ...state.tabStates,
          [action.tab]: {
            ...state.tabStates[action.tab],
            autoTags: action.tags,
          },
        },
      };

    case 'SET_SCROLL_POSITION':
      return {
        ...state,
        tabStates: {
          ...state.tabStates,
          [action.tab]: {
            ...state.tabStates[action.tab],
            scrollPosition: action.position,
          },
        },
      };

    case 'SET_SOURCE_CONTEXT':
      return {
        ...state,
        tabStates: {
          ...state.tabStates,
          [action.tab]: {
            ...state.tabStates[action.tab],
            sourceContext: action.source,
          },
        },
      };

    case 'INHERIT_CONTEXT':
      if (!state.inheritContext) return state;
      const sourceState = state.tabStates[action.fromTab];
      return {
        ...state,
        tabStates: {
          ...state.tabStates,
          [action.toTab]: {
            ...state.tabStates[action.toTab],
            filters: { ...sourceState.filters },
            sourceContext: {
              tab: action.fromTab,
              label: getTabLabel(action.fromTab),
            },
          },
        },
      };

    case 'TOGGLE_INHERIT_CONTEXT':
      return { ...state, inheritContext: !state.inheritContext };

    case 'RESTORE_STATE':
      return action.state;

    default:
      return state;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function getTabLabel(tab: TabName): string {
  const labels: Record<TabName, string> = {
    programs: 'My Programs',
    discover: 'Discover',
    exercises: 'Exercises',
    tools: 'Tools',
  };
  return labels[tab];
}

const STORAGE_KEY = '@tab_context_state';

// ============================================================================
// CONTEXT
// ============================================================================

interface TabContextValue extends TabContextState {
  /** Set the active tab */
  setActiveTab: (tab: TabName) => void;
  /** Set a single filter */
  setFilter: (tab: TabName, key: keyof ContextFilters, value: string | undefined) => void;
  /** Set multiple filters at once */
  setFilters: (tab: TabName, filters: Partial<ContextFilters>) => void;
  /** Clear all filters for a tab */
  clearFilters: (tab: TabName) => void;
  /** Set auto-tags for new entries */
  setAutoTags: (tab: TabName, tags: string[]) => void;
  /** Save scroll position */
  setScrollPosition: (tab: TabName, position: number) => void;
  /** Navigate with context */
  navigateWithContext: (fromTab: TabName, toTab: TabName) => void;
  /** Get current tab state */
  getCurrentTabState: () => TabState;
  /** Get active filters count */
  getActiveFiltersCount: (tab: TabName) => number;
  /** Check if filters are active */
  hasActiveFilters: (tab: TabName) => boolean;
  /** Generate filter pills for display */
  getFilterPills: (tab: TabName) => { key: string; label: string; value: string }[];
}

const TabContext = createContext<TabContextValue | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

export function TabContextProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(tabContextReducer, initialState);

  // Persist state to AsyncStorage
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(console.error);
  }, [state]);

  // Restore state on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          dispatch({ type: 'RESTORE_STATE', state: parsed });
        } catch (e) {
          console.error('Failed to restore tab context:', e);
        }
      }
    });
  }, []);

  const setActiveTab = useCallback((tab: TabName) => {
    dispatch({ type: 'SET_ACTIVE_TAB', tab });
  }, []);

  const setFilter = useCallback(
    (tab: TabName, key: keyof ContextFilters, value: string | undefined) => {
      dispatch({ type: 'SET_FILTER', tab, key, value });
    },
    []
  );

  const setFilters = useCallback(
    (tab: TabName, filters: Partial<ContextFilters>) => {
      dispatch({ type: 'SET_FILTERS', tab, filters });
    },
    []
  );

  const clearFilters = useCallback((tab: TabName) => {
    dispatch({ type: 'CLEAR_FILTERS', tab });
  }, []);

  const setAutoTags = useCallback((tab: TabName, tags: string[]) => {
    dispatch({ type: 'SET_AUTO_TAGS', tab, tags });
  }, []);

  const setScrollPosition = useCallback((tab: TabName, position: number) => {
    dispatch({ type: 'SET_SCROLL_POSITION', tab, position });
  }, []);

  const navigateWithContext = useCallback((fromTab: TabName, toTab: TabName) => {
    dispatch({ type: 'INHERIT_CONTEXT', fromTab, toTab });
    dispatch({ type: 'SET_ACTIVE_TAB', tab: toTab });
  }, []);

  const getCurrentTabState = useCallback(() => {
    return state.tabStates[state.activeTab];
  }, [state.activeTab, state.tabStates]);

  const getActiveFiltersCount = useCallback(
    (tab: TabName) => {
      const filters = state.tabStates[tab].filters;
      return Object.values(filters).filter(Boolean).length;
    },
    [state.tabStates]
  );

  const hasActiveFilters = useCallback(
    (tab: TabName) => getActiveFiltersCount(tab) > 0,
    [getActiveFiltersCount]
  );

  const getFilterPills = useCallback(
    (tab: TabName) => {
      const filters = state.tabStates[tab].filters;
      const pills: { key: string; label: string; value: string }[] = [];

      if (filters.muscleGroup) {
        pills.push({ key: 'muscleGroup', label: 'Muscle', value: filters.muscleGroup });
      }
      if (filters.equipment) {
        pills.push({ key: 'equipment', label: 'Equipment', value: filters.equipment });
      }
      if (filters.difficulty) {
        pills.push({ key: 'difficulty', label: 'Level', value: filters.difficulty });
      }
      if (filters.workoutType) {
        pills.push({ key: 'workoutType', label: 'Type', value: filters.workoutType });
      }

      return pills;
    },
    [state.tabStates]
  );

  const value = useMemo<TabContextValue>(
    () => ({
      ...state,
      setActiveTab,
      setFilter,
      setFilters,
      clearFilters,
      setAutoTags,
      setScrollPosition,
      navigateWithContext,
      getCurrentTabState,
      getActiveFiltersCount,
      hasActiveFilters,
      getFilterPills,
    }),
    [
      state,
      setActiveTab,
      setFilter,
      setFilters,
      clearFilters,
      setAutoTags,
      setScrollPosition,
      navigateWithContext,
      getCurrentTabState,
      getActiveFiltersCount,
      hasActiveFilters,
      getFilterPills,
    ]
  );

  return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}

// ============================================================================
// HOOKS
// ============================================================================

export function useTabContext() {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error('useTabContext must be used within a TabContextProvider');
  }
  return context;
}

/**
 * Hook for using tab-specific state
 */
export function useTabState(tab: TabName) {
  const context = useTabContext();

  return useMemo(
    () => ({
      state: context.tabStates[tab],
      filters: context.tabStates[tab].filters,
      autoTags: context.tabStates[tab].autoTags,
      hasFilters: context.hasActiveFilters(tab),
      filterCount: context.getActiveFiltersCount(tab),
      filterPills: context.getFilterPills(tab),
      setFilter: (key: keyof ContextFilters, value: string | undefined) =>
        context.setFilter(tab, key, value),
      setFilters: (filters: Partial<ContextFilters>) =>
        context.setFilters(tab, filters),
      clearFilters: () => context.clearFilters(tab),
      setAutoTags: (tags: string[]) => context.setAutoTags(tab, tags),
      setScrollPosition: (position: number) =>
        context.setScrollPosition(tab, position),
    }),
    [context, tab]
  );
}

/**
 * Hook for context pills display
 */
export function useContextPills() {
  const { activeTab, getFilterPills, tabStates, clearFilters } = useTabContext();
  const pills = getFilterPills(activeTab);
  const sourceContext = tabStates[activeTab].sourceContext;

  return {
    pills,
    sourceContext,
    hasPills: pills.length > 0 || !!sourceContext,
    clearAll: () => clearFilters(activeTab),
  };
}
