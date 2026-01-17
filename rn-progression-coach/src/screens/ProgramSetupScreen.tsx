import React, { useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { View } from 'react-native';

import { RootStackParamList } from '../../App';
import { useAppStore } from '../store/useAppStore';
import { Box } from '../components/Box';
import { Text } from '../components/Text';
import { Button } from '../components/Button';
import { NumberStepper } from '../components/NumberStepper';
import { defaultPlanConfig } from '../domain/programs';
import { UnitSystem } from '../types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'ProgramSetup'>;

export function ProgramSetupScreen({ route, navigation }: Props) {
  const { programId } = route.params;
  const startProgram = useAppStore((s) => s.startProgram);

  const defaults = useMemo(() => defaultPlanConfig(programId), [programId]);

  const [unitSystem, setUnitSystem] = useState<UnitSystem>('lb');
  const [upperInc, setUpperInc] = useState(defaults.defaultUpperIncrement);
  const [lowerInc, setLowerInc] = useState(defaults.defaultLowerIncrement);

  const onStart = async () => {
    const plan = await startProgram(programId, unitSystem);
    // Patch increments if user changed them
    if (plan.defaultUpperIncrement !== upperInc || plan.defaultLowerIncrement !== lowerInc) {
      // simplest: update via store method
      await useAppStore.getState().setActivePlanWorkoutIndex(plan.planId, 0);
      // Update plan record
      await useAppStore.setState((s) => ({
        activePlan: s.activePlan ? { ...s.activePlan, defaultUpperIncrement: upperInc, defaultLowerIncrement: lowerInc } : s.activePlan,
      }));
    }
    navigation.reset({ index: 0, routes: [{ name: 'Today' }] });
  };

  return (
    <Box p={16} style={{ flex: 1 }}>
      <Text w="800" s={22} style={{ marginBottom: 8 }}>{programId}</Text>
      <Text s={13} c="#9aa4b2" style={{ marginBottom: 16 }}>
        Progression profile: {defaults.progressionProfile}
      </Text>

      <Box p={12} bg="#11161d" r={14} style={{ borderWidth: 1, borderColor: '#202a36', marginBottom: 12 }}>
        <Text w="700" style={{ marginBottom: 8 }}>Units</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="lb" variant={unitSystem === 'lb' ? 'primary' : 'secondary'} onPress={() => setUnitSystem('lb')} />
          <Button title="kg" variant={unitSystem === 'kg' ? 'primary' : 'secondary'} onPress={() => setUnitSystem('kg')} />
        </View>
      </Box>

      <Box p={12} bg="#11161d" r={14} style={{ borderWidth: 1, borderColor: '#202a36', marginBottom: 12 }}>
        <Text w="700" style={{ marginBottom: 8 }}>Default increments</Text>
        <Text s={13} c="#9aa4b2" style={{ marginBottom: 10 }}>
          These are used to round and suggest your next weights.
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text>Upper body</Text>
          <NumberStepper value={upperInc} onChange={setUpperInc} step={0.5} min={0.5} max={10} precision={1} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text>Lower body</Text>
          <NumberStepper value={lowerInc} onChange={setLowerInc} step={1} min={1} max={25} precision={0} />
        </View>
      </Box>

      <Button title="Start Program" onPress={onStart} />

      <Text s={12} c="#6b7280" style={{ marginTop: 12 }}>
        You’ll get suggested weights on the first workout based on your initial picks, then it adapts automatically.
      </Text>
    </Box>
  );
}
