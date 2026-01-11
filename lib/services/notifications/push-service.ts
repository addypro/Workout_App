/**
 * Push Notification Service
 *
 * Handles push notification registration, permissions, and token management.
 * Uses expo-notifications for cross-platform push support.
 */

import { supabase } from '@/lib/supabase/client';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { RegisterTokenInput } from './types';

// ============================================
// CONFIGURATION
// ============================================

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// ============================================
// PERMISSION & REGISTRATION
// ============================================

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
        console.log('[Push] Must use physical device for push notifications');
        return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.log('[Push] Permission not granted');
        return false;
    }

    return true;
}

/**
 * Get the Expo push token for this device
 */
export async function getExpoPushToken(): Promise<string | null> {
    try {
        const hasPermission = await requestNotificationPermissions();
        if (!hasPermission) return null;

        // For Android, we need to set up the notification channel
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'Default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        const token = await Notifications.getExpoPushTokenAsync({
            projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
        });

        return token.data;
    } catch (error) {
        console.error('[Push] Error getting push token:', error);
        return null;
    }
}

// ============================================
// TOKEN STORAGE
// ============================================

/**
 * Register push token in Supabase
 */
export async function registerPushToken(input: RegisterTokenInput): Promise<boolean> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.log('[Push] No authenticated user');
            return false;
        }

        // Upsert to handle re-registration
        const { error } = await supabase
            .from('user_push_tokens')
            .upsert({
                user_id: user.id,
                push_token: input.pushToken,
                platform: input.platform,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id,push_token',
            });

        if (error) {
            console.error('[Push] Error registering token:', error);
            return false;
        }

        console.log('[Push] Token registered successfully');
        return true;
    } catch (error) {
        console.error('[Push] Error registering token:', error);
        return false;
    }
}

/**
 * Unregister push token (on logout)
 */
export async function unregisterPushToken(pushToken: string): Promise<void> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase
            .from('user_push_tokens')
            .delete()
            .eq('user_id', user.id)
            .eq('push_token', pushToken);

        console.log('[Push] Token unregistered');
    } catch (error) {
        console.error('[Push] Error unregistering token:', error);
    }
}

// ============================================
// FULL REGISTRATION FLOW
// ============================================

/**
 * Complete push notification setup
 * Call this after successful authentication
 */
export async function setupPushNotifications(): Promise<string | null> {
    const token = await getExpoPushToken();
    if (!token) return null;

    const registered = await registerPushToken({
        pushToken: token,
        platform: Platform.OS as 'ios' | 'android',
    });

    return registered ? token : null;
}

// ============================================
// NOTIFICATION LISTENERS
// ============================================

/**
 * Add listener for notifications received while app is foregrounded
 */
export function addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
): Notifications.EventSubscription {
    return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add listener for notifications that were tapped
 */
export function addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
): Notifications.EventSubscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
}

// ============================================
// EXPORTS
// ============================================

export * from './types';
