/**
 * Coach Classes Layout
 *
 * Stack navigator for class management screens.
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
            <Stack.Screen name="builder" />
            <Stack.Screen name="schedule" />
            <Stack.Screen name="[id]" />
        </Stack>
    );
}
