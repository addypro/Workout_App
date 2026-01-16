/**
 * ExerciseDB API Client
 * 
 * Client for the ExerciseDB API (v1 open source).
 * Provides access to exercise visuals (GIFs, images) and extended metadata.
 * 
 * API Docs: https://exercisedb.dev/docs
 * GitHub: https://github.com/ExerciseDB/exercisedb-api
 */

// ============================================
// CONFIGURATION
// ============================================

const EXERCISEDB_BASE_URL = 'https://exercisedb.dev/api/v1';

// Rate limiting configuration
const MAX_REQUESTS_PER_MINUTE = 60;
const REQUEST_DELAY_MS = 1000; // 1 second between requests

// ============================================
// TYPES
// ============================================

export interface ExerciseDBExercise {
    exerciseId: string;
    name: string;
    gifUrl?: string;
    imageUrl?: string;
    equipments: string[];
    bodyParts: string[];
    targetMuscles: string[];
    secondaryMuscles?: string[];
    instructions?: string[];
}

export interface ExerciseDBResponse<T> {
    data: T;
    success: boolean;
    message?: string;
}

// ============================================
// REQUEST QUEUE (Rate Limiting)
// ============================================

let lastRequestTime = 0;
let requestQueue: Array<() => Promise<void>> = [];
let isProcessingQueue = false;

async function processQueue(): Promise<void> {
    if (isProcessingQueue || requestQueue.length === 0) return;

    isProcessingQueue = true;

    while (requestQueue.length > 0) {
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;

        if (timeSinceLastRequest < REQUEST_DELAY_MS) {
            await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS - timeSinceLastRequest));
        }

        const request = requestQueue.shift();
        if (request) {
            lastRequestTime = Date.now();
            await request();
        }
    }

    isProcessingQueue = false;
}

function enqueueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        requestQueue.push(async () => {
            try {
                const result = await requestFn();
                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
        processQueue();
    });
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Fetch a single exercise by ID
 */
export async function getExerciseById(exerciseDbId: string): Promise<ExerciseDBExercise | null> {
    return enqueueRequest(async () => {
        try {
            const response = await fetch(`${EXERCISEDB_BASE_URL}/exercises/${exerciseDbId}`);

            if (!response.ok) {
                console.warn(`[ExerciseDB] Failed to fetch exercise ${exerciseDbId}: ${response.status}`);
                return null;
            }

            const data = await response.json();
            return data as ExerciseDBExercise;
        } catch (error) {
            console.error('[ExerciseDB] Fetch error:', error);
            return null;
        }
    });
}

/**
 * Search exercises by name
 */
export async function searchExercises(query: string, limit = 10): Promise<ExerciseDBExercise[]> {
    return enqueueRequest(async () => {
        try {
            const encodedQuery = encodeURIComponent(query.toLowerCase());
            const response = await fetch(
                `${EXERCISEDB_BASE_URL}/exercises/name/${encodedQuery}?limit=${limit}`
            );

            if (!response.ok) {
                console.warn(`[ExerciseDB] Search failed: ${response.status}`);
                return [];
            }

            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error('[ExerciseDB] Search error:', error);
            return [];
        }
    });
}

/**
 * Get exercises by body part
 */
export async function getExercisesByBodyPart(bodyPart: string, limit = 50): Promise<ExerciseDBExercise[]> {
    return enqueueRequest(async () => {
        try {
            const encodedPart = encodeURIComponent(bodyPart.toLowerCase());
            const response = await fetch(
                `${EXERCISEDB_BASE_URL}/exercises/bodyPart/${encodedPart}?limit=${limit}`
            );

            if (!response.ok) {
                console.warn(`[ExerciseDB] Body part fetch failed: ${response.status}`);
                return [];
            }

            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error('[ExerciseDB] Body part error:', error);
            return [];
        }
    });
}

/**
 * Get exercises by equipment
 */
export async function getExercisesByEquipment(equipment: string, limit = 50): Promise<ExerciseDBExercise[]> {
    return enqueueRequest(async () => {
        try {
            const encodedEquip = encodeURIComponent(equipment.toLowerCase());
            const response = await fetch(
                `${EXERCISEDB_BASE_URL}/exercises/equipment/${encodedEquip}?limit=${limit}`
            );

            if (!response.ok) {
                console.warn(`[ExerciseDB] Equipment fetch failed: ${response.status}`);
                return [];
            }

            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error('[ExerciseDB] Equipment error:', error);
            return [];
        }
    });
}

/**
 * Get all available body parts
 */
export async function getBodyParts(): Promise<string[]> {
    return enqueueRequest(async () => {
        try {
            const response = await fetch(`${EXERCISEDB_BASE_URL}/exercises/bodyPartList`);

            if (!response.ok) {
                console.warn(`[ExerciseDB] Body part list failed: ${response.status}`);
                return [];
            }

            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error('[ExerciseDB] Body part list error:', error);
            return [];
        }
    });
}

/**
 * Get all available equipment
 */
export async function getEquipmentList(): Promise<string[]> {
    return enqueueRequest(async () => {
        try {
            const response = await fetch(`${EXERCISEDB_BASE_URL}/exercises/equipmentList`);

            if (!response.ok) {
                console.warn(`[ExerciseDB] Equipment list failed: ${response.status}`);
                return [];
            }

            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error('[ExerciseDB] Equipment list error:', error);
            return [];
        }
    });
}
