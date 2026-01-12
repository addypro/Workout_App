/**
 * Sync Queue XState Actor Model
 *
 * Models individual sync items as actors with exponential backoff.
 * Eliminates implicit state transitions and provides formal retry semantics.
 *
 * States:
 * - pending: Waiting to sync
 * - syncing: Currently syncing to server
 * - retrying: Waiting to retry (with exponential backoff)
 * - synced: Successfully synced (final)
 * - failed: Permanently failed after max retries (final)
 */

import { assign, setup } from 'xstate';

// ============================================
// CONTEXT
// ============================================

export interface SyncItemContext {
    itemId: string;
    itemType: 'workout' | 'exercise' | 'settings';
    data: unknown;
    createdAt: number;
    retryCount: number;
    maxRetries: number;
    lastError: string | null;
    lastAttempt: number | null;
}

// ============================================
// EVENTS
// ============================================

export type SyncItemEvent =
    | { type: 'START_SYNC' }
    | { type: 'SYNC_SUCCESS'; serverResponse?: unknown }
    | { type: 'SYNC_ERROR'; error: string }
    | { type: 'RETRY' }
    | { type: 'CANCEL' }
    | { type: 'RESET' };

// ============================================
// BACKOFF DELAYS (exponential: 1s, 2s, 4s, 8s, 16s)
// ============================================

const BACKOFF_DELAYS = [1000, 2000, 4000, 8000, 16000];

function getBackoffDelay(retryCount: number): number {
    return BACKOFF_DELAYS[Math.min(retryCount, BACKOFF_DELAYS.length - 1)];
}

// ============================================
// MACHINE
// ============================================

export const syncItemMachine = setup({
    types: {
        context: {} as SyncItemContext,
        events: {} as SyncItemEvent,
    },
    guards: {
        canRetry: ({ context }) => context.retryCount < context.maxRetries,
        retriesExhausted: ({ context }) => context.retryCount >= context.maxRetries,
    },
    actions: {
        incrementRetry: assign(({ context }) => ({
            retryCount: context.retryCount + 1,
            lastAttempt: Date.now(),
        })),

        recordError: assign(({ context, event }) => {
            if (event.type !== 'SYNC_ERROR') return {};
            return { lastError: event.error };
        }),

        clearError: assign({
            lastError: null,
        }),

        resetRetries: assign({
            retryCount: 0,
            lastError: null,
            lastAttempt: null,
        }),
    },
    delays: {
        retryDelay: ({ context }) => getBackoffDelay(context.retryCount),
    },
}).createMachine({
    id: 'syncItem',
    initial: 'pending',
    context: {
        itemId: '',
        itemType: 'workout' as const,
        data: null,
        createdAt: Date.now(),
        retryCount: 0,
        maxRetries: 5,
        lastError: null,
        lastAttempt: null,
    },
    states: {
        pending: {
            on: {
                START_SYNC: 'syncing',
                CANCEL: 'cancelled',
            },
        },

        syncing: {
            on: {
                SYNC_SUCCESS: 'synced',
                SYNC_ERROR: [
                    {
                        guard: 'canRetry',
                        target: 'retrying',
                        actions: ['recordError', 'incrementRetry'],
                    },
                    {
                        guard: 'retriesExhausted',
                        target: 'failed',
                        actions: 'recordError',
                    },
                ],
                CANCEL: 'cancelled',
            },
        },

        retrying: {
            after: {
                retryDelay: 'syncing',
            },
            on: {
                CANCEL: 'cancelled',
                RESET: {
                    target: 'pending',
                    actions: 'resetRetries',
                },
            },
        },

        synced: {
            type: 'final',
        },

        failed: {
            on: {
                RESET: {
                    target: 'pending',
                    actions: 'resetRetries',
                },
            },
        },

        cancelled: {
            type: 'final',
        },
    },
});

// ============================================
// SYNC QUEUE ORCHESTRATOR MACHINE
// ============================================

export interface SyncQueueContext {
    pendingIds: string[];
    syncingIds: string[];
    failedIds: string[];
    syncedIds: string[];
    isOnline: boolean;
    isSyncing: boolean;
    lastSyncAt: number | null;
}

export type SyncQueueEvent =
    | { type: 'ADD_ITEM'; itemId: string }
    | { type: 'REMOVE_ITEM'; itemId: string }
    | { type: 'START_SYNC_ALL' }
    | { type: 'STOP_SYNC' }
    | { type: 'ITEM_SYNCED'; itemId: string }
    | { type: 'ITEM_FAILED'; itemId: string }
    | { type: 'NETWORK_ONLINE' }
    | { type: 'NETWORK_OFFLINE' }
    | { type: 'CLEAR_FAILED' }
    | { type: 'RESET_ALL' };

export const syncQueueMachine = setup({
    types: {
        context: {} as SyncQueueContext,
        events: {} as SyncQueueEvent,
    },
    guards: {
        hasItems: ({ context }) => context.pendingIds.length > 0,
        isOnline: ({ context }) => context.isOnline,
        hasFailedItems: ({ context }) => context.failedIds.length > 0,
        allItemsProcessed: ({ context }) =>
            context.syncingIds.length === 0 && context.pendingIds.length === 0,
    },
    actions: {
        markOnline: assign({ isOnline: true }),
        markOffline: assign({ isOnline: false }),
        markSyncing: assign({ isSyncing: true }),
        markIdle: assign({ isSyncing: false }),
        updateLastSync: assign({ lastSyncAt: Date.now() }),

        addItem: assign(({ context, event }) => {
            if (event.type !== 'ADD_ITEM') return {};
            if (context.pendingIds.includes(event.itemId)) return {};
            return { pendingIds: [...context.pendingIds, event.itemId] };
        }),

        removeItem: assign(({ context, event }) => {
            if (event.type !== 'REMOVE_ITEM') return {};
            return {
                pendingIds: context.pendingIds.filter(id => id !== event.itemId),
                syncingIds: context.syncingIds.filter(id => id !== event.itemId),
                failedIds: context.failedIds.filter(id => id !== event.itemId),
            };
        }),

        markItemSynced: assign(({ context, event }) => {
            if (event.type !== 'ITEM_SYNCED') return {};
            return {
                syncingIds: context.syncingIds.filter(id => id !== event.itemId),
                syncedIds: [...context.syncedIds, event.itemId],
            };
        }),

        markItemFailed: assign(({ context, event }) => {
            if (event.type !== 'ITEM_FAILED') return {};
            return {
                syncingIds: context.syncingIds.filter(id => id !== event.itemId),
                failedIds: [...context.failedIds, event.itemId],
            };
        }),

        clearFailed: assign(({ context }) => ({
            failedIds: [],
        })),

        resetAll: assign({
            pendingIds: [],
            syncingIds: [],
            failedIds: [],
            syncedIds: [],
            isSyncing: false,
        }),
    },
}).createMachine({
    id: 'syncQueue',
    initial: 'idle',
    context: {
        pendingIds: [],
        syncingIds: [],
        failedIds: [],
        syncedIds: [],
        isOnline: true,
        isSyncing: false,
        lastSyncAt: null,
    },
    states: {
        idle: {
            on: {
                ADD_ITEM: {
                    actions: 'addItem',
                },
                REMOVE_ITEM: {
                    actions: 'removeItem',
                },
                START_SYNC_ALL: {
                    guard: 'hasItems',
                    target: 'syncing',
                    actions: 'markSyncing',
                },
                NETWORK_ONLINE: {
                    actions: 'markOnline',
                },
                NETWORK_OFFLINE: {
                    actions: 'markOffline',
                },
                CLEAR_FAILED: {
                    actions: 'clearFailed',
                },
                RESET_ALL: {
                    actions: 'resetAll',
                },
            },
        },

        syncing: {
            on: {
                ITEM_SYNCED: {
                    actions: ['markItemSynced', 'updateLastSync'],
                },
                ITEM_FAILED: {
                    actions: 'markItemFailed',
                },
                STOP_SYNC: {
                    target: 'idle',
                    actions: 'markIdle',
                },
                NETWORK_OFFLINE: {
                    target: 'idle',
                    actions: ['markOffline', 'markIdle'],
                },
                ADD_ITEM: {
                    actions: 'addItem',
                },
            },
            always: {
                guard: 'allItemsProcessed',
                target: 'idle',
                actions: 'markIdle',
            },
        },
    },
});

// ============================================
// TYPE EXPORTS
// ============================================

export type SyncItemMachine = typeof syncItemMachine;
export type SyncQueueMachine = typeof syncQueueMachine;

export type SyncItemStatus =
    | 'pending'
    | 'syncing'
    | 'retrying'
    | 'synced'
    | 'failed'
    | 'cancelled';

export function getSyncItemStatus(state: { matches: (value: any) => boolean }): SyncItemStatus {
    if (state.matches('pending')) return 'pending';
    if (state.matches('syncing')) return 'syncing';
    if (state.matches('retrying')) return 'retrying';
    if (state.matches('synced')) return 'synced';
    if (state.matches('failed')) return 'failed';
    if (state.matches('cancelled')) return 'cancelled';
    return 'pending';
}
