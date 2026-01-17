import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initDb } from './src/db/db';
import { useAppStore } from './src/store/useAppStore';

import { ProgramLibraryScreen } from './src/screens/ProgramLibraryScreen';
import { ProgramSetupScreen } from './src/screens/ProgramSetupScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { WorkoutSessionScreen } from './src/screens/WorkoutSessionScreen';
import { WorkoutSummaryScreen } from './src/screens/WorkoutSummaryScreen';
import { ExerciseDetailScreen } from './src/screens/ExerciseDetailScreen';

export type RootStackParamList = {
  ProgramLibrary: undefined;
  ProgramSetup: { programId: string };
  Today: undefined;
  WorkoutSession: { planId: string; workoutId: string };
  WorkoutSummary: { workoutLogId: string };
  ExerciseDetail: { canonicalName: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const bootstrap = useAppStore((s) => s.bootstrap);

  useEffect(() => {
    (async () => {
      await initDb();
      await bootstrap();
    })();
  }, [bootstrap]);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="ProgramLibrary"
          screenOptions={{
            headerStyle: { backgroundColor: '#0b0c10' },
            headerTintColor: '#fff',
            contentStyle: { backgroundColor: '#0b0c10' },
          }}
        >
          <Stack.Screen name="ProgramLibrary" component={ProgramLibraryScreen} options={{ title: 'Programs' }} />
          <Stack.Screen name="ProgramSetup" component={ProgramSetupScreen} options={{ title: 'Setup' }} />
          <Stack.Screen name="Today" component={TodayScreen} options={{ title: 'Today' }} />
          <Stack.Screen name="WorkoutSession" component={WorkoutSessionScreen} options={{ title: 'Workout' }} />
          <Stack.Screen name="WorkoutSummary" component={WorkoutSummaryScreen} options={{ title: 'Summary' }} />
          <Stack.Screen name="ExerciseDetail" component={ExerciseDetailScreen} options={{ title: 'Exercise' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
