/**
 * Assign Program Screen
 *
 * Allows coaches to assign a program to one or more athletes.
 * Features:
 * - Program selection (if not passed as param)
 * - Athlete multi-select
 * - Start date picker
 * - Optional coach notes
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';
import {
  getMyPrograms,
  getMyAthletes,
  assignProgram,
  CoachProgram,
  CoachAthlete,
  AthleteStatus,
} from '@/lib/services/coach';
import { createProgram } from '@/lib/db/storage';

export default function AssignProgramScreen() {
  const params = useLocalSearchParams();
  const programIdParam = params.programId as string | undefined;

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  // Data state
  const [programs, setPrograms] = useState<CoachProgram[]>([]);
  const [athletes, setAthletes] = useState<CoachAthlete[]>([]);
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(true);
  const [isLoadingAthletes, setIsLoadingAthletes] = useState(true);

  // Selection state
  const [selectedProgram, setSelectedProgram] = useState<string | null>(programIdParam || null);
  const [selectedAthletes, setSelectedAthletes] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [coachNotes, setCoachNotes] = useState('');

  // UI state
  const [isAssigning, setIsAssigning] = useState(false);
  const [step, setStep] = useState<'program' | 'athletes' | 'confirm'>(
    programIdParam ? 'athletes' : 'program'
  );

  // Load data
  useEffect(() => {
    loadPrograms();
    loadAthletes();
  }, []);

  const loadPrograms = async () => {
    setIsLoadingPrograms(true);
    try {
      const result = await getMyPrograms(1, 100);
      if (result.success && result.data) {
        setPrograms(result.data.data);
      }
    } catch (error) {
      console.error('Error loading programs:', error);
    } finally {
      setIsLoadingPrograms(false);
    }
  };

  const loadAthletes = async () => {
    setIsLoadingAthletes(true);
    try {
      const result = await getMyAthletes(AthleteStatus.ACTIVE, 1, 100);
      if (result.success && result.data) {
        setAthletes(result.data.data);
      }
    } catch (error) {
      console.error('Error loading athletes:', error);
    } finally {
      setIsLoadingAthletes(false);
    }
  };

  const toggleAthlete = (athleteId: string) => {
    Haptics.selectionAsync();
    setSelectedAthletes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(athleteId)) {
        newSet.delete(athleteId);
      } else {
        newSet.add(athleteId);
      }
      return newSet;
    });
  };

  const selectAllAthletes = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedAthletes.size === athletes.length) {
      setSelectedAthletes(new Set());
    } else {
      setSelectedAthletes(new Set(athletes.map((a) => a.athleteUserId)));
    }
  };

  // Create a new program and navigate to edit
  const handleCreateProgram = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const newProgram = await createProgram('New Program');
      router.push(`/program/${newProgram.id}/edit`);
    } catch (error) {
      console.error('Error creating program:', error);
      Alert.alert('Error', 'Failed to create program. Please try again.');
    }
  };

  // Navigate to browse with return tracking
  const handleBrowsePrograms = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/browse?returnTo=/coach/assign-program' as any);
  };

  const handleAssign = async () => {
    if (!selectedProgram) {
      Alert.alert('Select Program', 'Please select a program to assign.');
      return;
    }

    if (selectedAthletes.size === 0) {
      Alert.alert('Select Athletes', 'Please select at least one athlete.');
      return;
    }

    setIsAssigning(true);
    try {
      const athleteIds = Array.from(selectedAthletes);
      let successCount = 0;
      let errorCount = 0;

      for (const athleteUserId of athleteIds) {
        const result = await assignProgram({
          programId: selectedProgram,
          athleteUserId,
          startDate,
          coachNotes: coachNotes.trim() || undefined,
        });

        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          console.error(`Failed to assign to ${athleteUserId}:`, result.error);
        }
      }

      if (successCount > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const message =
          errorCount > 0
            ? `Assigned to ${successCount} athlete${successCount !== 1 ? 's' : ''}. ${errorCount} failed.`
            : `Successfully assigned to ${successCount} athlete${successCount !== 1 ? 's' : ''}!`;
        Alert.alert('Success', message, [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('Error', 'Failed to assign program. Please try again.');
      }
    } catch (error) {
      console.error('Error assigning program:', error);
      Alert.alert('Error', 'Failed to assign program. Please try again.');
    } finally {
      setIsAssigning(false);
    }
  };

  const selectedProgramData = programs.find((p) => p.id === selectedProgram);

  const renderProgramCard = ({ item }: { item: CoachProgram }) => {
    const isSelected = selectedProgram === item.id;
    const workoutCount = item.workouts?.length || 0;

    return (
      <TouchableOpacity
        style={[
          styles.programCard,
          {
            backgroundColor: colors.groupedBackground,
            borderColor: isSelected ? colors.tint : 'transparent',
            borderWidth: isSelected ? 2 : 0,
          },
        ]}
        onPress={() => {
          Haptics.selectionAsync();
          setSelectedProgram(item.id);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.programInfo}>
          <Text style={[styles.programName, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.programMeta, { color: colors.textSecondary }]}>
            {item.durationWeeks || '?'} weeks • {workoutCount} workouts
          </Text>
        </View>
        <View
          style={[
            styles.radioButton,
            {
              borderColor: isSelected ? colors.tint : colors.separator,
              backgroundColor: isSelected ? colors.tint : 'transparent',
            },
          ]}
        >
          {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
        </View>
      </TouchableOpacity>
    );
  };

  const renderAthleteCard = ({ item }: { item: CoachAthlete }) => {
    const isSelected = selectedAthletes.has(item.athleteUserId);

    return (
      <TouchableOpacity
        style={[
          styles.athleteCard,
          {
            backgroundColor: colors.groupedBackground,
            borderColor: isSelected ? colors.tint : 'transparent',
            borderWidth: isSelected ? 2 : 0,
          },
        ]}
        onPress={() => toggleAthlete(item.athleteUserId)}
        activeOpacity={0.7}
      >
        <View style={[styles.athleteAvatar, { backgroundColor: colors.tintMuted }]}>
          <Ionicons name="person" size={20} color={colors.tint} />
        </View>
        <View style={styles.athleteInfo}>
          <Text style={[styles.athleteName, { color: colors.text }]}>
            {item.athleteName || 'Athlete'}
          </Text>
          {item.athleteEmail && (
            <Text style={[styles.athleteEmail, { color: colors.textSecondary }]}>
              {item.athleteEmail}
            </Text>
          )}
        </View>
        <View
          style={[
            styles.checkbox,
            {
              borderColor: isSelected ? colors.tint : colors.separator,
              backgroundColor: isSelected ? colors.tint : 'transparent',
            },
          ]}
        >
          {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
        </View>
      </TouchableOpacity>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      padding: Spacing.lg,
    },
    stepIndicator: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.xl,
    },
    stepDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    sectionTitle: {
      ...Typography.headline,
      color: colors.text,
      fontWeight: '600',
      marginBottom: Spacing.md,
    },
    selectAllRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
    },
    selectAllText: {
      ...Typography.subhead,
      color: colors.tint,
    },
    selectedCount: {
      ...Typography.footnote,
      color: colors.textSecondary,
    },
    programCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderRadius: Radius.lg,
      marginBottom: Spacing.sm,
    },
    programInfo: {
      flex: 1,
    },
    programName: {
      ...Typography.subhead,
      fontWeight: '600',
    },
    programMeta: {
      ...Typography.caption1,
      marginTop: 2,
    },
    radioButton: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    athleteCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderRadius: Radius.lg,
      marginBottom: Spacing.sm,
    },
    athleteAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
    },
    athleteInfo: {
      flex: 1,
    },
    athleteName: {
      ...Typography.subhead,
      fontWeight: '600',
    },
    athleteEmail: {
      ...Typography.caption1,
      marginTop: 2,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmSection: {
      marginBottom: Spacing.xl,
    },
    confirmCard: {
      backgroundColor: colors.groupedBackground,
      padding: Spacing.lg,
      borderRadius: Radius.lg,
      marginBottom: Spacing.md,
    },
    confirmLabel: {
      ...Typography.caption1,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    confirmValue: {
      ...Typography.subhead,
      color: colors.text,
      fontWeight: '600',
    },
    datePickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dateButton: {
      backgroundColor: colors.tintMuted,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.md,
    },
    dateButtonText: {
      ...Typography.subhead,
      color: colors.tint,
      fontWeight: '600',
    },
    notesInput: {
      ...Typography.body,
      backgroundColor: colors.groupedBackground,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.md,
      color: colors.text,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    footer: {
      flexDirection: 'row',
      gap: Spacing.md,
      padding: Spacing.lg,
      backgroundColor: colors.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.separator,
    },
    backButton: {
      flex: 1,
      paddingVertical: Spacing.md,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.separator,
    },
    backButtonText: {
      ...Typography.headline,
      color: colors.text,
    },
    nextButton: {
      flex: 2,
      paddingVertical: Spacing.md,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.tint,
    },
    nextButtonDisabled: {
      opacity: 0.5,
    },
    nextButtonText: {
      ...Typography.headline,
      color: '#FFFFFF',
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    emptyActions: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginTop: Spacing.xl,
    },
    emptyActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.md,
    },
    emptyActionButtonText: {
      ...Typography.subhead,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    emptyActionButtonSecondary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.md,
      borderWidth: 1,
    },
    emptyActionButtonTextSecondary: {
      ...Typography.subhead,
      fontWeight: '600',
    },
    quickActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    quickActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.md,
    },
    quickActionText: {
      ...Typography.footnote,
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  const renderStepContent = () => {
    // Step 1: Select Program
    if (step === 'program') {
      if (isLoadingPrograms) {
        return (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        );
      }

      if (programs.length === 0) {
        return (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>
              No programs yet.{'\n'}Create or browse programs to assign to athletes.
            </Text>
            <View style={styles.emptyActions}>
              <TouchableOpacity
                style={[styles.emptyActionButton, { backgroundColor: colors.tint }]}
                onPress={handleCreateProgram}
              >
                <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.emptyActionButtonText}>Create Program</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.emptyActionButtonSecondary, { borderColor: colors.tint }]}
                onPress={handleBrowsePrograms}
              >
                <Ionicons name="search-outline" size={18} color={colors.tint} />
                <Text style={[styles.emptyActionButtonTextSecondary, { color: colors.tint }]}>
                  Browse Programs
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      return (
        <>
          <Text style={styles.sectionTitle}>Select a Program</Text>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickActionButton, { backgroundColor: colors.groupedBackground }]}
              onPress={handleCreateProgram}
            >
              <Ionicons name="add-circle-outline" size={16} color={colors.tint} />
              <Text style={[styles.quickActionText, { color: colors.tint }]}>Create New</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickActionButton, { backgroundColor: colors.groupedBackground }]}
              onPress={handleBrowsePrograms}
            >
              <Ionicons name="search-outline" size={16} color={colors.tint} />
              <Text style={[styles.quickActionText, { color: colors.tint }]}>Browse Library</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={programs}
            renderItem={renderProgramCard}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
          />
        </>
      );
    }

    // Step 2: Select Athletes
    if (step === 'athletes') {
      if (isLoadingAthletes) {
        return (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        );
      }

      if (athletes.length === 0) {
        return (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>
              No athletes yet.{'\n'}Invite athletes to assign programs.
            </Text>
          </View>
        );
      }

      return (
        <>
          <View style={styles.selectAllRow}>
            <TouchableOpacity onPress={selectAllAthletes}>
              <Text style={styles.selectAllText}>
                {selectedAthletes.size === athletes.length ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.selectedCount}>
              {selectedAthletes.size} of {athletes.length} selected
            </Text>
          </View>
          <FlatList
            data={athletes}
            renderItem={renderAthleteCard}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
          />
        </>
      );
    }

    // Step 3: Confirm
    return (
      <>
        <Text style={styles.sectionTitle}>Confirm Assignment</Text>

        <View style={styles.confirmSection}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmLabel}>Program</Text>
            <Text style={styles.confirmValue}>{selectedProgramData?.name || 'Unknown'}</Text>
          </View>

          <View style={styles.confirmCard}>
            <Text style={styles.confirmLabel}>Athletes</Text>
            <Text style={styles.confirmValue}>
              {selectedAthletes.size} athlete{selectedAthletes.size !== 1 ? 's' : ''}
            </Text>
          </View>

          <View style={styles.confirmCard}>
            <View style={styles.datePickerRow}>
              <View>
                <Text style={styles.confirmLabel}>Start Date</Text>
                <Text style={styles.confirmValue}>{startDate.toLocaleDateString()}</Text>
              </View>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateButtonText}>Change</Text>
              </TouchableOpacity>
            </View>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event: DateTimePickerEvent, date?: Date) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (date) setStartDate(date);
              }}
              minimumDate={new Date()}
            />
          )}

          <Text style={[styles.confirmLabel, { marginTop: Spacing.md, marginBottom: Spacing.sm }]}>
            Coach Notes (optional)
          </Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add any notes for your athletes..."
            placeholderTextColor={colors.textTertiary}
            value={coachNotes}
            onChangeText={setCoachNotes}
            multiline
            numberOfLines={3}
          />
        </View>
      </>
    );
  };

  const canProceed = () => {
    if (step === 'program') return !!selectedProgram;
    if (step === 'athletes') return selectedAthletes.size > 0;
    return true;
  };

  const handleNext = () => {
    if (step === 'program') {
      setStep('athletes');
    } else if (step === 'athletes') {
      setStep('confirm');
    } else {
      handleAssign();
    }
  };

  const handleBack = () => {
    if (step === 'confirm') {
      setStep('athletes');
    } else if (step === 'athletes') {
      if (!programIdParam) {
        setStep('program');
      } else {
        router.back();
      }
    } else {
      router.back();
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Assign Program',
          headerBackTitle: 'Back',
        }}
      />

      {/* Step Indicator */}
      <View style={styles.stepIndicator}>
        <View
          style={[
            styles.stepDot,
            {
              backgroundColor:
                step === 'program' ? colors.tint : colors.tintMuted,
            },
          ]}
        />
        <View
          style={[
            styles.stepDot,
            {
              backgroundColor:
                step === 'athletes' ? colors.tint : colors.tintMuted,
            },
          ]}
        />
        <View
          style={[
            styles.stepDot,
            {
              backgroundColor:
                step === 'confirm' ? colors.tint : colors.tintMuted,
            },
          ]}
        />
      </View>

      <View style={styles.content}>{renderStepContent()}</View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>
            {step === 'program' || (step === 'athletes' && programIdParam) ? 'Cancel' : 'Back'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextButton, !canProceed() && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!canProceed() || isAssigning}
        >
          {isAssigning ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.nextButtonText}>
              {step === 'confirm' ? 'Assign Program' : 'Next'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
