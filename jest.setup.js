/**
 * Jest Setup File
 *
 * Configures mocks for React Native Testing Library.
 * These mocks prevent errors from native modules during testing.
 */

// ============================================
// Async Storage Mock
// ============================================

const mockStorage = new Map();

jest.mock('@react-native-async-storage/async-storage', () => ({
    setItem: jest.fn((key, value) => {
        mockStorage.set(key, value);
        return Promise.resolve();
    }),
    getItem: jest.fn((key) => {
        return Promise.resolve(mockStorage.get(key) || null);
    }),
    removeItem: jest.fn((key) => {
        mockStorage.delete(key);
        return Promise.resolve();
    }),
    getAllKeys: jest.fn(() => {
        return Promise.resolve(Array.from(mockStorage.keys()));
    }),
    multiGet: jest.fn((keys) => {
        return Promise.resolve(keys.map((key) => [key, mockStorage.get(key) || null]));
    }),
    multiSet: jest.fn((pairs) => {
        pairs.forEach(([key, value]) => mockStorage.set(key, value));
        return Promise.resolve();
    }),
    clear: jest.fn(() => {
        mockStorage.clear();
        return Promise.resolve();
    }),
}));

// Helper to reset storage between tests
global.resetMockStorage = () => mockStorage.clear();

// ============================================
// Supabase Mock
// ============================================

const mockSupabaseData = {
    user: null,
    session: null,
};

jest.mock('@/lib/supabase/client', () => ({
    supabase: {
        auth: {
            getSession: jest.fn(() => Promise.resolve({ data: { session: mockSupabaseData.session }, error: null })),
            onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
            signInWithPassword: jest.fn(),
            signOut: jest.fn(),
        },
        from: jest.fn((table) => ({
            select: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(() => Promise.resolve({ data: null, error: null })),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
        })),
        rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
    },
}));

// Helper to set mock user/session for tests
global.setMockSupabaseSession = (session) => {
    mockSupabaseData.session = session;
};

// ============================================
// Expo Modules Mocks
// ============================================

jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    notificationAsync: jest.fn(),
    selectionAsync: jest.fn(),
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
    NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('expo-av', () => ({
    Audio: {
        Sound: {
            createAsync: jest.fn(() =>
                Promise.resolve({
                    sound: { playAsync: jest.fn(), unloadAsync: jest.fn() },
                    status: {},
                })
            ),
        },
        setAudioModeAsync: jest.fn(),
    },
}));

jest.mock('expo-linking', () => ({
    createURL: jest.fn((path) => `workoutapp://${path}`),
    parse: jest.fn(),
}));

// ============================================
// Cleanup Between Tests
// ============================================

beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.clear();
    mockSupabaseData.user = null;
    mockSupabaseData.session = null;
});
