/**
 * Premium Landing Page
 * 
 * A stunning first-launch experience with:
 * - Beautiful animated gradient background
 * - Staggered entrance animations
 * - Glass morphism value proposition cards
 * - Premium CTAs for sign-up and guest mode
 */

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import {
    Dimensions,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    Easing,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/context/auth-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Storage key to track if user has seen landing
const HAS_SEEN_LANDING_KEY = '@has_seen_landing';

// Animation constants
const SPRING_CONFIG = { damping: 18, stiffness: 100 };
const STAGGER_DELAY = 120;

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
        progress.value = withDelay(delay, withSpring(1, SPRING_CONFIG));
    }, [delay]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(progress.value, [0, 1], [0, 1]),
        transform: [
            { translateY: interpolate(progress.value, [0, 1], [30, 0]) },
            { scale: interpolate(progress.value, [0, 1], [0.95, 1]) },
        ],
    }));

    return (
        <Animated.View style={[style, animatedStyle]} pointerEvents="box-none">
            {children}
        </Animated.View>
    );
}


// ============================================
// MAIN LANDING PAGE
// ============================================

export default function LandingScreen() {
    const { setUserRole, continueAsGuest, signInWithApple, signInWithGoogle, signInWithTwitter, signInWithSpotify, signInWithFacebook } = useAuth();
    const logoGlow = useSharedValue(0);

    // Logo glow animation
    useEffect(() => {
        logoGlow.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
                withTiming(0.5, { duration: 2000, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );
    }, []);

    const logoGlowStyle = useAnimatedStyle(() => ({
        shadowOpacity: interpolate(logoGlow.value, [0.5, 1], [0.3, 0.8]),
        shadowRadius: interpolate(logoGlow.value, [0.5, 1], [20, 40]),
    }));

    // Mark landing as seen and navigate to tabs
    const markSeenAndNavigate = useCallback(async () => {
        await AsyncStorage.setItem(HAS_SEEN_LANDING_KEY, 'true');
        router.replace('/(tabs)');
    }, []);

    // Haptic feedback wrapper
    const triggerHaptic = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, []);

    // Handle Get Started - opens login modal
    const handleGetStarted = useCallback(async () => {
        triggerHaptic();
        await AsyncStorage.setItem(HAS_SEEN_LANDING_KEY, 'true');
        router.push('/(auth)/login');
    }, [triggerHaptic]);

    // Handle Continue as Guest (Athlete role)
    const handleGuest = useCallback(async () => {
        triggerHaptic();
        try {
            // 1. Mark as seen in storage FIRST (prevents NavigationGuard redirect loop)
            await AsyncStorage.setItem(HAS_SEEN_LANDING_KEY, 'true');

            // 2. Set role
            await setUserRole('athlete');

            // 3. Set guest mode
            continueAsGuest();

            // 4. Navigate to tabs (small delay for state updates)
            await new Promise(resolve => setTimeout(resolve, 50));
            router.replace('/(tabs)');
        } catch (error) {
            console.error('[Landing] Error in guest flow:', error);
        }
    }, [continueAsGuest, setUserRole, triggerHaptic]);

    // DEV MODE: Directly set role and navigate
    const handleDevCoach = useCallback(async () => {
        triggerHaptic();
        await AsyncStorage.setItem(HAS_SEEN_LANDING_KEY, 'true');
        await setUserRole('coach');
        router.replace('/coach/onboarding' as any);
    }, [setUserRole, triggerHaptic]);

    const handleDevAthlete = useCallback(async () => {
        triggerHaptic();
        await AsyncStorage.setItem(HAS_SEEN_LANDING_KEY, 'true');
        await setUserRole('athlete');
        router.replace('/(tabs)');
    }, [setUserRole, triggerHaptic]);

    return (
        <View style={styles.container}>
            {/* Full-screen GIF background */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <Animated.Image
                    source={require('@/assets/images/landing-hero.gif')}
                    style={[styles.fullScreenGif, logoGlowStyle]}
                    resizeMode="cover"
                />
            </View>

            {/* Dark gradient overlay at bottom for button visibility */}
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
                locations={[0, 0.4, 1]}
                style={styles.bottomOverlay}
                pointerEvents="none"
            />

            {/* Auth buttons at bottom */}
            <SafeAreaView style={styles.authOverlay}>
                <View style={styles.authButtonsContainer}>
                    {/* OAuth Providers */}
                    {Platform.OS === 'ios' && (
                        <AnimatedElement delay={STAGGER_DELAY * 0}>
                            <TouchableOpacity
                                style={styles.appleButton}
                                onPress={() => { triggerHaptic(); signInWithApple(); }}
                                activeOpacity={0.9}
                            >
                                <Ionicons name="logo-apple" size={22} color="#000000" />
                                <Text style={styles.appleButtonText}>Continue with Apple</Text>
                            </TouchableOpacity>
                        </AnimatedElement>
                    )}

                    <AnimatedElement delay={STAGGER_DELAY * 1}>
                        <TouchableOpacity
                            style={styles.googleButton}
                            onPress={() => { triggerHaptic(); signInWithGoogle(); }}
                            activeOpacity={0.9}
                        >
                            <Ionicons name="logo-google" size={20} color="#4285F4" />
                            <Text style={styles.googleButtonText}>Continue with Google</Text>
                        </TouchableOpacity>
                    </AnimatedElement>

                    <AnimatedElement delay={STAGGER_DELAY * 2}>
                        <TouchableOpacity
                            style={styles.facebookButton}
                            onPress={() => { triggerHaptic(); signInWithFacebook(); }}
                            activeOpacity={0.9}
                        >
                            <Ionicons name="logo-facebook" size={22} color="#FFFFFF" />
                            <Text style={styles.facebookButtonText}>Continue with Facebook</Text>
                        </TouchableOpacity>
                    </AnimatedElement>

                    <AnimatedElement delay={STAGGER_DELAY * 3}>
                        <TouchableOpacity
                            style={styles.twitterButton}
                            onPress={() => { triggerHaptic(); signInWithTwitter(); }}
                            activeOpacity={0.9}
                        >
                            <Ionicons name="logo-twitter" size={22} color="#FFFFFF" />
                            <Text style={styles.twitterButtonText}>Continue with X</Text>
                        </TouchableOpacity>
                    </AnimatedElement>

                    <AnimatedElement delay={STAGGER_DELAY * 4}>
                        <TouchableOpacity
                            style={styles.spotifyButton}
                            onPress={() => { triggerHaptic(); signInWithSpotify(); }}
                            activeOpacity={0.9}
                        >
                            <Ionicons name="musical-notes" size={20} color="#FFFFFF" />
                            <Text style={styles.spotifyButtonText}>Continue with Spotify</Text>
                        </TouchableOpacity>
                    </AnimatedElement>

                    {/* Divider */}
                    <AnimatedElement delay={STAGGER_DELAY * 5}>
                        <View style={styles.dividerRow}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>or</Text>
                            <View style={styles.dividerLine} />
                        </View>
                    </AnimatedElement>

                    {/* Email Auth Buttons */}
                    <AnimatedElement delay={STAGGER_DELAY * 6}>
                        <View style={styles.emailAuthRow}>
                            <TouchableOpacity
                                style={styles.signupButton}
                                onPress={() => {
                                    triggerHaptic();
                                    AsyncStorage.setItem(HAS_SEEN_LANDING_KEY, 'true');
                                    router.push('/(auth)/login?mode=signup');
                                }}
                                activeOpacity={0.9}
                            >
                                <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />
                                <Text style={styles.signupButtonText}>Sign Up</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.loginButton}
                                onPress={() => {
                                    triggerHaptic();
                                    AsyncStorage.setItem(HAS_SEEN_LANDING_KEY, 'true');
                                    router.push('/(auth)/login?mode=login');
                                }}
                                activeOpacity={0.9}
                            >
                                <Ionicons name="log-in-outline" size={18} color="#8B5CF6" />
                                <Text style={styles.loginButtonText}>Log In</Text>
                            </TouchableOpacity>
                        </View>
                    </AnimatedElement>

                    {/* Continue as Guest */}
                    <AnimatedElement delay={STAGGER_DELAY * 7}>
                        <TouchableOpacity
                            style={styles.guestButton}
                            onPress={handleGuest}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="person-outline" size={18} color="#FFFFFF" />
                            <Text style={styles.guestButtonText}>Continue as Guest</Text>
                        </TouchableOpacity>
                    </AnimatedElement>

                    {/* Privacy Policy Link */}
                    <AnimatedElement delay={STAGGER_DELAY * 8}>
                        <TouchableOpacity
                            style={styles.privacyLink}
                            onPress={() => {
                                triggerHaptic();
                                router.push('/(auth)/privacy-policy' as any);
                            }}
                        >
                            <Text style={styles.privacyText}>
                                By continuing, you agree to our{' '}
                                <Text style={styles.privacyLinkText}>Privacy Policy</Text>
                            </Text>
                        </TouchableOpacity>
                    </AnimatedElement>

                    {/* Dev Mode */}
                    {__DEV__ && (
                        <AnimatedElement delay={STAGGER_DELAY * 9}>
                            <View style={styles.devSection}>
                                <View style={styles.devDivider} />
                                <Text style={styles.devLabel}>DEV MODE</Text>
                                <View style={styles.devButtons}>
                                    <TouchableOpacity
                                        style={styles.devButton}
                                        onPress={handleDevCoach}
                                    >
                                        <Text style={styles.devButtonText}>Coach</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.devButton}
                                        onPress={handleDevAthlete}
                                    >
                                        <Text style={styles.devButtonText}>Athlete</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </AnimatedElement>
                    )}
                </View>
            </SafeAreaView>
        </View>
    );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    fullScreenGif: {
        ...StyleSheet.absoluteFillObject,
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
    },
    bottomOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: SCREEN_HEIGHT * 0.55,
    },
    authOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    authButtonsContainer: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: Platform.OS === 'ios' ? 16 : Spacing.lg,
        gap: Spacing.sm,
    },
    // OAuth Buttons
    appleButton: {
        height: 50,
        borderRadius: Radius.lg,
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    appleButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000000',
    },
    googleButton: {
        height: 50,
        borderRadius: Radius.lg,
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    googleButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
    },
    facebookButton: {
        height: 50,
        borderRadius: Radius.lg,
        backgroundColor: '#1877F2',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    facebookButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    twitterButton: {
        height: 50,
        borderRadius: Radius.lg,
        backgroundColor: '#000000',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    twitterButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    spotifyButton: {
        height: 50,
        borderRadius: Radius.lg,
        backgroundColor: '#1DB954',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    spotifyButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    // Divider
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: Spacing.xs,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    dividerText: {
        paddingHorizontal: Spacing.md,
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.5)',
    },
    // Email Auth Row
    emailAuthRow: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    signupButton: {
        flex: 1,
        height: 50,
        borderRadius: Radius.lg,
        backgroundColor: '#8B5CF6',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
    },
    signupButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    loginButton: {
        flex: 1,
        height: 50,
        borderRadius: Radius.lg,
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.4)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
    },
    loginButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#8B5CF6',
    },
    // Guest Button
    guestButton: {
        height: 50,
        borderRadius: Radius.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    guestButtonText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#FFFFFF',
    },
    // Privacy Policy
    privacyLink: {
        paddingVertical: Spacing.sm,
        alignItems: 'center',
    },
    privacyText: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.5)',
        textAlign: 'center',
    },
    privacyLinkText: {
        color: '#8B5CF6',
        textDecorationLine: 'underline',
    },
    // Dev Mode
    devSection: {
        marginTop: Spacing.xs,
        alignItems: 'center',
    },
    devDivider: {
        width: 60,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        marginBottom: Spacing.xs,
    },
    devLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.4)',
        letterSpacing: 2,
        marginBottom: Spacing.xs,
    },
    devButtons: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    devButton: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.md,
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.4)',
    },
    devButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8B5CF6',
    },
});
