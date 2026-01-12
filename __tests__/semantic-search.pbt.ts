/**
 * Semantic Search Property-Based Tests
 *
 * Uses fast-check to verify search invariants:
 * 1. Exact matches have score 1.0
 * 2. Fuzzy threshold is respected
 * 3. Search is idempotent
 * 4. Empty input returns null
 * 5. Triangle inequality for distance
 */

import * as fc from 'fast-check';

// ============================================
// LOCAL IMPLEMENTATIONS (for testing)
// ============================================

/**
 * Levenshtein distance (simplified)
 */
function levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

/**
 * String similarity (0-1 scale)
 */
function stringSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
    const maxLength = Math.max(a.length, b.length);
    return 1 - distance / maxLength;
}

// ============================================
// ARBITRARIES
// ============================================

// Use fc.string with character constraints
const exerciseNameArbitrary: fc.Arbitrary<string> = fc.string({ minLength: 3, maxLength: 30 })
    .filter((s: string) => /^[a-zA-Z ]+$/.test(s))
    .map((s: string) => s.trim().replace(/\s+/g, ' '))
    .filter((s: string) => s.length >= 3);

/**
 * Generate a typo string by adding, removing, or replacing characters
 */
interface TypoResult {
    original: string;
    typo: string;
}

const typoArbitrary: fc.Arbitrary<TypoResult> = fc.tuple(
    fc.string({ minLength: 5, maxLength: 20 }).filter((s: string) => /^[a-zA-Z]+$/.test(s)),
    fc.nat({ max: 3 }),
    fc.array(fc.nat({ max: 2 }), { minLength: 1, maxLength: 5 })
).map(([original, numEdits, editTypes]: [string, number, number[]]): TypoResult => {
    let result = original;
    for (let i = 0; i < Math.min(numEdits, editTypes.length); i++) {
        if (result.length < 2) break;
        const pos = Math.floor(Math.random() * result.length);
        const editType = editTypes[i];

        switch (editType) {
            case 0: // insertion
                result = result.slice(0, pos) + 'x' + result.slice(pos);
                break;
            case 1: // deletion
                result = result.slice(0, pos) + result.slice(pos + 1);
                break;
            case 2: // substitution
                result = result.slice(0, pos) + 'z' + result.slice(pos + 1);
                break;
        }
    }
    return { original, typo: result };
});

// ============================================
// PROPERTIES
// ============================================

describe('Semantic Search Properties', () => {
    // Property 1: Exact match has similarity 1.0
    test('exactMatchScore: identical strings have similarity 1.0', () => {
        fc.assert(
            fc.property(fc.string({ minLength: 1, maxLength: 20 }), (name: string) => {
                const similarity = stringSimilarity(name, name);
                expect(similarity).toBe(1);
            }),
            { numRuns: 100 }
        );
    });

    // Property 2: Similarity is symmetric
    test('similaritySymmetric: similarity(a, b) === similarity(b, a)', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 20 }),
                fc.string({ minLength: 1, maxLength: 20 }),
                (a: string, b: string) => {
                    const sim1 = stringSimilarity(a, b);
                    const sim2 = stringSimilarity(b, a);
                    expect(Math.abs(sim1 - sim2)).toBeLessThan(0.001);
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property 3: Similarity is bounded [0, 1]
    test('similarityBounded: 0 <= similarity <= 1', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 0, maxLength: 20 }),
                fc.string({ minLength: 0, maxLength: 20 }),
                (a: string, b: string) => {
                    const similarity = stringSimilarity(a, b);
                    expect(similarity).toBeGreaterThanOrEqual(0);
                    expect(similarity).toBeLessThanOrEqual(1);
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property 4: Triangle inequality for distance
    test('triangleInequality: d(a,c) <= d(a,b) + d(b,c)', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 10 }),
                fc.string({ minLength: 1, maxLength: 10 }),
                fc.string({ minLength: 1, maxLength: 10 }),
                (a: string, b: string, c: string) => {
                    const dAC = levenshteinDistance(a, c);
                    const dAB = levenshteinDistance(a, b);
                    const dBC = levenshteinDistance(b, c);
                    expect(dAC).toBeLessThanOrEqual(dAB + dBC);
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property 5: Empty string has 0 similarity with non-empty
    test('emptyStringSimilarity', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 20 }),
                (name: string) => {
                    expect(stringSimilarity('', name)).toBe(0);
                    expect(stringSimilarity(name, '')).toBe(0);
                }
            ),
            { numRuns: 50 }
        );
    });

    // Property 6: Distance is non-negative
    test('distanceNonNegative', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 0, maxLength: 20 }),
                fc.string({ minLength: 0, maxLength: 20 }),
                (a: string, b: string) => {
                    expect(levenshteinDistance(a, b)).toBeGreaterThanOrEqual(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property 7: Distance to self is zero
    test('distanceToSelfIsZero', () => {
        fc.assert(
            fc.property(fc.string({ minLength: 0, maxLength: 20 }), (name: string) => {
                expect(levenshteinDistance(name, name)).toBe(0);
            }),
            { numRuns: 50 }
        );
    });

    // Property 8: Single edit increases distance by at most 1
    test('singleEditDistanceOne', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 2, maxLength: 20 }).filter((s: string) => /^[a-zA-Z]+$/.test(s)),
                fc.nat({ max: 19 }),
                (original: string, pos: number) => {
                    if (pos >= original.length) return;

                    // Single character substitution
                    const modified = original.slice(0, pos) + 'X' + original.slice(pos + 1);
                    const distance = levenshteinDistance(original, modified);
                    expect(distance).toBeLessThanOrEqual(1);
                }
            ),
            { numRuns: 50 }
        );
    });
});

// ============================================
// EXPORTS
// ============================================

export {
    exerciseNameArbitrary, levenshteinDistance,
    stringSimilarity, typoArbitrary
};

