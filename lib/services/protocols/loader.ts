/**
 * Protocol Loader
 *
 * Loads and parses protocol definitions from YAML/JSON.
 * Handles bundled protocols and validates structure.
 *
 * @module protocols/loader
 */

import type {
    Protocol,
    ProgressionRule,
    Condition,
    Effect,
    Source,
    EvidenceGrade,
    Increment,
} from './types';

/**
 * Raw protocol structure from YAML/JSON (before normalization)
 */
interface RawProtocol {
    protocol: {
        id: string;
        name: string;
        version: string;
        category: string;
        description: string;
        authors?: string[];
        defaults: {
            increment: {
                type: string;
                upperBody: number;
                lowerBody: number;
                roundTo?: number;
            };
            deloadTrigger: number;
            deloadFactor: number;
            targetRpe?: number;
            targetRir?: number;
        };
        stages?: Array<{
            id: string;
            t1: { sets: number; reps: number; amrap?: boolean };
            t2: { sets: number; reps: number };
            t3: { sets: number; reps: number; amrap?: boolean };
        }>;
        progressions?: Record<string, string[]>;
        rules: Array<{
            id: string;
            name: string;
            description?: string;
            priority: number;
            enabled?: boolean;
            trigger: {
                event: string;
                conditions: Array<{
                    type: string;
                    params: Record<string, unknown>;
                }>;
            };
            effect: {
                type: string;
                params: Record<string, unknown>;
            } | Array<{
                type: string;
                params: Record<string, unknown>;
            }>;
            evidence: {
                grade: string;
                sources: string[];
                notes?: string;
            };
        }>;
        evidence: {
            grade: string;
            sources: Array<{
                id: string;
                type: string;
                citation: string;
                doi?: string;
                year: number;
                sampleSize?: number;
                effectSize?: number;
                relevance: number;
            }>;
            reasoning?: string;
        };
    };
}

/**
 * Parse a raw protocol object into a typed Protocol
 */
export function parseProtocol(raw: RawProtocol): Protocol {
    const p = raw.protocol;

    return {
        id: p.id,
        name: p.name,
        version: p.version,
        description: p.description,
        category: p.category as Protocol['category'],
        authors: p.authors,

        defaults: {
            increment: {
                type: p.defaults.increment.type as Increment['type'],
                upperBody: p.defaults.increment.upperBody,
                lowerBody: p.defaults.increment.lowerBody,
                roundTo: p.defaults.increment.roundTo,
            },
            deloadTrigger: p.defaults.deloadTrigger,
            deloadFactor: p.defaults.deloadFactor,
            targetRpe: p.defaults.targetRpe,
            targetRir: p.defaults.targetRir,
        },

        stages: p.stages?.map((s) => ({
            id: s.id,
            t1: { sets: s.t1.sets, reps: s.t1.amrap ? 'AMRAP' as const : s.t1.reps },
            t2: { sets: s.t2.sets, reps: s.t2.reps },
            t3: { sets: s.t3.sets, reps: s.t3.amrap ? 'AMRAP' as const : s.t3.reps },
        })),

        progressions: p.progressions
            ? Object.entries(p.progressions).map(([movement, variations]) => ({
                  movement,
                  variations,
              }))
            : undefined,

        rules: p.rules.map((r) => parseRule(r)),

        evidence: {
            grade: p.evidence.grade as EvidenceGrade,
            confidence: gradeToConfidence(p.evidence.grade),
            sources: p.evidence.sources.map((s) => ({
                id: s.id,
                type: s.type as Source['type'],
                citation: s.citation,
                doi: s.doi,
                year: s.year,
                sampleSize: s.sampleSize,
                effectSize: s.effectSize,
                relevance: s.relevance,
            })),
            reasoning: p.evidence.reasoning,
            lastUpdated: new Date(),
        },

        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'VALIDATED',
    };
}

/**
 * Parse a raw rule object into a typed ProgressionRule
 */
function parseRule(raw: RawProtocol['protocol']['rules'][0]): ProgressionRule {
    return {
        id: raw.id,
        name: raw.name,
        description: raw.description ?? '',
        priority: raw.priority,
        enabled: raw.enabled ?? true,

        trigger: {
            event: raw.trigger.event as ProgressionRule['trigger']['event'],
            conditions: raw.trigger.conditions.map((c) => ({
                type: c.type,
                params: c.params,
            })) as Condition[],
        },

        effect: Array.isArray(raw.effect)
            ? raw.effect.map((e) => ({ type: e.type, params: e.params })) as Effect[]
            : ({ type: raw.effect.type, params: raw.effect.params }) as Effect,

        evidence: {
            grade: raw.evidence.grade as EvidenceGrade,
            sources: raw.evidence.sources,
            notes: raw.evidence.notes,
        },
    };
}

/**
 * Convert evidence grade to confidence score
 */
function gradeToConfidence(grade: string): number {
    switch (grade) {
        case 'A':
            return 0.95;
        case 'B':
            return 0.80;
        case 'C':
            return 0.65;
        case 'D':
            return 0.50;
        default:
            return 0.50;
    }
}

/**
 * Validate a protocol has required fields
 */
export function validateProtocol(protocol: Protocol): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!protocol.id) errors.push('Missing protocol ID');
    if (!protocol.name) errors.push('Missing protocol name');
    if (!protocol.version) errors.push('Missing protocol version');
    if (!protocol.category) errors.push('Missing protocol category');
    if (!protocol.defaults) errors.push('Missing defaults configuration');
    if (!protocol.rules || protocol.rules.length === 0) {
        errors.push('Protocol must have at least one rule');
    }

    // Validate each rule
    protocol.rules?.forEach((rule, i) => {
        if (!rule.id) errors.push(`Rule ${i}: Missing ID`);
        if (!rule.trigger?.conditions) errors.push(`Rule ${rule.id}: Missing conditions`);
        if (!rule.effect) errors.push(`Rule ${rule.id}: Missing effect`);
    });

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Load protocol from JSON object (for bundled protocols)
 */
export function loadProtocolFromJSON(json: Record<string, unknown>): Protocol {
    const protocol = parseProtocol(json as unknown as RawProtocol);
    const { valid, errors } = validateProtocol(protocol);

    if (!valid) {
        throw new Error(`Invalid protocol: ${errors.join(', ')}`);
    }

    return protocol;
}
