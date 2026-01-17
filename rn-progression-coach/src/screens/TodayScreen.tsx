import React, { useEffect, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { RootStackParamList } from '../../App';

import { useAppStore } from '../store/useAppStore';
import { Box } from '../components/Box';
import { Text } from '../components/Text';
import { Button } from '../components/Button';
import { materializeWorkoutWithSuggestions } from '../domain/progression';

type Props = NativeStackScreenProps<RootStackParamList, 'Today'>;

export function TodayScreen({ navigation }: Props) {
  const activePlan = useAppStore((s) => s.activePlan);
  const workoutPlansByProgram = useAppStore((s) => s.workoutPlansByProgram);
  const contexts = useAppStore((s) => s.exerciseContexts);
  const refreshContexts = useAppStore((s) => s.refreshContexts);

  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    (async () => {
      setIsRefreshing(true);
      await refreshContexts();
      setIsRefreshing(false);
    })();
  }, [refreshContexts]);

  const nextWorkout = useMemo(() => {
    if (!activePlan) return null;
    const plans = workoutPlansByProgram[activePlan.programId];
    if (!plans || plans.length === 0) return null;
    const idx = Math.min(activePlan.currentWorkoutIndex, plans.length - 1);
    const plan = plans[idx];

    return materializeWorkoutWithSuggestions(plan, activePlan.progressionProfile, contexts, {
      unitUpperInc: activePlan.defaultUpperIncrement,
      unitLowerInc: activePlan.defaultLowerIncrement,
    });
  }, [activePlan, workoutPlansByProgram, contexts]);

  if (!activePlan) {
    return (
      <Box p={16} style={{ flex: 1 }}>
        <Text w="700" s={20} style={{ marginBottom: 8 }}>No active program</Text>
        <Text c="#9aa4b2" style={{ marginBottom: 16 }}>Pick a program to begin.</Text>
        <Button title="Choose Program" onPress={() => navigation.navigate('ProgramLibrary')} />
      </Box>
    );
  }

  if (!nextWorkout) {
    return (
      <Box p={16} style={{ flex: 1 }}>
        <Text w="700" s={20}>Loading workouts…</Text>
        <Text s={13} c="#9aa4b2">If this persists, restart the program setup.</Text>
      </Box>
    );
  }

  return (
    <Box p={16} style={{ flex: 1 }}>
      <Text w="800" s={22} style={{ marginBottom: 6 }}>Next up</Text>
      <Text s={13} c="#9aa4b2" style={{ marginBottom: 14 }}>
        {activePlan.programId} • Week {nextWorkout.week} Day {nextWorkout.day} • Units: {activePlan.unitSystem}
      </Text>

      <Box p={12} bg="#11161d" r={14} style={{ borderWidth: 1, borderColor: '#202a36', marginBottom: 12 }}>
        <Text w="700" s={18} style={{ marginBottom: 8 }}>{nextWorkout.name}</Text>

        {nextWorkout.exercises.slice(0, 5).map((ex) => (
          <View key={ex.canonicalName} style={{ marginBottom: 8 }}>
            <Text w="600">• {ex.rawName}</Text>
            {typeof ex.sets[0]?.suggestedLoad === 'number' ? (
              <Text s={12} c="#9aa4b2">Suggested: {ex.sets[0].suggestedLoad} {activePlan.unitSystem}</Text>
            ) : (
              <Text s={12} c="#9aa4b2">Track completion / effort</Text>
            )}
          </View>
        ))}

        {nextWorkout.exercises.length > 5 ? <Text s={12} c="#6b7280">…and {nextWorkout.exercises.length - 5} more</Text> : null}
      </Box>

      <Button
        title={isRefreshing ? 'Refreshing…' : 'Start Workout'}
        disabled={isRefreshing}
        onPress={() => navigation.navigate('WorkoutSession', { planId: activePlan.planId, workoutId: nextWorkout.workoutId })}
      />

      <Box m={12} />
      <Button title="Back to Programs" variant="secondary" onPress={() => navigation.navigate('ProgramLibrary')} />
    </Box>
  );
}
