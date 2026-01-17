import React, { useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { RootStackParamList } from '../../App';

import { useAppStore } from '../store/useAppStore';
import { Box } from '../components/Box';
import { Text } from '../components/Text';
import { Button } from '../components/Button';
import { NumberStepper } from '../components/NumberStepper';
import { stableHash } from '../lib/hash';
import { SetLog, WorkoutLog, WorkoutPlan } from '../types/models';
import { materializeWorkoutWithSuggestions } from '../domain/progression';

type Props = NativeStackScreenProps<RootStackParamList, 'WorkoutSession'>;

function toInt(s: string): number | undefined {
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : undefined;
}

function toFloat(s: string): number | undefined {
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

export function WorkoutSessionScreen({ route, navigation }: Props) {
  const { planId, workoutId } = route.params;

  const activePlan = useAppStore((s) => s.activePlan);
  const workoutPlansByProgram = useAppStore((s) => s.workoutPlansByProgram);
  const contexts = useAppStore((s) => s.exerciseContexts);
  const saveWorkoutLog = useAppStore((s) => s.saveWorkoutLog);
  const setPlanIndex = useAppStore((s) => s.setActivePlanWorkoutIndex);

  const plan: WorkoutPlan | null = useMemo(() => {
    if (!activePlan) return null;
    const plans = workoutPlansByProgram[activePlan.programId];
    return plans?.find((p) => p.workoutId === workoutId) ?? null;
  }, [activePlan, workoutPlansByProgram, workoutId]);

  const planWithSuggestions = useMemo(() => {
    if (!activePlan || !plan) return null;
    return materializeWorkoutWithSuggestions(plan, activePlan.progressionProfile, contexts, {
      unitUpperInc: activePlan.defaultUpperIncrement,
      unitLowerInc: activePlan.defaultLowerIncrement,
    });
  }, [activePlan, plan, contexts]);

  const [notesByExercise, setNotesByExercise] = useState<Record<string, string>>({});

  // This is a simplified local editing model.
  const [setEdits, setSetEdits] = useState<Record<string, { weight?: number; rpe?: number; reps?: number; seconds?: number; done: boolean }>>({});

  if (!activePlan || !planWithSuggestions) {
    return (
      <Box p={16} style={{ flex: 1 }}>
        <Text w="700">Loading…</Text>
      </Box>
    );
  }

  const unit = activePlan.unitSystem;

  const finish = async () => {
    const workoutLogId = await stableHash(`${planId}::${workoutId}::${new Date().toISOString()}`);

    const exercises = planWithSuggestions.exercises.map((ex) => {
      const sets: SetLog[] = ex.sets.map((s) => {
        const key = `${ex.canonicalName}::${s.setIndex}`;
        const edit = setEdits[key] ?? { done: false };

        const targetReps = s.repSpec.kind === 'reps' ? s.repSpec.value : undefined;
        const targetSeconds = s.repSpec.kind === 'time' ? s.repSpec.value : undefined;

        return {
          setIndex: s.setIndex,
          targetReps,
          targetSeconds,
          suggestedLoad: s.suggestedLoad,
          actualReps: edit.reps,
          actualSeconds: edit.seconds,
          actualLoad: edit.weight,
          rpe: edit.rpe,
          isCompleted: edit.done,
        };
      });

      return {
        canonicalName: ex.canonicalName,
        rawName: ex.rawName,
        kind: ex.kind,
        notes: notesByExercise[ex.canonicalName] || undefined,
        sets,
      };
    });

    const log: WorkoutLog = {
      workoutLogId,
      planId,
      programId: activePlan.programId,
      workoutId: planWithSuggestions.workoutId,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      exercises,
    };

    await saveWorkoutLog(log);

    // Advance plan
    const allPlans = workoutPlansByProgram[activePlan.programId];
    const currentIndex = allPlans.findIndex((p) => p.workoutId === workoutId);
    const nextIndex = Math.min(allPlans.length - 1, currentIndex + 1);
    await setPlanIndex(planId, nextIndex);

    navigation.replace('WorkoutSummary', { workoutLogId });
  };

  return (
    <Box p={12} style={{ flex: 1 }}>
      <Text w="800" s={20} style={{ marginBottom: 4 }}>{planWithSuggestions.name}</Text>
      <Text s={12} c="#9aa4b2" style={{ marginBottom: 10 }}>
        Week {planWithSuggestions.week} Day {planWithSuggestions.day} • Profile: {activePlan.progressionProfile}
      </Text>

      <FlatList
        data={planWithSuggestions.exercises}
        keyExtractor={(e) => e.canonicalName}
        renderItem={({ item: ex }) => {
          return (
            <Box p={12} bg="#11161d" r={14} style={{ borderWidth: 1, borderColor: '#202a36', marginBottom: 12 }}>
              <Pressable onPress={() => navigation.navigate('ExerciseDetail', { canonicalName: ex.canonicalName })}>
                <Text w="800" s={16}>{ex.rawName}</Text>
                <Text s={12} c="#9aa4b2">Rest: {Math.round(ex.defaultRestSeconds / 60)} min</Text>
              </Pressable>

              <Box m={8} />

              {ex.sets.map((s) => {
                const key = `${ex.canonicalName}::${s.setIndex}`;
                const edit = setEdits[key] ?? { done: false };
                const suggested = s.suggestedLoad;

                return (
                  <Box key={key} p={10} bg="#0b0c10" r={12} style={{ marginBottom: 10, borderWidth: 1, borderColor: '#1f2937' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text w="700">Set {s.setIndex + 1}</Text>
                      <Pressable
                        onPress={() => setSetEdits((prev) => ({ ...prev, [key]: { ...edit, done: !edit.done } }))}
                        style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: edit.done ? '#1f6feb' : '#30363d' }}
                      >
                        <Text s={12} w="700">{edit.done ? 'Done' : 'Mark done'}</Text>
                      </Pressable>
                    </View>

                    <Text s={12} c="#9aa4b2" style={{ marginTop: 6 }}>
                      Target: {s.repSpec.kind === 'reps' ? `${s.repSpec.value} reps` : `${s.repSpec.value}s`} • Target RPE: {s.targetRpe ?? 8}
                    </Text>

                    {typeof suggested === 'number' ? (
                      <Text s={12} c="#9aa4b2" style={{ marginTop: 4 }}>Suggested: {suggested} {unit}</Text>
                    ) : null}

                    <Box m={6} />

                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* Weight */}
                      {typeof suggested === 'number' ? (
                        <View style={{ minWidth: 220 }}>
                          <Text s={12} c="#9aa4b2">Weight ({unit})</Text>
                          <NumberStepper
                            value={edit.weight ?? suggested}
                            onChange={(n) => setSetEdits((prev) => ({ ...prev, [key]: { ...edit, weight: n } }))}
                            step={1}
                            min={s.minLoad ?? 0}
                            max={s.maxLoad ?? 9999}
                            precision={1}
                          />
                        </View>
                      ) : null}

                      {/* Reps */}
                      {s.repSpec.kind === 'reps' ? (
                        <View style={{ minWidth: 120 }}>
                          <Text s={12} c="#9aa4b2">Actual reps</Text>
                          <TextInput
                            placeholder="reps"
                            placeholderTextColor="#6b7280"
                            keyboardType="number-pad"
                            value={edit.reps?.toString() ?? ''}
                            onChangeText={(t) => setSetEdits((prev) => ({ ...prev, [key]: { ...edit, reps: toInt(t) } }))}
                            style={{
                              marginTop: 6,
                              padding: 10,
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: '#30363d',
                              color: '#fff',
                            }}
                          />
                        </View>
                      ) : (
                        <View style={{ minWidth: 120 }}>
                          <Text s={12} c="#9aa4b2">Actual seconds</Text>
                          <TextInput
                            placeholder="sec"
                            placeholderTextColor="#6b7280"
                            keyboardType="number-pad"
                            value={edit.seconds?.toString() ?? ''}
                            onChangeText={(t) => setSetEdits((prev) => ({ ...prev, [key]: { ...edit, seconds: toInt(t) } }))}
                            style={{
                              marginTop: 6,
                              padding: 10,
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: '#30363d',
                              color: '#fff',
                            }}
                          />
                        </View>
                      )}

                      {/* RPE */}
                      <View style={{ minWidth: 120 }}>
                        <Text s={12} c="#9aa4b2">RPE</Text>
                        <TextInput
                          placeholder="7-10"
                          placeholderTextColor="#6b7280"
                          keyboardType="decimal-pad"
                          value={edit.rpe?.toString() ?? ''}
                          onChangeText={(t) => setSetEdits((prev) => ({ ...prev, [key]: { ...edit, rpe: toFloat(t) } }))}
                          style={{
                            marginTop: 6,
                            padding: 10,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: '#30363d',
                            color: '#fff',
                          }}
                        />
                      </View>
                    </View>
                  </Box>
                );
              })}

              <TextInput
                placeholder="Notes (optional)"
                placeholderTextColor="#6b7280"
                value={notesByExercise[ex.canonicalName] ?? ''}
                onChangeText={(t) => setNotesByExercise((prev) => ({ ...prev, [ex.canonicalName]: t }))}
                style={{
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#30363d',
                  color: '#fff',
                }}
              />
            </Box>
          );
        }}
        ListFooterComponent={
          <Box>
            <Button title="Finish Workout" onPress={finish} />
            <Text s={12} c="#6b7280" style={{ marginTop: 10 }}>
              Your overrides feed the next suggestions automatically (context is additive).
            </Text>
          </Box>
        }
      />
    </Box>
  );
}
