import React from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../App';
import { useAppStore } from '../store/useAppStore';
import { Box } from '../components/Box';
import { Text } from '../components/Text';

type Props = NativeStackScreenProps<RootStackParamList, 'ProgramLibrary'>;

export function ProgramLibraryScreen({ navigation }: Props) {
  const programs = useAppStore((s) => s.programs);
  const activePlan = useAppStore((s) => s.activePlan);

  return (
    <Box p={16} style={{ flex: 1 }}>
      {activePlan ? (
        <Pressable onPress={() => navigation.navigate('Today')} style={{ marginBottom: 16 }}>
          <Box p={12} bg="#1f6feb" r={14}>
            <Text w="700">Resume: {activePlan.programId}</Text>
            <Text s={13} c="#dbeafe">Tap to continue</Text>
          </Box>
        </Pressable>
      ) : null}

      <Text w="700" s={20} style={{ marginBottom: 10 }}>All Programs</Text>

      <FlatList
        data={programs}
        keyExtractor={(i) => i.programId}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('ProgramSetup', { programId: item.programId })}>
            <Box p={12} bg="#11161d" r={14} style={{ marginBottom: 10, borderWidth: 1, borderColor: '#202a36' }}>
              <Text w="700">{item.kaggleName}</Text>
              <Text s={13} c="#9aa4b2">{item.programId} • {item.workoutCount} workouts</Text>
            </Box>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
      />

      <Text s={12} c="#6b7280" style={{ marginTop: 10 }}>
        Tip: weights are auto-suggested; you can override and it adapts next time.
      </Text>
    </Box>
  );
}
