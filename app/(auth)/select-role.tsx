/**
 * Role Selection Screen
 *
 * Shown after initial sign-in to choose between Athlete or Coach.
 * Athletes get free access, Coaches start a 14-day trial.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth, UserRole } from '@/lib/context/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';

interface RoleOption {
  role: UserRole;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  features: string[];
  badge?: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    role: 'athlete',
    title: 'Athlete',
    subtitle: 'Track your workouts',
    icon: 'fitness-outline',
    features: [
      'Log workouts with voice or manual entry',
      'Follow training programs',
      'Track progress over time',
      'Sync across devices',
    ],
  },
  {
    role: 'coach',
    title: 'Coach',
    subtitle: 'Train your athletes',
    icon: 'people-outline',
    badge: '14-day free trial',
    features: [
      'Create custom programs',
      'Manage up to 50 athletes',
      'Track athlete progress',
      'Add sport-specific exercises',
    ],
  },
];

export default function SelectRoleScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { setUserRole } = useAuth();

  const [selectedRole, setSelectedRole] = useState<UserRole>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectRole = async () => {
    if (!selectedRole) return;

    setIsLoading(true);
    try {
      await setUserRole(selectedRole);

      // Navigate based on role
      if (selectedRole === 'coach') {
        router.replace('/coach/onboarding' as any);
      } else {
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('Error setting role:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.OS === 'ios' ? 60 : Spacing.xl,
    },
    content: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
    },
    header: {
      alignItems: 'center',
      marginBottom: Spacing.xxl,
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
    },
    optionsContainer: {
      gap: Spacing.md,
    },
    optionCard: {
      backgroundColor: colors.groupedBackground,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    optionCardSelected: {
      borderColor: colors.tint,
      backgroundColor: colors.tintMuted,
    },
    optionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    optionIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
    },
    optionIconContainerSelected: {
      backgroundColor: colors.tint,
    },
    optionTitleContainer: {
      flex: 1,
    },
    optionTitle: {
      ...Typography.headline,
      color: colors.text,
    },
    optionSubtitle: {
      ...Typography.footnote,
      color: colors.textSecondary,
    },
    badge: {
      backgroundColor: colors.tint,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: Radius.sm,
    },
    badgeText: {
      ...Typography.caption2,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    checkmark: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.separator,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkmarkSelected: {
      borderColor: colors.tint,
      backgroundColor: colors.tint,
    },
    featuresList: {
      marginTop: Spacing.sm,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
    },
    featureText: {
      ...Typography.subhead,
      color: colors.textSecondary,
      marginLeft: Spacing.sm,
      flex: 1,
    },
    footer: {
      padding: Spacing.lg,
      paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.lg,
    },
    continueButton: {
      backgroundColor: colors.tint,
      paddingVertical: Spacing.md,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    continueButtonDisabled: {
      opacity: 0.5,
    },
    continueButtonText: {
      ...Typography.headline,
      color: '#FFFFFF',
    },
    note: {
      ...Typography.caption1,
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: Spacing.md,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>How will you use the app?</Text>
          <Text style={styles.subtitle}>You can change this later in settings</Text>
        </View>

        <View style={styles.optionsContainer}>
          {ROLE_OPTIONS.map((option) => {
            const isSelected = selectedRole === option.role;

            return (
              <TouchableOpacity
                key={option.role}
                style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                onPress={() => setSelectedRole(option.role)}
                activeOpacity={0.7}
              >
                <View style={styles.optionHeader}>
                  <View
                    style={[
                      styles.optionIconContainer,
                      isSelected && styles.optionIconContainerSelected,
                    ]}
                  >
                    <Ionicons
                      name={option.icon}
                      size={24}
                      color={isSelected ? '#FFFFFF' : colors.tint}
                    />
                  </View>
                  <View style={styles.optionTitleContainer}>
                    <Text style={styles.optionTitle}>{option.title}</Text>
                    <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                  </View>
                  {option.badge && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{option.badge}</Text>
                    </View>
                  )}
                  <View style={[styles.checkmark, isSelected && styles.checkmarkSelected]}>
                    {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                  </View>
                </View>

                <View style={styles.featuresList}>
                  {option.features.map((feature, index) => (
                    <View key={index} style={styles.featureRow}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={isSelected ? colors.tint : colors.textTertiary}
                      />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, !selectedRole && styles.continueButtonDisabled]}
          onPress={handleSelectRole}
          disabled={!selectedRole || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.continueButtonText}>
              {selectedRole === 'coach' ? 'Start Free Trial' : 'Continue'}
            </Text>
          )}
        </TouchableOpacity>
        {selectedRole === 'coach' && (
          <Text style={styles.note}>
            No credit card required. Cancel anytime.
          </Text>
        )}
      </View>
    </View>
  );
}
