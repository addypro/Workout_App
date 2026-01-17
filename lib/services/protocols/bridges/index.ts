/**
 * Protocol Engine Bridges
 *
 * Integration layer between the protocol engine and existing app services.
 * Each bridge provides fallback to legacy behavior when the protocol engine
 * is disabled or unavailable.
 *
 * @module protocols/bridges
 */

// Progress Controller Bridge
export {
    generatePlanDeltasWithProtocol,
    hasProtocolForProgram,
    getProtocolInfo,
    type BridgeContext,
    type BridgeResult,
    type SessionHistoryEntry,
} from './progress-controller-bridge';

// Paths Engine Bridge
export {
    enrichPathNodeWithProtocol,
    getProtocolDisplayInfo,
    calculateTargetWeight,
    getRepScheme,
    type PathNodeProtocolMetadata,
    type EnrichedPathNode,
    type ProtocolDisplayInfo,
} from './paths-engine-bridge';
