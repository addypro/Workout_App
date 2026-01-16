/**
 * Challenge Templates Index
 *
 * Re-exports all challenge templates.
 */

export { HYROX_ENGINE } from './hyrox-engine';
export { IRON_WILL_75 } from './iron-will-75';
export { RUNNERS_AWAKENING } from './runners-awakening';
export { THOUSAND_LB_CLUB } from './thousand-lb-club';

import { HYROX_ENGINE } from './hyrox-engine';
import { IRON_WILL_75 } from './iron-will-75';
import { RUNNERS_AWAKENING } from './runners-awakening';
import { THOUSAND_LB_CLUB } from './thousand-lb-club';

import type { ChallengeTemplate } from '../types';

/**
 * All available challenge templates
 */
export const ALL_CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
    IRON_WILL_75,
    THOUSAND_LB_CLUB,
    RUNNERS_AWAKENING,
    HYROX_ENGINE,
];

/**
 * Template lookup by ID (O(1))
 */
const _templateIndex = new Map<string, ChallengeTemplate>(
    ALL_CHALLENGE_TEMPLATES.map((t) => [t.id, t])
);

export function getTemplateById(id: string): ChallengeTemplate | undefined {
    return _templateIndex.get(id);
}
