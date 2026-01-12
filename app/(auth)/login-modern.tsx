/**
 * Modern Login Screen
 *
 * High-fidelity login experience with:
 * - Cascading entrance animations (Logo → Title → Form → Buttons)
 * - Real-time Zod email validation with visual feedback
 * - Apple Sign-In (iOS only), Magic Link, Guest mode
 * - Dev mode for Coach/Athlete role testing
 * - Inline error handling (no Alert.alert)
 * - Full dark mode support
 *
 * Animation Philosophy:
 * - Elements cascade in with staggered delays (100ms each)
 * - Spring physics for natural, organic motion
 * - Loading states integrated into buttons, not full-screen spinners
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    Easing,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming
} from 'react-native-reanimated';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth, UserRole } from '@/lib/context/auth-context';

// Conditionally import Apple Authentication for iOS
let AppleAuthentication: typeof import('expo-apple-authentication') | null = null;
if (Platform.OS === 'ios') {
    AppleAuthentication = require('expo-apple-authentication');
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// EMAIL VALIDATION (simple regex instead of Zod)
// ============================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(email: string): boolean {
    return EMAIL_REGEX.test(email);
}

type EmailValidationState = 'idle' | 'valid' | 'invalid';

// ============================================
// ANIMATION CONSTANTS
// ============================================

const SPRING_CONFIG = { damping: 18, stiffness: 120 };
const STAGGER_DELAY = 100; // ms between each element

// ============================================
// ANIMATED FADE-IN COMPONENT
// ============================================

interface AnimatedElementProps {
    delay: number;
    children: React.ReactNode;
    style?: any;
}

function AnimatedElement({ delay, children, style }: AnimatedElementProps) {
    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = withDelay(
            delay,
            withSpring(1, SPRING_CONFIG)
        );
    }, [delay]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(progress.value, [0, 1], [0, 1]),
        transform: [
            { translateY: interpolate(progress.value, [0, 1], [20, 0]) },
        ],
    }));

    return (
        <Animated.View style={[style, animatedStyle]}>
            {children}
        </Animated.View>
    );
}

// ============================================
// ANIMATED BUTTON WITH LOADING STATE
// ============================================

interface AnimatedButtonProps {
    onPress: () => void;
    isLoading: boolean;
    disabled: boolean;
    style: any;
    textStyle: any;
    icon?: string;
    iconColor?: string;
    label: string;
    loadingColor?: string;
    accessibilityLabel: string;
}

function AnimatedButton({
    onPress,
    isLoading,
    disabled,
    style,
    textStyle,
    icon,
    iconColor,
    label,
    loadingColor = '#FFFFFF',
    accessibilityLabel,
}: AnimatedButtonProps) {
    const scale = useSharedValue(1);
    const loadingRotation = useSharedValue(0);

    // Loading spinner animation
    useEffect(() => {
        if (isLoading) {
            loadingRotation.value = withTiming(360, {
                duration: 1000,
                easing: Easing.linear,
            });
            const interval = setInterval(() => {
                loadingRotation.value = 0;
                loadingRotation.value = withTiming(360, {
                    duration: 1000,
                    easing: Easing.linear,
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [isLoading]);

    const handlePressIn = useCallback(() => {
        scale.value = withSpring(0.96, SPRING_CONFIG);
    }, []);

    const handlePressOut = useCallback(() => {
        scale.value = withSpring(1, SPRING_CONFIG);
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: disabled ? 0.5 : 1,
    }));

    const spinnerStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${loadingRotation.value}deg` }],
    }));

    return (
        <TouchableOpacity
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled || isLoading}
            activeOpacity={0.9}
            accessibilityLabel={accessibilityLabel}
            accessibilityRole="button"
            accessibilityState={{ disabled: disabled || isLoading }}
        >
            <Animated.View style={[style, animatedStyle]}>
                {isLoading ? (
                    <Animated.View style={spinnerStyle}>
                        <Ionicons name="reload" size={20} color={loadingColor} />
                    </Animated.View>
                ) : (
                    <>
                        {icon && <Ionicons name={icon as any} size={20} color={iconColor} />}
                        <Text style={textStyle}>{label}</Text>
                    </>
                )}
            </Animated.View>
        </TouchableOpacity>
    );
}

// ============================================
// INLINE TOAST/ERROR COMPONENT
// ============================================

interface InlineToastProps {
    message: string | null;
    type: 'error' | 'success' | 'info';
    onDismiss: () => void;
}

function InlineToast({ message, type, onDismiss }: InlineToastProps) {
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(-10);

    useEffect(() => {
        if (message) {
            opacity.value = withSpring(1, SPRING_CONFIG);
            translateY.value = withSpring(0, SPRING_CONFIG);

            // Auto-dismiss after 4 seconds
            const timeout = setTimeout(() => {
                opacity.value = withTiming(0, { duration: 200 });
                translateY.value = withTiming(-10, { duration: 200 });
                setTimeout(onDismiss, 200);
            }, 4000);

            return () => clearTimeout(timeout);
        }
    }, [message]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }],
    }));

    if (!message) return null;

    const bgColor = type === 'error' ? '#FF3B3014' : type === 'success' ? '#34C75914' : '#5AC8FA14';
    const borderColor = type === 'error' ? '#FF3B30' : type === 'success' ? '#34C759' : '#5AC8FA';
    const iconName = type === 'error' ? 'alert-circle' : type === 'success' ? 'checkmark-circle' : 'information-circle';

    return (
        <Animated.View
            style={[
                {
                    backgroundColor: bgColor,
                    borderWidth: 1,
                    borderColor: borderColor,
                    borderRadius: Radius.md,
                    padding: Spacing.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: Spacing.sm,
                    marginBottom: Spacing.md,
                },
                animatedStyle,
            ]}
        >
            <Ionicons name={iconName as any} size={20} color={borderColor} />
            <Text style={{ flex: 1, color: borderColor, ...Typography.footnote }}>
                {message}
            </Text>
            <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={18} color={borderColor} />
            </TouchableOpacity>
        </Animated.View>
    );
}

// ============================================
// DEV MODE SECTION (Compiled out in production)
// ============================================

interface DevModeSectionProps {
    colors: typeof Colors.light;
    onDevLogin: (role: UserRole) => void;
    isLoading: boolean;
}

function DevModeSection({ colors, onDevLogin, isLoading }: DevModeSectionProps) {
    // This component only renders in __DEV__ mode
    if (!__DEV__) return null;

    return (
        <AnimatedElement delay={STAGGER_DELAY * 7}>
            <View style={devStyles.container}>
                <View style={[devStyles.divider, { backgroundColor: colors.separator }]} />
                <Text style={[devStyles.title, { color: colors.textTertiary }]}>
                    🔧 DEV MODE
                </Text>
                <View style={devStyles.buttonRow}>
                    <TouchableOpacity
                        style={[devStyles.button, devStyles.coachButton]}
                        onPress={() => onDevLogin('coach')}
                        disabled={isLoading}
                    >
                        <Ionicons name="school-outline" size={18} color="#FF9500" />
                        <Text style={[devStyles.buttonText, { color: '#FF9500' }]}>Coach</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[devStyles.button, devStyles.athleteButton]}
                        onPress={() => onDevLogin('athlete')}
                        disabled={isLoading}
                    >
                        <Ionicons name="fitness-outline" size={18} color="#34C759" />
                        <Text style={[devStyles.buttonText, { color: '#34C759' }]}>Athlete</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </AnimatedElement>
    );
}

const devStyles = StyleSheet.create({
    container: {
        marginTop: Spacing.xl,
        paddingTop: Spacing.lg,
    },
    divider: {
        height: 1,
        marginBottom: Spacing.md,
    },
    title: {
        ...Typography.caption2,
        textAlign: 'center',
        marginBottom: Spacing.md,
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.md,
        borderRadius: Radius.md,
        borderWidth: 1,
        gap: Spacing.xs,
    },
    coachButton: {
        borderColor: '#FF9500',
        backgroundColor: 'rgba(255, 149, 0, 0.08)',
    },
    athleteButton: {
        borderColor: '#34C759',
        backgroundColor: 'rgba(52, 199, 89, 0.08)',
    },
    buttonText: {
        ...Typography.footnote,
        fontWeight: '600',
    },
});

// ============================================
// MAIN COMPONENT
// ============================================

export default function LoginModernScreen() {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const { signInWithApple, signInWithEmail, continueAsGuest, devModeLogin, isLoading } = useAuth();

    // Form state
    const [email, setEmail] = useState('');
    const [emailValidation, setEmailValidation] = useState<EmailValidationState>('idle');
    const [isEmailLoading, setIsEmailLoading] = useState(false);
    const [isAppleLoading, setIsAppleLoading] = useState(false);
    const [isDevLoading, setIsDevLoading] = useState(false);

    // Error/success toast state
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [toastType, setToastType] = useState<'error' | 'success' | 'info'>('info');

    // ========================================
    // EMAIL VALIDATION (real-time with Zod)
    // ========================================

    useEffect(() => {
        if (email.length === 0) {
            setEmailValidation('idle');
            return;
        }

        setEmailValidation(isValidEmail(email) ? 'valid' : 'invalid');
    }, [email]);

    // ========================================
    // HANDLERS
    // ========================================

    const showToast = useCallback((message: string, type: 'error' | 'success' | 'info') => {
        setToastMessage(message);
        setToastType(type);
    }, []);

    const handleAppleSignIn = useCallback(async () => {
        setIsAppleLoading(true);
        try {
            await signInWithApple();
        } catch (error: any) {
            showToast(error?.message || 'Apple Sign-In failed. Please try again.', 'error');
        } finally {
            setIsAppleLoading(false);
        }
    }, [signInWithApple, showToast]);

    const handleEmailSignIn = useCallback(async () => {
        if (emailValidation !== 'valid') {
            showToast('Please enter a valid email address', 'error');
            return;
        }

        setIsEmailLoading(true);
        try {
            await signInWithEmail(email.trim());
            showToast('Magic link sent! Check your inbox.', 'success');
        } catch (error: any) {
            showToast(error?.message || 'Failed to send magic link. Please try again.', 'error');
        } finally {
            setIsEmailLoading(false);
        }
    }, [email, emailValidation, signInWithEmail, showToast]);

    const handleGuest = useCallback(() => {
        continueAsGuest();
        router.back();
    }, [continueAsGuest]);

    const handleDevLogin = useCallback(async (role: UserRole) => {
        setIsDevLoading(true);
        try {
            await devModeLogin(role);
            router.back();
        } catch (error: any) {
            showToast(error?.message || 'Dev login failed', 'error');
        } finally {
            setIsDevLoading(false);
        }
    }, [devModeLogin, showToast]);

    const handleClose = useCallback(() => {
        router.back();
    }, []);

    // ========================================
    // STYLES
    // ========================================

    const styles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            padding: Spacing.md,
            paddingTop: Platform.OS === 'ios' ? 60 : Spacing.lg,
        },
        closeButton: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.groupedBackground,
            alignItems: 'center',
            justifyContent: 'center',
        },
        scrollContent: {
            flex: 1,
            paddingHorizontal: Spacing.lg,
        },
        // Hero Section
        heroSection: {
            alignItems: 'center',
            marginTop: Spacing.xl,
            marginBottom: Spacing.xxl,
        },
        logoContainer: {
            width: 88,
            height: 88,
            borderRadius: 24,
            backgroundColor: colors.tintMuted,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: Spacing.lg,
        },
        title: {
            ...Typography.largeTitle,
            color: colors.text,
            textAlign: 'center',
            marginBottom: Spacing.xs,
        },
        subtitle: {
            ...Typography.body,
            color: colors.textSecondary,
            textAlign: 'center',
            maxWidth: 280,
            lineHeight: 24,
        },
        // Value Props
        valuePropsContainer: {
            marginBottom: Spacing.xl,
        },
        valueProp: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: Spacing.sm,
            gap: Spacing.md,
        },
        valuePropIcon: {
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: colors.tintMuted,
            alignItems: 'center',
            justifyContent: 'center',
        },
        valuePropText: {
            ...Typography.subhead,
            color: colors.text,
            flex: 1,
        },
        // Auth Section
        authSection: {
            gap: Spacing.md,
        },
        appleButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
            paddingVertical: 16,
            paddingHorizontal: Spacing.lg,
            borderRadius: Radius.md,
            gap: Spacing.sm,
        },
        appleButtonText: {
            ...Typography.headline,
            color: colorScheme === 'dark' ? '#000000' : '#FFFFFF',
        },
        dividerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginVertical: Spacing.sm,
        },
        dividerLine: {
            flex: 1,
            height: 1,
            backgroundColor: colors.separator,
        },
        dividerText: {
            ...Typography.caption1,
            color: colors.textTertiary,
            marginHorizontal: Spacing.md,
        },
        // Email Form
        emailInputContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.groupedBackground,
            borderRadius: Radius.md,
            borderWidth: 1.5,
            borderColor: emailValidation === 'valid'
                ? colors.success
                : emailValidation === 'invalid'
                    ? colors.error
                    : 'transparent',
            paddingHorizontal: Spacing.md,
        },
        emailInput: {
            ...Typography.body,
            flex: 1,
            paddingVertical: 14,
            color: colors.text,
        },
        emailValidationIcon: {
            marginLeft: Spacing.sm,
        },
        emailButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.tint,
            paddingVertical: 16,
            paddingHorizontal: Spacing.lg,
            borderRadius: Radius.md,
            gap: Spacing.sm,
        },
        emailButtonText: {
            ...Typography.headline,
            color: '#FFFFFF',
        },
        // Guest Section
        guestSection: {
            alignItems: 'center',
            marginTop: Spacing.xl,
            paddingBottom: Spacing.xxl,
        },
        guestButton: {
            paddingVertical: Spacing.sm,
            paddingHorizontal: Spacing.md,
        },
        guestText: {
            ...Typography.subhead,
            color: colors.textSecondary,
        },
        guestNote: {
            ...Typography.caption1,
            color: colors.textTertiary,
            marginTop: Spacing.xs,
        },
    });

    // ========================================
    // VALUE PROPOSITIONS
    // ========================================

    const valueProps = [
        { icon: 'cloud-outline', text: 'Sync workouts across all your devices' },
        { icon: 'shield-checkmark-outline', text: 'Never lose your progress again' },
        { icon: 'trending-up-outline', text: 'Track long-term strength gains' },
    ];

    // ========================================
    // RENDER
    // ========================================

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            {/* Header with close button */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.closeButton}
                    onPress={handleClose}
                    accessibilityLabel="Close login screen"
                    accessibilityRole="button"
                >
                    <Ionicons name="close" size={20} color={colors.text} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollContent}
                contentContainerStyle={{ flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Toast for errors/success */}
                <InlineToast
                    message={toastMessage}
                    type={toastType}
                    onDismiss={() => setToastMessage(null)}
                />

                {/* Hero Section - Logo + Title (Cascade in first) */}
                <AnimatedElement delay={STAGGER_DELAY * 0} style={styles.heroSection}>
                    <View style={styles.logoContainer}>
                        <Ionicons name="barbell-outline" size={44} color={colors.tint} />
                    </View>
                    <Text style={styles.title}>Welcome Back</Text>
                    <Text style={styles.subtitle}>
                        Sign in to sync your workouts and track your gains across all devices
                    </Text>
                </AnimatedElement>

                {/* Value Propositions (Cascade in second) */}
                <AnimatedElement delay={STAGGER_DELAY * 2} style={styles.valuePropsContainer}>
                    {valueProps.map((prop, index) => (
                        <View key={index} style={styles.valueProp}>
                            <View style={styles.valuePropIcon}>
                                <Ionicons name={prop.icon as any} size={20} color={colors.tint} />
                            </View>
                            <Text style={styles.valuePropText}>{prop.text}</Text>
                        </View>
                    ))}
                </AnimatedElement>

                {/* Auth Section (Cascade in third) */}
                <AnimatedElement delay={STAGGER_DELAY * 3} style={styles.authSection}>
                    {/* Apple Sign-In (iOS only) */}
                    {Platform.OS === 'ios' && (
                        <AnimatedButton
                            onPress={handleAppleSignIn}
                            isLoading={isAppleLoading}
                            disabled={isLoading}
                            style={styles.appleButton}
                            textStyle={styles.appleButtonText}
                            icon="logo-apple"
                            iconColor={colorScheme === 'dark' ? '#000000' : '#FFFFFF'}
                            label="Continue with Apple"
                            loadingColor={colorScheme === 'dark' ? '#000000' : '#FFFFFF'}
                            accessibilityLabel="Sign in with Apple"
                        />
                    )}

                    {/* Divider */}
                    <View style={styles.dividerRow}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>or use email</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* Email Input with Validation */}
                    <View style={styles.emailInputContainer}>
                        <Ionicons name="mail-outline" size={20} color={colors.textTertiary} />
                        <TextInput
                            style={styles.emailInput}
                            placeholder="you@example.com"
                            placeholderTextColor={colors.textTertiary}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="email"
                            editable={!isEmailLoading}
                            accessibilityLabel="Email address input"
                            accessibilityHint="Enter your email to receive a magic link"
                        />
                        {/* Validation indicator */}
                        {emailValidation === 'valid' && (
                            <Ionicons
                                name="checkmark-circle"
                                size={22}
                                color={colors.success}
                                style={styles.emailValidationIcon}
                            />
                        )}
                        {emailValidation === 'invalid' && email.length > 3 && (
                            <Ionicons
                                name="close-circle"
                                size={22}
                                color={colors.error}
                                style={styles.emailValidationIcon}
                            />
                        )}
                    </View>

                    {/* Send Magic Link Button */}
                    <AnimatedButton
                        onPress={handleEmailSignIn}
                        isLoading={isEmailLoading}
                        disabled={emailValidation !== 'valid'}
                        style={styles.emailButton}
                        textStyle={styles.emailButtonText}
                        icon="paper-plane-outline"
                        iconColor="#FFFFFF"
                        label="Send Magic Link"
                        loadingColor="#FFFFFF"
                        accessibilityLabel="Send magic link to email"
                    />
                </AnimatedElement>

                {/* Guest Mode (Subtle, deemphasized) */}
                <AnimatedElement delay={STAGGER_DELAY * 5} style={styles.guestSection}>
                    <TouchableOpacity
                        style={styles.guestButton}
                        onPress={handleGuest}
                        accessibilityLabel="Continue without signing in"
                        accessibilityRole="button"
                    >
                        <Text style={styles.guestText}>Continue as Guest</Text>
                    </TouchableOpacity>
                    <Text style={styles.guestNote}>
                        Data stays on this device only
                    </Text>
                </AnimatedElement>

                {/* Dev Mode Section (Compiled out in production) */}
                <DevModeSection
                    colors={colors}
                    onDevLogin={handleDevLogin}
                    isLoading={isDevLoading}
                />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
