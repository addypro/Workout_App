/**
 * ExerciseDB Services Index
 * 
 * Re-exports all ExerciseDB-related services for convenient importing.
 */

// API-based services (for real-time fetching)
export {
    getBodyParts,
    getEquipmentList,
    getExerciseById,
    getExercisesByBodyPart,
    getExercisesByEquipment,
    searchExercises,
    type ExerciseDBExercise
} from './exercisedb-client';

// Media service with runtime caching
export {
    clearMediaCache,
    clearOldCache,
    getCacheStats,
    getExerciseMedia,
    hasMediaCached,
    preloadExerciseMedia,
    type ExerciseMedia
} from './media-service';

// Static/offline service (no API calls - uses bundled data)
export {
    getExerciseById as getExerciseByIdStatic, getExerciseMedia as getExerciseMediaStatic, getCacheStats as getStaticCacheStats, isCacheAvailable, preloadCache, searchExerciseDb, type CachedExercise
} from './static-exercisedb';

