import React, { useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlatList, View } from 'react-native';
import { RootStackParamList } from '../../App';

import { Box } from '../components/Box';
import { Text } from '../components/Text';
import { useAppStore } from '../store/useAppStore';
import { getRecentExerciseLogs } from '../db/queries';

type Props = NativeStackScreenProps<RootStackParamList, 'ExerciseDetail'>;

export function ExerciseDetailScreen({ route }: Props) {
  const { canonicalName } = route.params;
  const ctx = useAppStore((s) => s.exerciseContexts[canonicalName]);

  const [history, setHistory] = useState<{ workoutLogId: string; startedAt: string; sets: any[] }[]>([]);

  useEffect(() => {
    (async () => {
      const h = await getRecentExerciseLogs(canonicalName, 12);
      setHistory(h);
    })();
  }, [canonicalName]);

  return (
    <Box p={16} style={{ flex: 1 }}>
      <Text w="800" s={20} style={{ marginBottom: 6 }}>{canonicalName}</Text>

      <Box p={12} bg="#11161d" r={14} style={{ borderWidth: 1, borderColor: '#202a36', marginBottom: 12 }}>
        <Text w="700" style={{ marginBottom: 6 }}>Context</Text>
        <Text s={13} c="#9aa4b2">Kind: {ctx?.kind ?? 'unknown'}</Text>
        <Text s={13} c="#9aa4b2">Last working weight: {ctx?.lastWorkingWeight ?? '—'}</Text>
        <Text s={13} c="#9aa4b2">Estimated 1RM: {ctx?.est1rm ?? '—'}</Text>
        <Text s={13} c="#9aa4b2">Last avg RPE: {ctx?.lastAvgRpe ?? '—'}</Text>
        <Text s={13} c="#9aa4b2">Updated: {ctx?.updatedAt ?? '—'}</Text>
      </Box>

      <Text w="700" style={{ marginBottom: 8 }}>Recent sets</Text>

      <FlatList
        data={history}
        keyExtractor={(i) => i.workoutLogId}
        renderItem={({ item }) => (
          <Box p={12} bg="#0b0c10" r={14} style={{ borderWidth: 1, borderColor: '#1f2937', marginBottom: 10 }}>
            <Text w="700">{new Date(item.startedAt).toLocaleString()}</Text>
            <View style={{ marginTop: 8 }}>
              {item.sets.map((s, idx) => (
                <Text key={idx} s={12} c="#9aa4b2">
                  Set {s.setIndex + 1}: {s.actual_reps ?? s.actualReps ?? '—'} reps @ {s.actual_load ?? s.actualLoad ?? '—'} (RPE {s.rpe ?? '—'})
                </Text>
              ))}
            </View>
          </Box>
        )}
      />
    </Box>
  );
}
