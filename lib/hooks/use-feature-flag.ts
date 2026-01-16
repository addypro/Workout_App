/**
 * useFeatureFlag Hook
 *
 * React hook for checking feature flag status.
 */

import {
    isFeatureEnabled,
    syncFlags,
    type FeatureFlagName,
} from '@/lib/config/feature-flags';
import { useEffect, useState } from 'react';

/**
 * Check if a feature is enabled for the current user
 */
export function useFeatureFlag(flagName: FeatureFlagName): boolean {
    const [enabled, setEnabled] = useState(() => isFeatureEnabled(flagName));

    useEffect(() => {
        // Re-check after any sync
        const checkFlag = () => {
            setEnabled(isFeatureEnabled(flagName));
        };

        // Check immediately
        checkFlag();

        // Re-sync on mount and check again
        syncFlags().then(checkFlag).catch(() => { });
    }, [flagName]);

    return enabled;
}

/**
 * Get feature flag with loading state
 */
export function useFeatureFlagWithLoading(flagName: FeatureFlagName): {
    enabled: boolean;
    loading: boolean;
} {
    const [enabled, setEnabled] = useState(() => isFeatureEnabled(flagName));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        syncFlags()
            .then(() => {
                setEnabled(isFeatureEnabled(flagName));
            })
            .catch(() => { })
            .finally(() => {
                setLoading(false);
            });
    }, [flagName]);

    return { enabled, loading };
}
