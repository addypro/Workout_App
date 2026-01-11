/**
 * Local Embeddings Service
 *
 * On-device vector embeddings for semantic exercise search.
 * Uses character n-grams + word tokens for fast, offline matching.
 *
 * Architecture: Edge-First (no cloud dependency)
 * - Pre-computes embeddings at app startup
 * - Stores in AsyncStorage for persistence
 * - Uses cosine similarity for matching
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_GLOBAL_RANKINGS, type GlobalExerciseRanking } from '@/lib/services/popularity/global-rankings';
import { VOICE_INTENTS } from './intent-mapping';

// Storage keys
const EMBEDDINGS_CACHE_KEY = '@voice_embeddings_cache';
const EMBEDDINGS_VERSION = '1.0.0';

// Embedding configuration
const NGRAM_SIZE = 3; // Character trigrams
const MIN_WORD_LENGTH = 2;

// Types
export interface ExerciseEmbedding {
  id: string;
  name: string;
  vector: number[];
  aliases: string[];
  category?: string;
  popularity: number;
}

export interface EmbeddingsCache {
  version: string;
  timestamp: number;
  embeddings: ExerciseEmbedding[];
  vocabulary: string[];
}

export interface SimilarityResult {
  exercise: ExerciseEmbedding;
  similarity: number;
  matchedOn: 'name' | 'alias';
}

// In-memory cache
let embeddingsCache: EmbeddingsCache | null = null;
let vocabularyIndex: Map<string, number> = new Map();

/**
 * Generate character n-grams from text
 */
function generateNgrams(text: string, n: number = NGRAM_SIZE): string[] {
  const normalized = text.toLowerCase().trim();
  const ngrams: string[] = [];

  // Add padding for start/end
  const padded = `  ${normalized}  `;

  for (let i = 0; i <= padded.length - n; i++) {
    ngrams.push(padded.slice(i, i + n));
  }

  return ngrams;
}

/**
 * Extract word tokens from text
 */
function extractWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\-_]+/)
    .filter(w => w.length >= MIN_WORD_LENGTH);
}

/**
 * Build vocabulary from all exercise names and aliases
 */
function buildVocabulary(exercises: GlobalExerciseRanking[]): string[] {
  const vocabSet = new Set<string>();

  for (const exercise of exercises) {
    // Add n-grams from name
    for (const ngram of generateNgrams(exercise.name)) {
      vocabSet.add(ngram);
    }

    // Add words from name
    for (const word of extractWords(exercise.name)) {
      vocabSet.add(`word:${word}`);
    }

    // Add n-grams from aliases
    for (const alias of exercise.aliases) {
      for (const ngram of generateNgrams(alias)) {
        vocabSet.add(ngram);
      }
      for (const word of extractWords(alias)) {
        vocabSet.add(`word:${word}`);
      }
    }
  }

  // Add intent commands
  for (const intent of VOICE_INTENTS) {
    for (const ngram of generateNgrams(intent.voiceCommand)) {
      vocabSet.add(ngram);
    }
    for (const word of extractWords(intent.voiceCommand)) {
      vocabSet.add(`word:${word}`);
    }
    for (const alias of intent.aliases) {
      for (const ngram of generateNgrams(alias)) {
        vocabSet.add(ngram);
      }
    }
  }

  return Array.from(vocabSet).sort();
}

/**
 * Create a sparse vector for text
 */
function createVector(text: string, vocabulary: string[], vocabIndex: Map<string, number>): number[] {
  const vector = new Array(vocabulary.length).fill(0);

  // Count n-grams
  const ngrams = generateNgrams(text);
  for (const ngram of ngrams) {
    const idx = vocabIndex.get(ngram);
    if (idx !== undefined) {
      vector[idx] += 1;
    }
  }

  // Count words (weighted higher)
  const words = extractWords(text);
  for (const word of words) {
    const idx = vocabIndex.get(`word:${word}`);
    if (idx !== undefined) {
      vector[idx] += 3; // Words weighted 3x
    }
  }

  // Normalize to unit vector
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= magnitude;
    }
  }

  return vector;
}

/**
 * Create a sparse vector representation (more memory efficient)
 */
function createSparseVector(text: string, vocabIndex: Map<string, number>): number[] {
  const counts = new Map<number, number>();

  // Count n-grams
  const ngrams = generateNgrams(text);
  for (const ngram of ngrams) {
    const idx = vocabIndex.get(ngram);
    if (idx !== undefined) {
      counts.set(idx, (counts.get(idx) || 0) + 1);
    }
  }

  // Count words (weighted higher)
  const words = extractWords(text);
  for (const word of words) {
    const idx = vocabIndex.get(`word:${word}`);
    if (idx !== undefined) {
      counts.set(idx, (counts.get(idx) || 0) + 3);
    }
  }

  // Convert to dense vector for storage
  const maxIdx = Math.max(...Array.from(vocabIndex.values())) + 1;
  const vector = new Array(maxIdx).fill(0);

  for (const [idx, count] of counts) {
    vector[idx] = count;
  }

  // Normalize
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= magnitude;
    }
  }

  return vector;
}

/**
 * Compute cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
  }

  // Vectors are already normalized, so no need to divide by magnitudes
  return dotProduct;
}

/**
 * Build embeddings for all exercises
 */
function buildEmbeddings(): EmbeddingsCache {
  const exercises = ALL_GLOBAL_RANKINGS;
  const vocabulary = buildVocabulary(exercises);

  // Build vocabulary index
  vocabularyIndex = new Map();
  for (let i = 0; i < vocabulary.length; i++) {
    vocabularyIndex.set(vocabulary[i], i);
  }

  const embeddings: ExerciseEmbedding[] = [];

  for (const exercise of exercises) {
    // Create combined text for embedding
    const combinedText = [exercise.name, ...exercise.aliases].join(' ');

    embeddings.push({
      id: exercise.name.toLowerCase().replace(/\s+/g, '-'),
      name: exercise.name,
      vector: createSparseVector(combinedText, vocabularyIndex),
      aliases: exercise.aliases,
      category: exercise.category,
      popularity: exercise.score,
    });
  }

  return {
    version: EMBEDDINGS_VERSION,
    timestamp: Date.now(),
    embeddings,
    vocabulary,
  };
}

/**
 * Initialize embeddings (call at app startup)
 */
export async function initializeEmbeddings(): Promise<void> {
  try {
    // Check cache first
    const cached = await AsyncStorage.getItem(EMBEDDINGS_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as EmbeddingsCache;
      if (parsed.version === EMBEDDINGS_VERSION) {
        embeddingsCache = parsed;

        // Rebuild vocabulary index
        vocabularyIndex = new Map();
        for (let i = 0; i < parsed.vocabulary.length; i++) {
          vocabularyIndex.set(parsed.vocabulary[i], i);
        }

        console.log(`[Embeddings] Loaded ${parsed.embeddings.length} cached embeddings`);
        return;
      }
    }

    // Build fresh embeddings
    console.log('[Embeddings] Building fresh embeddings...');
    embeddingsCache = buildEmbeddings();

    // Cache for next time
    await AsyncStorage.setItem(
      EMBEDDINGS_CACHE_KEY,
      JSON.stringify(embeddingsCache)
    );

    console.log(`[Embeddings] Built ${embeddingsCache.embeddings.length} embeddings`);
  } catch (error) {
    console.warn('[Embeddings] Initialization failed, building in-memory:', error);
    embeddingsCache = buildEmbeddings();
  }
}

/**
 * Search for similar exercises using embeddings
 */
export function searchSimilar(
  query: string,
  topK: number = 5,
  minSimilarity: number = 0.3
): SimilarityResult[] {
  if (!embeddingsCache) {
    console.warn('[Embeddings] Not initialized, call initializeEmbeddings first');
    return [];
  }

  // Create query vector
  const queryVector = createSparseVector(query, vocabularyIndex);

  // Calculate similarity with all exercises
  const results: SimilarityResult[] = [];

  for (const embedding of embeddingsCache.embeddings) {
    // Check name similarity
    const nameSimilarity = cosineSimilarity(queryVector, embedding.vector);

    if (nameSimilarity >= minSimilarity) {
      results.push({
        exercise: embedding,
        similarity: nameSimilarity,
        matchedOn: 'name',
      });
    } else {
      // Check individual alias similarities
      for (const alias of embedding.aliases) {
        const aliasVector = createSparseVector(alias, vocabularyIndex);
        const aliasSimilarity = cosineSimilarity(queryVector, aliasVector);

        if (aliasSimilarity >= minSimilarity) {
          results.push({
            exercise: embedding,
            similarity: aliasSimilarity,
            matchedOn: 'alias',
          });
          break; // Only add once per exercise
        }
      }
    }
  }

  // Sort by similarity (descending) and popularity (as tiebreaker)
  results.sort((a, b) => {
    const simDiff = b.similarity - a.similarity;
    if (Math.abs(simDiff) > 0.05) return simDiff;
    return b.exercise.popularity - a.exercise.popularity;
  });

  return results.slice(0, topK);
}

/**
 * Get the best matching exercise for a query
 */
export function findBestMatch(query: string): SimilarityResult | null {
  const results = searchSimilar(query, 1, 0.4);
  return results.length > 0 ? results[0] : null;
}

/**
 * Check if embeddings are initialized
 */
export function isInitialized(): boolean {
  return embeddingsCache !== null;
}

/**
 * Get embedding stats
 */
export function getEmbeddingStats(): {
  initialized: boolean;
  exerciseCount: number;
  vocabularySize: number;
  version: string;
} {
  return {
    initialized: embeddingsCache !== null,
    exerciseCount: embeddingsCache?.embeddings.length || 0,
    vocabularySize: embeddingsCache?.vocabulary.length || 0,
    version: embeddingsCache?.version || 'not loaded',
  };
}

/**
 * Clear embeddings cache (for debugging/updates)
 */
export async function clearEmbeddingsCache(): Promise<void> {
  embeddingsCache = null;
  vocabularyIndex.clear();
  await AsyncStorage.removeItem(EMBEDDINGS_CACHE_KEY);
}

/**
 * Re-index embeddings (call after exercise database updates)
 */
export async function reindexEmbeddings(): Promise<void> {
  await clearEmbeddingsCache();
  await initializeEmbeddings();
}
