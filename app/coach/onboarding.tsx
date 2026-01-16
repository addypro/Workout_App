/**
 * Coach Onboarding Screen
 *
 * New coaches set up their profile (name, specializations).
 * Creates coach profile in database and starts 14-day trial.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { createCoachProfile } from '@/lib/services/coach';

const SPECIALIZATIONS = [
  { id: 'strength', label: 'Strength Training', icon: 'barbell-outline' },
  { id: 'hypertrophy', label: 'Bodybuilding', icon: 'body-outline' },
  { id: 'powerlifting', label: 'Powerlifting', icon: 'fitness-outline' },
  { id: 'crossfit', label: 'CrossFit', icon: 'flash-outline' },
  { id: 'sport', label: 'Sport Performance', icon: 'american-football-outline' },
  { id: 'rehab', label: 'Rehabilitation', icon: 'medical-outline' },
  { id: 'weight_loss', label: 'Weight Loss', icon: 'trending-down-outline' },
  { id: 'general', label: 'General Fitness', icon: 'heart-outline' },
];

export default function CoachOnboardingScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [displayName, setDisplayName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const toggleSpec = (id: string) => {
    setSelectedSpecs((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleComplete = async () => {
    if (!displayName.trim()) {
      Alert.alert('Name Required', 'Please enter your display name.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await createCoachProfile({
        displayName: displayName.trim(),
        businessName: businessName.trim() || undefined,
        specializations: selectedSpecs,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create profile');
      }

      // Navigate to coach dashboard (main tabs)
      router.replace('/(tabs)/coach');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create coach profile');
    } finally {
      setIsLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: Spacing.lg,
      paddingTop: Platform.OS === 'ios' ? 60 : Spacing.xl,
      paddingBottom: 120,
    },
    header: {
      alignItems: 'center',
      marginBottom: Spacing.xl,
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
    },
    section: {
      marginBottom: Spacing.xl,
    },
    sectionTitle: {
      ...Typography.headline,
      color: colors.text,
      marginBottom: Spacing.sm,
    },
    sectionSubtitle: {
      ...Typography.footnote,
      color: colors.textSecondary,
      marginBottom: Spacing.md,
    },
    input: {
      ...Typography.body,
      backgroundColor: colors.groupedBackground,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.md,
      color: colors.text,
      marginBottom: Spacing.sm,
    },
    specsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    specChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.groupedBackground,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: 'transparent',
      gap: Spacing.xs,
    },
    specChipSelected: {
      backgroundColor: colors.tintMuted,
      borderColor: colors.tint,
    },
    specChipText: {
      ...Typography.subhead,
      color: colors.textSecondary,
    },
    specChipTextSelected: {
      color: colors.tint,
      fontWeight: '600',
    },
    trialInfo: {
      backgroundColor: colors.groupedBackground,
      padding: Spacing.lg,
      borderRadius: Radius.lg,
      alignItems: 'center',
    },
    trialBadge: {
      backgroundColor: colors.tint,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.sm,
      marginBottom: Spacing.sm,
    },
    trialBadgeText: {
      ...Typography.caption1,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    trialTitle: {
      ...Typography.headline,
      color: colors.text,
      marginBottom: Spacing.xs,
    },
    trialText: {
      ...Typography.footnote,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: Spacing.lg,
      paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.lg,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.separator,
    },
    completeButton: {
      backgroundColor: colors.tint,
      paddingVertical: Spacing.md,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    completeButtonDisabled: {
      opacity: 0.5,
    },
    completeButtonText: {
      ...Typography.headline,
      color: '#FFFFFF',
    },
  });

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="person-add-outline" size={40} color={colors.tint} />
          </View>
          <Text style={styles.title}>Set Up Your Profile</Text>
          <Text style={styles.subtitle}>
            Let&apos;s get you started with coaching
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Name</Text>
          <Text style={styles.sectionSubtitle}>
            This is how athletes will see you
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Display name"
            placeholderTextColor={colors.textTertiary}
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Business name (optional)"
            placeholderTextColor={colors.textTertiary}
            value={businessName}
            onChangeText={setBusinessName}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specializations</Text>
          <Text style={styles.sectionSubtitle}>
            Select the areas you focus on (optional)
          </Text>
          <View style={styles.specsGrid}>
            {SPECIALIZATIONS.map((spec) => {
              const isSelected = selectedSpecs.includes(spec.id);
              return (
                <TouchableOpacity
                  key={spec.id}
                  style={[styles.specChip, isSelected && styles.specChipSelected]}
                  onPress={() => toggleSpec(spec.id)}
                >
                  <Ionicons
                    name={spec.icon as any}
                    size={16}
                    color={isSelected ? colors.tint : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.specChipText,
                      isSelected && styles.specChipTextSelected,
                    ]}
                  >
                    {spec.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.trialInfo}>
          <View style={styles.trialBadge}>
            <Text style={styles.trialBadgeText}>14-DAY FREE TRIAL</Text>
          </View>
          <Text style={styles.trialTitle}>Full Access Included</Text>
          <Text style={styles.trialText}>
            Manage up to 50 athletes, create unlimited programs,{'\n'}
            and access all coach features. No credit card required.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.completeButton,
            (!displayName.trim() || isLoading) && styles.completeButtonDisabled,
          ]}
          onPress={handleComplete}
          disabled={!displayName.trim() || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.completeButtonText}>Complete Setup</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
