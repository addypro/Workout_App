import React, { useEffect, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { RootStackParamList } from '../../App';

import { useAppStore } from '../store/useAppStore';
import { Box } from '../components/Box';
import { Text } from '../components/Text';
import { Button } from '../components/Button';

type Props = NativeStackScreenProps<RootStackParamList, 'WorkoutSummary'>;

export function WorkoutSummaryScreen({ route, navigation }: Props) {
  const { workoutLogId } = route.params;
  const loadWorkoutLog = useAppStore((s) => s.loadWorkoutLog);
  const upsertFromLog = useAppStore((s) => s.upsertExerciseContextFromLog);
  const activePlan = useAppStore((s) => s.activePlan);

  const [log, setLog] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const wl = await loadWorkoutLog(workoutLogId);
      if (!wl) return;
      setLog(wl);
      for (const ex of wl.exercises) {
        await upsertFromLog(wl, ex);
      }
    })();
  }, [loadWorkoutLog, upsertFromLog, workoutLogId]);

  const doneCount = useMemo(() => {
    if (!log) return 0;
    let n = 0;
    for (const ex of log.exercises) {
      for (const s of ex.sets) if (s.isCompleted) n += 1;
    }
    return n;
  }, [log]);

  if (!log) {
    return (
      <Box p={16} style={{ flex: 1 }}>
        <Text w="700">Loading summary…</Text>
      </Box>
    );
  }

  return (
    <Box p={16} style={{ flex: 1 }}>
      <Text w="900" s={24} style={{ marginBottom: 6 }}>Workout saved</Text>
      <Text s={13} c="#9aa4b2" style={{ marginBottom: 14 }}>
        {log.programId} • Sets completed: {doneCount}
      </Text>

      <Box p={12} bg="#11161d" r={14} style={{ borderWidth: 1, borderColor: '#202a36', marginBottom: 12 }}>
        <Text w="700" style={{ marginBottom: 10 }}>What happens next</Text>
        <Text s={13} c="#9aa4b2">
          The app updated your exercise contexts (e1RM / typical load / RPE). The next workout suggestions will reflect what you actually did today.
        </Text>
      </Box>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title="Back to Today" onPress={() => navigation.navigate('Today')} />
        <Button title="Programs" variant="secondary" onPress={() => navigation.navigate('ProgramLibrary')} />
      </View>

      {activePlan ? (
        <Text s={12} c="#6b7280" style={{ marginTop: 12 }}>
          Additive context means switching programs won’t reset your progress—new programs start from your latest node.
        </Text>
      ) : null}
    </Box>
  );
}
