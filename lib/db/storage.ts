// Storage utilities using AsyncStorage for React Native
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROGRAMS_KEY = '@workout_programs';

export interface Program {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  sourceFileUri: string;
  sourceType: 'CSV' | 'PDF' | 'EXCEL' | 'IMAGE';
  status: 'PARSING' | 'MAPPING' | 'READY' | 'ERROR';
  parsedData: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getPrograms(): Promise<Program[]> {
  try {
    const data = await AsyncStorage.getItem(PROGRAMS_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading programs:', error);
    return [];
  }
}

export async function saveProgram(program: Omit<Program, 'id' | 'createdAt' | 'updatedAt'>): Promise<Program> {
  try {
    const programs = await getPrograms();
    const newProgram: Program = {
      ...program,
      id: `prog-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    programs.push(newProgram);
    await AsyncStorage.setItem(PROGRAMS_KEY, JSON.stringify(programs));
    return newProgram;
  } catch (error) {
    console.error('Error saving program:', error);
    throw error;
  }
}

export async function updateProgram(id: string, updates: Partial<Program>): Promise<Program | null> {
  try {
    const programs = await getPrograms();
    const index = programs.findIndex(p => p.id === id);
    if (index === -1) return null;

    programs[index] = {
      ...programs[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(PROGRAMS_KEY, JSON.stringify(programs));
    return programs[index];
  } catch (error) {
    console.error('Error updating program:', error);
    throw error;
  }
}

export async function deleteProgram(id: string): Promise<boolean> {
  try {
    const programs = await getPrograms();
    const filtered = programs.filter(p => p.id !== id);
    await AsyncStorage.setItem(PROGRAMS_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error deleting program:', error);
    return false;
  }
}
