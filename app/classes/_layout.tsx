/**
 * Classes Layout
 *
 * Stack navigator for athlete class screens.
 */

import { Stack } from 'expo-router';

export default function ClassesLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="discover" />
            <Stack.Screen name="[id]" />
            <Stack.Screen name="review" />
        </Stack>
    );
}
