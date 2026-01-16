/**
 * Swipeable Set Row Component
 *
 * A swipeable row wrapper that reveals a delete button on left swipe.
 * Used for set rows in the workout screen.
 */

import * as Haptics from 'expo-haptics';
import React from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Radius } from '@/constants/theme';

// ============================================
// CONSTANTS
// ============================================

const SET_DELETE_THRESHOLD = -60;
// ASTEROID PROOF: Whip gesture velocity threshold (px/s)
const WHIP_VELOCITY_THRESHOLD = 1500;
const SPRING_CONFIG = { damping: 20, stiffness: 200 };

// ============================================
// HAPTIC HELPERS (JS Thread)
// ============================================

function triggerWhipHaptic(): void {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

// ============================================
// TYPES
// ============================================

interface SwipeableSetRowProps {
    children: React.ReactNode;
    onDelete: () => void;
    canDelete: boolean;
}

// ============================================
// COMPONENT
// ============================================

export function SwipeableSetRow({
    children,
    onDelete,
    canDelete,
}: SwipeableSetRowProps) {
    const translateX = useSharedValue(0);
    const isDeleting = useSharedValue(false);

    const panGesture = Gesture.Pan()
        .activeOffsetX([-15, 15])
        .failOffsetY([-10, 10])
        .enabled(canDelete)
        .onUpdate((e) => {
            if (!isDeleting.value) {
                // Allow swiping all the way left (no limit)
                translateX.value = Math.min(0, e.translationX);
            }
        })
        .onEnd((e) => {
            // ASTEROID PROOF: Whip gesture - fast swipe = instant delete
            const isWhipGesture = e.velocityX < -WHIP_VELOCITY_THRESHOLD;

            if (isWhipGesture && !isDeleting.value) {
                // Whip! Instant delete with heavy haptic
                isDeleting.value = true;
                runOnJS(triggerWhipHaptic)();
                translateX.value = withTiming(-400, { duration: 100 }, () => {
                    runOnJS(onDelete)();
                });
            } else if (translateX.value <= SET_DELETE_THRESHOLD && !isDeleting.value) {
                // Normal swipe past threshold
                isDeleting.value = true;
                translateX.value = withTiming(-400, { duration: 200 }, () => {
                    runOnJS(onDelete)();
                });
            } else if (!isDeleting.value) {
                translateX.value = withSpring(0, SPRING_CONFIG);
            }
        });

    const rowStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    const deleteStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateX.value, [-80, -40, 0], [1, 0.5, 0]),
        width: Math.abs(Math.min(translateX.value, 0)),
    }));

    if (!canDelete) {
        return <>{children}</>;
    }

    return (
        <View style={{ position: 'relative', overflow: 'hidden' }}>
            <Animated.View
                style={[
                    {
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        backgroundColor: '#FF3B30',
                        borderRadius: Radius.sm,
                        alignItems: 'center',
                        justifyContent: 'center',
                    },
                    deleteStyle,
                ]}
            >
                <IconSymbol name="trash.fill" size={16} color="#fff" />
            </Animated.View>
            <GestureDetector gesture={panGesture}>
                <Animated.View style={rowStyle}>{children}</Animated.View>
            </GestureDetector>
        </View>
    );
}

export default SwipeableSetRow;
