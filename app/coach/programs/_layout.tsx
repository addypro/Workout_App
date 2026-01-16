/**
 * Programs Stack Layout
 *
 * Layout for the coach programs sub-stack.
 */

import { Stack } from 'expo-router';

import { BackButton } from '@/components/navigation/back-button';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const COACH_FALLBACK = '/(tabs)/coach';

export default function ProgramsLayout() {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: colors.background,
                },
                headerTintColor: colors.tint,
                headerTitleStyle: {
                    color: colors.text,
                    fontWeight: '600',
                },
                headerShadowVisible: false,
                contentStyle: {
                    backgroundColor: colors.background,
                },
                headerBackVisible: false,
                gestureEnabled: true,
                animation: 'ios_from_right',
            }}
        >
            {/* Programs Library */}
            <Stack.Screen
                name="index"
                options={{
                    title: 'My Programs',
                    headerLeft: () => <BackButton label="Coach" fallbackRoute={COACH_FALLBACK} />,
                }}
            />

            {/* Program Builder */}
            <Stack.Screen
                name="builder"
                options={{
                    headerShown: false, // Builder has its own header
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    gestureEnabled: true,
                    gestureDirection: 'vertical',
                }}
            />

            {/* Workout Editor */}
            <Stack.Screen
                name="workout-editor"
                options={{
                    headerShown: false, // Editor has its own header
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                    gestureEnabled: true,
                    gestureDirection: 'vertical',
                }}
            />
        </Stack>
    );
}
