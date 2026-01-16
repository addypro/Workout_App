/**
 * Preferences Context
 *
 * User preferences for app behavior, including weight units and home gym.
 * Persisted via AsyncStorage and synced to Supabase for gym membership.
 */

import { joinGym, leaveCurrentGym } from '@/lib/services/gym/gym-membership-service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const WEIGHT_UNIT_KEY = '@weight_unit';
const HOME_GYM_KEY = '@home_gym';

export type WeightUnit = 'kg' | 'lbs';

export interface GymInfo {
  id: string;           // Unique ID (OSM ID or custom UUID)
  name: string;         // Display name
  osmId?: string;       // OpenStreetMap ID for cross-user matching
  latitude?: number;    // GPS latitude
  longitude?: number;   // GPS longitude
  address?: string;     // Optional address
}

interface PreferencesContextType {
  weightUnit: WeightUnit;
  setWeightUnit: (unit: WeightUnit) => void;
  // Gym preferences
  homeGym: GymInfo | null;
  setHomeGym: (gym: GymInfo | null) => void;
  // Conversion helpers
  formatWeight: (kg: number) => string;
  parseWeight: (value: number) => number;
  convertToKg: (value: number) => number;
  convertFromKg: (kg: number) => number;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

// Conversion constants
const LBS_PER_KG = 2.20462;

interface PreferencesProviderProps {
  children: React.ReactNode;
}

export function PreferencesProvider({ children }: PreferencesProviderProps) {
  const [weightUnit, setWeightUnitState] = useState<WeightUnit>('lbs');
  const [homeGym, setHomeGymState] = useState<GymInfo | null>(null);

  useEffect(() => {
    // Load saved preferences
    AsyncStorage.getItem(WEIGHT_UNIT_KEY).then((saved) => {
      if (saved === 'kg' || saved === 'lbs') {
        setWeightUnitState(saved);
      }
    });
    AsyncStorage.getItem(HOME_GYM_KEY).then((saved) => {
      if (saved) {
        try {
          setHomeGymState(JSON.parse(saved));
        } catch (e) {
          console.warn('Failed to parse saved gym:', e);
        }
      }
    });
  }, []);

  const setWeightUnit = useCallback((unit: WeightUnit) => {
    setWeightUnitState(unit);
    AsyncStorage.setItem(WEIGHT_UNIT_KEY, unit);
  }, []);

  const setHomeGym = useCallback(async (gym: GymInfo | null) => {
    setHomeGymState(gym);
    if (gym) {
      AsyncStorage.setItem(HOME_GYM_KEY, JSON.stringify(gym));
      // Sync to Supabase - create gym record and membership
      // This runs in background, doesn't block UI
      joinGym(gym).catch((err) => {
        console.warn('[Preferences] Failed to sync gym to Supabase:', err);
      });
    } else {
      AsyncStorage.removeItem(HOME_GYM_KEY);
      // Leave current gym in Supabase
      leaveCurrentGym().catch((err) => {
        console.warn('[Preferences] Failed to leave gym in Supabase:', err);
      });
    }
  }, []);

  /**
   * Convert weight from kg to the user's preferred unit
   */
  const convertFromKg = useCallback((kg: number): number => {
    if (weightUnit === 'lbs') {
      return kg * LBS_PER_KG;
    }
    return kg;
  }, [weightUnit]);

  /**
   * Convert weight from the user's preferred unit to kg (for storage)
   */
  const convertToKg = useCallback((value: number): number => {
    if (weightUnit === 'lbs') {
      return value / LBS_PER_KG;
    }
    return value;
  }, [weightUnit]);

  /**
   * Format a weight value (stored in kg) for display in the user's preferred unit
   */
  const formatWeight = useCallback((kg: number): string => {
    const converted = convertFromKg(kg);
    // Round to 1 decimal place for cleaner display
    const rounded = Math.round(converted * 10) / 10;
    // Remove trailing .0 for whole numbers
    const display = rounded % 1 === 0 ? Math.round(rounded) : rounded;
    return `${display} ${weightUnit}`;
  }, [convertFromKg, weightUnit]);

  /**
   * Parse a user-entered weight value to kg for storage
   */
  const parseWeight = useCallback((value: number): number => {
    return convertToKg(value);
  }, [convertToKg]);

  const value: PreferencesContextType = {
    weightUnit,
    setWeightUnit,
    homeGym,
    setHomeGym,
    formatWeight,
    parseWeight,
    convertToKg,
    convertFromKg,
  };

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (context === undefined) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}

/**
 * Standalone weight conversion utilities (for use outside React components)
 */
export const WeightUtils = {
  kgToLbs: (kg: number): number => kg * LBS_PER_KG,
  lbsToKg: (lbs: number): number => lbs / LBS_PER_KG,
  format: (value: number, unit: WeightUnit): string => {
    const rounded = Math.round(value * 10) / 10;
    const display = rounded % 1 === 0 ? Math.round(rounded) : rounded;
    return `${display} ${unit}`;
  },
};
