/**
 * Programs Stack Layout
 *
 * Layout for the coach programs sub-stack.
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Platform, Text, TouchableOpacity } from 'react-native';

export default function ProgramsLayout() {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const router = useRouter();

    const BackButton = ({ label = 'Back' }: { label?: string }) => (
        <TouchableOpacity
            onPress={() => {
                if (router.canGoBack()) {
                    router.back();
                } else {
                    router.replace('/(tabs)/coach');
                }
            }}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginLeft: Platform.OS === 'ios' ? -8 : 0,
                paddingVertical: 8,
                paddingRight: 16,
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
            <Ionicons
                name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
                size={Platform.OS === 'ios' ? 28 : 24}
                color={colors.tint}
            />
            {Platform.OS === 'ios' && (
                <Text style={{ color: colors.tint, fontSize: 17, marginLeft: -4 }}>
                    {label}
                </Text>
            )}
        </TouchableOpacity>
    );

    const CloseButton = () => (
        <TouchableOpacity
            onPress={() => {
                if (router.canGoBack()) {
                    router.back();
                } else {
                    router.replace('/(tabs)/coach');
                }
            }}
            style={{ padding: 8 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
            <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
    );

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
                    headerLeft: () => <BackButton label="Coach" />,
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
