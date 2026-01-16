/**
 * useAppReady Hook
 * 
 * Controls when the splash screen hides to ensure the app is fully interactive.
 * Prevents the frozen-UI period where gestures don't register during initialization.
 */

import { useAuth } from '@/lib/context/auth-context';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';

// Minimum time to hold splash (covers async init that runs after isLoading = false)
const MIN_SPLASH_HOLD_MS = 800;

export function useAppReady() {
    const { isLoading } = useAuth();
    const hasHiddenSplash = useRef(false);
    const [minTimeElapsed, setMinTimeElapsed] = useState(false);

    // Start minimum hold timer on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            setMinTimeElapsed(true);
        }, MIN_SPLASH_HOLD_MS);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        // Only hide once auth is ready AND minimum time has passed AND we haven't hidden yet
        if (!isLoading && minTimeElapsed && !hasHiddenSplash.current) {
            hasHiddenSplash.current = true;

            // Wait for all pending interactions (animations, layout) to complete
            InteractionManager.runAfterInteractions(() => {
                // Extra frame delay to ensure JS thread is truly idle
                requestAnimationFrame(() => {
                    requestAnimationFrame(async () => {
                        // Use try-catch with Promise to suppress the specific Expo Go error
                        // "No native splash screen registered" is harmless - just means splash was never shown
                        // This error is common when running over Expo tunnel/web
                        try {
                            await SplashScreen.hideAsync();
                        } catch (error: any) {
                            // Silently ignore "No native splash screen" errors
                            // These are expected in Expo Go and tunnel mode
                            if (!error?.message?.includes('native splash screen')) {
                                console.warn('[SplashScreen] Error hiding:', error?.message);
                            }
                        }
                    });
                });
            });
        }
    }, [isLoading, minTimeElapsed]);
}

