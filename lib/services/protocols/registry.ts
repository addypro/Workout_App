/**
 * Protocol Registry
 *
 * Stores and retrieves protocols.
 * Handles bundled protocols and user overrides.
 *
 * @module protocols/registry
 */

import type { Protocol, ProtocolEntry, ProtocolCategory } from './types';
import { loadProtocolFromJSON, validateProtocol } from './loader';

// Import bundled protocols
import stronglifts5x5 from './programs/linear/stronglifts-5x5.json';
// Additional protocols will be added as they're created

/**
 * Protocol Registry
 *
 * Singleton that manages all available protocols.
 */
class ProtocolRegistry {
    private protocols: Map<string, ProtocolEntry> = new Map();
    private programToProtocol: Map<string, string> = new Map();
    private initialized = false;

    /**
     * Initialize the registry with bundled protocols
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Load bundled protocols
        const bundledProtocols = [
            { data: stronglifts5x5, source: 'BUNDLED' as const },
            // Add more bundled protocols here as they're created
        ];

        for (const { data, source } of bundledProtocols) {
            try {
                const protocol = loadProtocolFromJSON(data as Record<string, unknown>);
                this.register(protocol, source);
            } catch (error) {
                console.error(`[ProtocolRegistry] Failed to load bundled protocol:`, error);
            }
        }

        this.initialized = true;
        console.log(`[ProtocolRegistry] Initialized with ${this.protocols.size} protocols`);
    }

    /**
     * Register a protocol
     */
    register(protocol: Protocol, source: ProtocolEntry['source'] = 'USER'): void {
        const entry: ProtocolEntry = {
            protocol,
            loadedAt: new Date(),
            source,
        };

        this.protocols.set(protocol.id, entry);
        console.log(`[ProtocolRegistry] Registered protocol: ${protocol.name} (${protocol.id})`);
    }

    /**
     * Get a protocol by ID
     */
    get(protocolId: string): Protocol | undefined {
        return this.protocols.get(protocolId)?.protocol;
    }

    /**
     * Get all protocols
     */
    getAll(): Protocol[] {
        return Array.from(this.protocols.values()).map((e) => e.protocol);
    }

    /**
     * Get protocols by category
     */
    getByCategory(category: ProtocolCategory): Protocol[] {
        return this.getAll().filter((p) => p.category === category);
    }

    /**
     * Check if a protocol exists
     */
    has(protocolId: string): boolean {
        return this.protocols.has(protocolId);
    }

    /**
     * Link a program to a protocol
     */
    linkProgramToProtocol(programId: string, protocolId: string): void {
        if (!this.has(protocolId)) {
            console.warn(`[ProtocolRegistry] Protocol ${protocolId} not found`);
            return;
        }
        this.programToProtocol.set(programId, protocolId);
    }

    /**
     * Get protocol for a program
     */
    getForProgram(programId: string): Protocol | undefined {
        const protocolId = this.programToProtocol.get(programId);
        if (!protocolId) return undefined;
        return this.get(protocolId);
    }

    /**
     * Get protocol suggestions for a program based on name matching
     */
    suggestProtocolForProgram(programName: string): Protocol | undefined {
        const normalizedName = programName.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Try to match by name
        for (const protocol of this.getAll()) {
            const normalizedProtocol = protocol.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (
                normalizedName.includes(normalizedProtocol) ||
                normalizedProtocol.includes(normalizedName)
            ) {
                return protocol;
            }
        }

        return undefined;
    }

    /**
     * Unregister a protocol
     */
    unregister(protocolId: string): boolean {
        const entry = this.protocols.get(protocolId);
        if (entry?.source === 'BUNDLED') {
            console.warn(`[ProtocolRegistry] Cannot unregister bundled protocol: ${protocolId}`);
            return false;
        }
        return this.protocols.delete(protocolId);
    }

    /**
     * Get registry stats
     */
    getStats(): {
        total: number;
        bySource: Record<string, number>;
        byCategory: Record<string, number>;
    } {
        const entries = Array.from(this.protocols.values());

        const bySource: Record<string, number> = {};
        const byCategory: Record<string, number> = {};

        for (const entry of entries) {
            bySource[entry.source] = (bySource[entry.source] || 0) + 1;
            byCategory[entry.protocol.category] = (byCategory[entry.protocol.category] || 0) + 1;
        }

        return {
            total: entries.length,
            bySource,
            byCategory,
        };
    }
}

// Export singleton instance
export const protocolRegistry = new ProtocolRegistry();

// Export for testing
export { ProtocolRegistry };
