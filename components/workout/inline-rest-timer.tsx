/**
 * InlineRestTimerRow Component
 * 
 * Compact inline rest timer displayed between sets.
 * 
 * States:
 * - Idle: Greyed pill showing duration
 * - Running: Illuminated countdown with +/- buttons
 * - Completed: Done checkmark, fades out
 * - Early Complete: Shows "Elapsed: Xs" in grey
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import {
    Keyboard,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    Easing,
    FadeIn,
    FadeOut,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useInlineRestTimer } from '@/lib/hooks/use-inline-rest-timer';
import { formatRestTime } from '@/lib/machines/rest-timer.actor';

// ============================================
// TYPES
// ============================================

interface InlineRestTimerRowProps {
    /** Initial duration in seconds */
    duration: number;
    /** Called when timer completes naturally or is skipped */
    onComplete?: () => void;
    /** Called when duration is changed */
    onDurationChange?: (newDuration: number) => void;
    /** Called when timer is disabled via long-press */
    onDisable?: () => void;
    /** Whether to auto-start on mount (set completed) */
    autoStart?: boolean;
    /** Show as "early complete" with elapsed time */
    earlyCompleteElapsed?: number;
    /** Hide the component (for last set) */
    hidden?: boolean;
    /** Track if the set is completed - used to reset timer on uncheck */
    isSetCompleted?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const ADJUSTMENT_STEP = 15; // seconds
const TIMER_HEIGHT_IDLE = 24;    // Half of set row height
const TIMER_HEIGHT_ACTIVE = 32;  // Slightly taller when active to fit controls

// ============================================
// COMPONENT
// ============================================

export function InlineRestTimerRow({
    duration,
    onComplete,
    onDurationChange,
    onDisable,
    autoStart = false,
    earlyCompleteElapsed,
    hidden = false,
    isSetCompleted = false,
}: InlineRestTimerRowProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const prevIsSetCompleted = useRef(isSetCompleted);

    const timer = useInlineRestTimer({
        initialDuration: duration,
        onComplete: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onComplete?.();
        },
        autoStart,
    });

    // ASTEROID PROOF: Adrenaline Timer - Haptic heartbeat in last 10s
    // Lub-dub pattern that accelerates from 60bpm to 120bpm
    useEffect(() => {
        if (timer.status !== 'running') return;
        if (timer.remaining > 10) return;

        // Calculate BPM: accelerates as time decreases (60bpm at 10s -> 120bpm at 0s)
        const bpm = 60 + (10 - timer.remaining) * 6; // 60 -> 120 bpm
        const beatInterval = 60000 / bpm;

        // Lub-dub pattern: Light + Medium with 100ms gap
        const heartbeat = setInterval(() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setTimeout(() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }, 100);
        }, beatInterval);

        return () => clearInterval(heartbeat);
    }, [timer.status, timer.remaining]);

    // Reset timer when set is unchecked (completed → incomplete)
    useEffect(() => {
        if (prevIsSetCompleted.current && !isSetCompleted) {
            // Set was just unchecked - reset timer to full duration
            timer.reset();
        }
        prevIsSetCompleted.current = isSetCompleted;
    }, [isSetCompleted]);

    // Auto-start timer when autoStart prop becomes true
    useEffect(() => {
        if (autoStart && timer.status === 'idle') {
            console.log('[InlineRestTimer] Auto-starting timer, status:', timer.status);
            timer.start();
        }
    }, [autoStart, timer.status, timer.start]);

    // Animation for expand/collapse
    const expandProgress = useSharedValue(autoStart ? 1 : 0);

    useEffect(() => {
        expandProgress.value = withTiming(
            timer.status === 'running' || timer.status === 'paused' ? 1 : 0,
            { duration: 200, easing: Easing.out(Easing.quad) }
        );
    }, [timer.status]);

    const animatedContainerStyle = useAnimatedStyle(() => ({
        height: interpolate(
            expandProgress.value,
            [0, 1],
            [TIMER_HEIGHT_IDLE, TIMER_HEIGHT_ACTIVE]
        ),
    }));

    // Handle early complete display
    if (earlyCompleteElapsed !== undefined) {
        return (
            <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(200)}
                style={[styles.container, styles.containerEarlyComplete]}
            >
                <Ionicons name="checkmark-circle" size={16} color={Colors.dark.textSecondary} />
                <Text style={styles.earlyCompleteText}>
                    Elapsed: {formatRestTime(earlyCompleteElapsed)}
                </Text>
            </Animated.View>
        );
    }

    // Hidden (last set)
    if (hidden) {
        return null;
    }

    // Handle editing mode
    const handleStartEdit = () => {
        if (!timer.canAdjust) return;
        setEditValue(String(timer.duration));
        setIsEditing(true);
    };

    const handleEndEdit = () => {
        const value = parseInt(editValue, 10);
        if (!isNaN(value) && value >= 5 && value <= 600) {
            timer.setDuration(value);
            onDurationChange?.(value);
        }
        setIsEditing(false);
        Keyboard.dismiss();
    };

    // Idle state - compact pill (long-press to disable)
    if (timer.status === 'idle') {
        return (
            <TouchableOpacity
                style={[styles.container, styles.containerIdle]}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    timer.start();
                }}
                onLongPress={() => {
                    // Long-press to disable timer for this set
                    onDisable?.();
                }}
                activeOpacity={0.7}
            >
                <Ionicons name="timer-outline" size={14} color={Colors.dark.textSecondary} />
                {isEditing ? (
                    <TextInput
                        style={styles.editInput}
                        value={editValue}
                        onChangeText={setEditValue}
                        onBlur={handleEndEdit}
                        onSubmitEditing={handleEndEdit}
                        keyboardType="number-pad"
                        autoFocus
                        selectTextOnFocus
                    />
                ) : (
                    <Text style={styles.idleText}>{formatRestTime(timer.duration)}</Text>
                )}
            </TouchableOpacity>
        );
    }

    // Completed state - shows timer row with filled checkbox, tap checkbox to reset
    if (timer.status === 'completed') {
        return (
            <View style={[styles.container, styles.containerCompleted]}>
                <Ionicons name="timer-outline" size={14} color={Colors.dark.success} />
                <Text style={styles.completedText}>{formatRestTime(timer.duration)}</Text>

                {/* Filled checkbox - tap to reset */}
                <TouchableOpacity
                    style={styles.skipButton}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        timer.reset();
                    }}
                >
                    <View style={styles.skipButtonCircleFilled}>
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    </View>
                </TouchableOpacity>
            </View>
        );
    }

    // Running/Paused state - expanded with controls
    return (
        <Animated.View style={[styles.container, styles.containerActive, animatedContainerStyle]}>
            {/* -15 Button */}
            <TouchableOpacity
                style={styles.adjustButton}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    timer.adjustDuration(-ADJUSTMENT_STEP);
                    onDurationChange?.(timer.duration - ADJUSTMENT_STEP);
                }}
                disabled={timer.duration <= 15}
            >
                <Text style={[styles.adjustButtonText, timer.duration <= 15 && styles.adjustButtonDisabled]}>
                    −15
                </Text>
            </TouchableOpacity>

            {/* Timer Display - tap to edit */}
            <TouchableOpacity
                style={styles.timerDisplay}
                onPress={handleStartEdit}
            >
                {isEditing ? (
                    <TextInput
                        style={styles.editInputActive}
                        value={editValue}
                        onChangeText={setEditValue}
                        onBlur={handleEndEdit}
                        onSubmitEditing={handleEndEdit}
                        keyboardType="number-pad"
                        returnKeyType="done"
                        placeholder="secs"
                        placeholderTextColor={Colors.dark.textSecondary}
                        autoFocus
                        selectTextOnFocus
                    />
                ) : (
                    <>
                        <Text style={styles.timerText}>{timer.formatted}</Text>
                        {timer.status === 'paused' && (
                            <Ionicons name="pause" size={12} color={Colors.dark.warning} style={styles.pauseIcon} />
                        )}
                    </>
                )}
            </TouchableOpacity>

            {/* +15 Button */}
            <TouchableOpacity
                style={styles.adjustButton}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    timer.adjustDuration(ADJUSTMENT_STEP);
                    onDurationChange?.(timer.duration + ADJUSTMENT_STEP);
                }}
                disabled={timer.duration >= 600}
            >
                <Text style={[styles.adjustButtonText, timer.duration >= 600 && styles.adjustButtonDisabled]}>
                    +15
                </Text>
            </TouchableOpacity>

            {/* Skip/Done Button - checkmark like set done buttons */}
            <TouchableOpacity
                style={styles.skipButton}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    timer.skip();
                }}
            >
                <View style={styles.skipButtonCircle}>
                    <Ionicons name="checkmark" size={14} color={Colors.dark.success} />
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: Spacing.xs,
        borderRadius: Radius.md,
        overflow: 'hidden',
    },
    containerIdle: {
        height: TIMER_HEIGHT_IDLE,
        backgroundColor: 'rgba(100, 150, 200, 0.25)',  // Subtle blue-grey, more visible
        paddingHorizontal: Spacing.md,
        gap: Spacing.xs,
        alignSelf: 'center',
        width: '50%',
        borderWidth: 1,
        borderColor: 'rgba(100, 150, 200, 0.35)',
    },
    containerActive: {
        height: TIMER_HEIGHT_ACTIVE,
        backgroundColor: Colors.dark.primary + '30',
        borderWidth: 1,
        borderColor: Colors.dark.primary + '60',
        paddingHorizontal: Spacing.xs,
        gap: 2,  // Tighter spacing between buttons and timer
        width: '85%',
        alignSelf: 'center',
    },
    containerCompleted: {
        height: TIMER_HEIGHT_IDLE,
        backgroundColor: Colors.dark.success + '15',
        paddingHorizontal: Spacing.md,
        gap: Spacing.xs,
        alignSelf: 'center',
        width: '50%',
    },
    containerEarlyComplete: {
        height: TIMER_HEIGHT_IDLE,
        backgroundColor: Colors.dark.warning + '15',
        paddingHorizontal: Spacing.md,
        gap: Spacing.xs,
        alignSelf: 'center',
        width: '50%',
    },
    adjustButton: {
        paddingHorizontal: Spacing.xs,
        paddingVertical: Spacing.xs,
        alignItems: 'center',
        justifyContent: 'center',
    },
    adjustButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.dark.primary,
    },
    adjustButtonDisabled: {
        color: Colors.dark.textSecondary,
        opacity: 0.5,
    },
    timerDisplay: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: Spacing.xs,
    },
    timerText: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.dark.text,
        fontVariant: ['tabular-nums'],
    },
    pauseIcon: {
        marginLeft: 4,
    },
    skipButton: {
        paddingHorizontal: Spacing.xs,
        alignItems: 'center',
        justifyContent: 'center',
    },
    skipButtonCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: Colors.dark.success,
        alignItems: 'center',
        justifyContent: 'center',
    },
    skipButtonCircleFilled: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: Colors.dark.success,
        alignItems: 'center',
        justifyContent: 'center',
    },
    editInput: {
        fontSize: 13,
        color: Colors.dark.text,
        fontWeight: '500',
        textAlign: 'center',
        minWidth: 40,
        padding: 4,
    },
    editInputActive: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.dark.text,
        textAlign: 'center',
        minWidth: 50,
        padding: 4,
    },
    idleText: {
        fontSize: 13,
        color: Colors.dark.textSecondary,
        fontWeight: '500',
    },
    completedText: {
        fontSize: 13,
        color: Colors.dark.success,
        fontWeight: '500',
    },
    earlyCompleteText: {
        fontSize: 13,
        color: Colors.dark.warning,
        fontWeight: '500',
    },
});

export default InlineRestTimerRow;
