/**
 * Login Screen
 *
 * Provides Sign in with Apple (iOS), email magic link, and guest mode.
 * Clean, minimal design with clear value proposition.
 *
 * DEV MODE: Includes test accounts for coach/athlete testing
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth, UserRole } from '@/lib/context/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { signInWithApple, signInWithEmail, continueAsGuest, devModeLogin, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isDevLoading, setIsDevLoading] = useState(false);

  const handleAppleSignIn = async () => {
    await signInWithApple();
  };

  const handleEmailSignIn = async () => {
    if (!email.trim() || !email.includes('@')) {
      return;
    }
    setIsEmailLoading(true);
    try {
      await signInWithEmail(email.trim());
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleGuest = () => {
    continueAsGuest();
    router.back();
  };

  const handleDevLogin = async (role: UserRole) => {
    setIsDevLoading(true);
    try {
      await devModeLogin(role);
      router.back();
    } finally {
      setIsDevLoading(false);
    }
  };

  const handleClose = () => {
    router.back();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      padding: Spacing.md,
      paddingTop: Platform.OS === 'ios' ? 60 : Spacing.md,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.groupedBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
    },
    heroSection: {
      alignItems: 'center',
      marginTop: Spacing.xl,
      marginBottom: Spacing.xxl,
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 20,
      backgroundColor: colors.tintMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.lg,
    },
    title: {
      ...Typography.largeTitle,
      color: colors.text,
      textAlign: 'center',
      marginBottom: Spacing.sm,
    },
    subtitle: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      maxWidth: 300,
    },
    benefitsContainer: {
      marginBottom: Spacing.xl,
    },
    benefitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
    },
    benefitIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.tintMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
    },
    benefitText: {
      ...Typography.body,
      color: colors.text,
      flex: 1,
    },
    authSection: {
      gap: Spacing.md,
    },
    appleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.md,
      gap: Spacing.sm,
    },
    appleButtonText: {
      ...Typography.headline,
      color: colorScheme === 'dark' ? '#000000' : '#FFFFFF',
    },
    dividerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: Spacing.md,
    },
    divider: {
      flex: 1,
      height: 1,
      backgroundColor: colors.separator,
    },
    dividerText: {
      ...Typography.footnote,
      color: colors.textTertiary,
      marginHorizontal: Spacing.md,
    },
    emailContainer: {
      gap: Spacing.sm,
    },
    emailInput: {
      ...Typography.body,
      backgroundColor: colors.groupedBackground,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.md,
      color: colors.text,
    },
    emailButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.tint,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.md,
      gap: Spacing.sm,
    },
    emailButtonDisabled: {
      opacity: 0.5,
    },
    emailButtonText: {
      ...Typography.headline,
      color: '#FFFFFF',
    },
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
      ...Typography.body,
      color: colors.tint,
    },
    guestNote: {
      ...Typography.caption1,
      color: colors.textTertiary,
      marginTop: Spacing.xs,
      textAlign: 'center',
    },
    // Dev mode styles
    devSection: {
      marginTop: Spacing.xl,
      paddingTop: Spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.separator,
      borderStyle: 'dashed',
    },
    devTitle: {
      ...Typography.caption1,
      color: colors.textTertiary,
      textAlign: 'center',
      marginBottom: Spacing.md,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    devButtonsRow: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    devButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.groupedBackground,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.sm,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.separator,
      gap: Spacing.xs,
    },
    devButtonText: {
      ...Typography.footnote,
      color: colors.text,
      fontWeight: '500',
    },
    coachButton: {
      borderColor: '#FF9500',
      backgroundColor: 'rgba(255, 149, 0, 0.1)',
    },
    athleteButton: {
      borderColor: '#34C759',
      backgroundColor: 'rgba(52, 199, 89, 0.1)',
    },
  });

  const benefits = [
    { icon: 'cloud-outline', text: 'Sync workouts across all devices' },
    { icon: 'shield-checkmark-outline', text: 'Never lose your progress' },
    { icon: 'analytics-outline', text: 'Track long-term trends' },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroSection}>
          <View style={styles.iconContainer}>
            <Ionicons name="fitness-outline" size={40} color={colors.tint} />
          </View>
          <Text style={styles.title}>Sign In</Text>
          <Text style={styles.subtitle}>
            Create an account to sync your workouts and never lose your progress
          </Text>
        </View>

        <View style={styles.benefitsContainer}>
          {benefits.map((benefit, index) => (
            <View key={index} style={styles.benefitRow}>
              <View style={styles.benefitIcon}>
                <Ionicons name={benefit.icon as any} size={18} color={colors.tint} />
              </View>
              <Text style={styles.benefitText}>{benefit.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.authSection}>
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={styles.appleButton}
              onPress={handleAppleSignIn}
              disabled={isLoading}
            >
              <Ionicons
                name="logo-apple"
                size={20}
                color={colorScheme === 'dark' ? '#000000' : '#FFFFFF'}
              />
              <Text style={styles.appleButtonText}>Sign in with Apple</Text>
            </TouchableOpacity>
          )}

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or continue with email</Text>
            <View style={styles.divider} />
          </View>

          <View style={styles.emailContainer}>
            <TextInput
              style={styles.emailInput}
              placeholder="Enter your email"
              placeholderTextColor={colors.textTertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isEmailLoading}
            />
            <TouchableOpacity
              style={[
                styles.emailButton,
                (!email.includes('@') || isEmailLoading) && styles.emailButtonDisabled,
              ]}
              onPress={handleEmailSignIn}
              disabled={!email.includes('@') || isEmailLoading}
            >
              {isEmailLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="mail-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.emailButtonText}>Send Magic Link</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.guestSection}>
          <TouchableOpacity style={styles.guestButton} onPress={handleGuest}>
            <Text style={styles.guestText}>Continue as Guest</Text>
          </TouchableOpacity>
          <Text style={styles.guestNote}>
            Your data stays on this device only
          </Text>
        </View>

        {/* Dev Mode Test Accounts - Only visible in development */}
        {__DEV__ && (
          <View style={styles.devSection}>
            <Text style={styles.devTitle}>Dev Mode - Test Accounts</Text>
            <View style={styles.devButtonsRow}>
              <TouchableOpacity
                style={[styles.devButton, styles.coachButton]}
                onPress={() => handleDevLogin('coach')}
                disabled={isDevLoading}
              >
                {isDevLoading ? (
                  <ActivityIndicator size="small" color="#FF9500" />
                ) : (
                  <>
                    <Ionicons name="school-outline" size={18} color="#FF9500" />
                    <Text style={[styles.devButtonText, { color: '#FF9500' }]}>
                      Login as Coach
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.devButton, styles.athleteButton]}
                onPress={() => handleDevLogin('athlete')}
                disabled={isDevLoading}
              >
                {isDevLoading ? (
                  <ActivityIndicator size="small" color="#34C759" />
                ) : (
                  <>
                    <Ionicons name="fitness-outline" size={18} color="#34C759" />
                    <Text style={[styles.devButtonText, { color: '#34C759' }]}>
                      Login as Athlete
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
