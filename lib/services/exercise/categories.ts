/**
 * Exercise Categorization & Hierarchy System
 * Implements the 3-Pathway Navigation based on expert analysis
 */

// ============================================
// BODY REGIONS (Primary Filter - Cuts list by 70%)
// ============================================
export const BODY_REGIONS = {
  UPPER: {
    id: 'upper',
    name: 'Upper Body',
    icon: 'figure.arms.open',
    color: '#0A84FF',
    muscleGroups: ['Shoulders', 'Chest', 'Back', 'Biceps', 'Triceps', 'Forearms', 'Traps', 'Lats'],
  },
  LOWER: {
    id: 'lower',
    name: 'Lower Body',
    icon: 'figure.walk',
    color: '#30D158',
    muscleGroups: ['Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Hip Flexors', 'Adductors', 'Abductors'],
  },
  CORE: {
    id: 'core',
    name: 'Core',
    icon: 'figure.core.training',
    color: '#FF9F0A',
    muscleGroups: ['Abdominals', 'Obliques', 'Lower Back', 'Erector Spinae'],
  },
  FULL: {
    id: 'full',
    name: 'Full Body',
    icon: 'figure.mixed.cardio',
    color: '#BF5AF2',
    muscleGroups: ['Full Body', 'Multiple'],
  },
} as const;

// ============================================
// EQUIPMENT CATEGORIES (Pathway A: Home Gym Hero)
// ============================================
export const EQUIPMENT_CATEGORIES = {
  BODYWEIGHT: {
    id: 'bodyweight',
    name: 'Bodyweight',
    icon: 'figure.stand',
    color: '#30D158',
    items: ['Bodyweight', 'No Equipment'],
  },
  DUMBBELLS: {
    id: 'dumbbells',
    name: 'Dumbbells',
    icon: 'dumbbell',
    color: '#0A84FF',
    items: ['Dumbbell', 'Dumbbells'],
  },
  BARBELL: {
    id: 'barbell',
    name: 'Barbell',
    icon: 'figure.strengthtraining.traditional',
    color: '#FF453A',
    items: ['Barbell', 'Olympic Barbell', 'EZ Bar', 'Trap Bar'],
  },
  KETTLEBELL: {
    id: 'kettlebell',
    name: 'Kettlebell',
    icon: 'scalemass',
    color: '#FF9F0A',
    items: ['Kettlebell', 'Kettlebells'],
  },
  CABLES: {
    id: 'cables',
    name: 'Cables & Machines',
    icon: 'gearshape',
    color: '#64D2FF',
    items: ['Cable', 'Cable Machine', 'Machine', 'Smith Machine', 'Pulley'],
  },
  BANDS: {
    id: 'bands',
    name: 'Resistance Bands',
    icon: 'wind',
    color: '#BF5AF2',
    items: ['Resistance Band', 'Band', 'Mini Band', 'Loop Band', 'Superband'],
  },
  STABILITY: {
    id: 'stability',
    name: 'Stability Tools',
    icon: 'circle.dashed',
    color: '#FF6482',
    items: ['Stability Ball', 'Swiss Ball', 'BOSU', 'Balance Board', 'Foam Roller'],
  },
  FUNCTIONAL: {
    id: 'functional',
    name: 'Functional Tools',
    icon: 'hammer',
    color: '#8E8E93',
    items: ['Medicine Ball', 'Slam Ball', 'Sandbag', 'Clubbell', 'Macebell', 'Steel Mace', 'Battle Ropes', 'Sledgehammer', 'Tire'],
  },
  CARDIO: {
    id: 'cardio',
    name: 'Cardio Equipment',
    icon: 'heart',
    color: '#FF453A',
    items: ['Treadmill', 'Bike', 'Rower', 'Ski Erg', 'Jump Rope', 'Box'],
  },
  OTHER: {
    id: 'other',
    name: 'Other Equipment',
    icon: 'ellipsis.circle',
    color: '#8E8E93',
    items: ['Bench', 'Pull-up Bar', 'Dip Station', 'TRX', 'Suspension Trainer', 'Rings', 'Parallettes'],
  },
} as const;

// ============================================
// MOVEMENT PATTERNS (Pathway B: Program Designer)
// ============================================
export const MOVEMENT_PATTERNS = {
  PUSH: {
    id: 'push',
    name: 'Push',
    icon: 'arrow.right.circle.fill',
    color: '#0A84FF',
    patterns: ['Horizontal Push', 'Vertical Push', 'Push', 'Press'],
    description: 'Pressing movements away from body',
  },
  PULL: {
    id: 'pull',
    name: 'Pull',
    icon: 'arrow.left.circle.fill',
    color: '#30D158',
    patterns: ['Horizontal Pull', 'Vertical Pull', 'Pull', 'Row'],
    description: 'Pulling movements toward body',
  },
  SQUAT: {
    id: 'squat',
    name: 'Squat',
    icon: 'arrow.down.circle.fill',
    color: '#FF9F0A',
    patterns: ['Knee Dominant', 'Squat', 'Lunge'],
    description: 'Knee-dominant lower body',
  },
  HINGE: {
    id: 'hinge',
    name: 'Hinge',
    icon: 'arrow.uturn.down.circle.fill',
    color: '#FF453A',
    patterns: ['Hip Hinge', 'Hip Dominant', 'Deadlift', 'Hip Extension'],
    description: 'Hip-dominant movements',
  },
  CARRY: {
    id: 'carry',
    name: 'Carry',
    icon: 'figure.walk.motion',
    color: '#BF5AF2',
    patterns: ['Loaded Carry', 'Carry', 'Walk'],
    description: 'Loaded walking movements',
  },
  ROTATION: {
    id: 'rotation',
    name: 'Rotation',
    icon: 'arrow.triangle.2.circlepath',
    color: '#64D2FF',
    patterns: ['Rotational', 'Anti-Rotational', 'Rotation', 'Twist'],
    description: 'Rotational & anti-rotation',
  },
  CORE: {
    id: 'core',
    name: 'Core Stability',
    icon: 'shield.fill',
    color: '#FF6482',
    patterns: ['Anti-Extension', 'Anti-Lateral Flexion', 'Flexion', 'Stability'],
    description: 'Core bracing & stability',
  },
} as const;

// ============================================
// MUSCLE GROUPS (Pathway C: Bodybuilder)
// ============================================
export const MUSCLE_GROUPS = {
  // Upper Body
  SHOULDERS: { id: 'shoulders', name: 'Shoulders', region: 'upper', icon: '💪', color: '#0A84FF' },
  CHEST: { id: 'chest', name: 'Chest', region: 'upper', icon: '🫁', color: '#FF453A' },
  BACK: { id: 'back', name: 'Back', region: 'upper', icon: '🔙', color: '#30D158' },
  LATS: { id: 'lats', name: 'Lats', region: 'upper', icon: '🦇', color: '#64D2FF' },
  TRAPS: { id: 'traps', name: 'Traps', region: 'upper', icon: '⬆️', color: '#BF5AF2' },
  BICEPS: { id: 'biceps', name: 'Biceps', region: 'upper', icon: '💪', color: '#FF9F0A' },
  TRICEPS: { id: 'triceps', name: 'Triceps', region: 'upper', icon: '🔱', color: '#FF6482' },
  FOREARMS: { id: 'forearms', name: 'Forearms', region: 'upper', icon: '✊', color: '#8E8E93' },
  // Lower Body
  QUADRICEPS: { id: 'quadriceps', name: 'Quadriceps', region: 'lower', icon: '🦵', color: '#30D158' },
  HAMSTRINGS: { id: 'hamstrings', name: 'Hamstrings', region: 'lower', icon: '🦿', color: '#FF9F0A' },
  GLUTES: { id: 'glutes', name: 'Glutes', region: 'lower', icon: '🍑', color: '#FF453A' },
  CALVES: { id: 'calves', name: 'Calves', region: 'lower', icon: '🦶', color: '#0A84FF' },
  HIPFLEXORS: { id: 'hipflexors', name: 'Hip Flexors', region: 'lower', icon: '🔄', color: '#BF5AF2' },
  // Core
  ABDOMINALS: { id: 'abdominals', name: 'Abdominals', region: 'core', icon: '🎯', color: '#FF9F0A' },
  OBLIQUES: { id: 'obliques', name: 'Obliques', region: 'core', icon: '↗️', color: '#64D2FF' },
  LOWERBACK: { id: 'lowerback', name: 'Lower Back', region: 'core', icon: '🔙', color: '#FF6482' },
} as const;

// ============================================
// DIFFICULTY LEVELS (Smart Sort)
// ============================================
export const DIFFICULTY_LEVELS = [
  { id: 'beginner', name: 'Beginner', level: 1, color: '#30D158', icon: '🌱' },
  { id: 'novice', name: 'Novice', level: 2, color: '#64D2FF', icon: '🌿' },
  { id: 'intermediate', name: 'Intermediate', level: 3, color: '#FF9F0A', icon: '🌳' },
  { id: 'advanced', name: 'Advanced', level: 4, color: '#FF453A', icon: '🔥' },
  { id: 'expert', name: 'Expert', level: 5, color: '#BF5AF2', icon: '⚡' },
  { id: 'legend', name: 'Legend', level: 6, color: '#FF6482', icon: '🏆' },
] as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get body region for a target muscle group
 */
export function getBodyRegionForMuscle(targetGroup: string | null | undefined): typeof BODY_REGIONS[keyof typeof BODY_REGIONS] | null {
  if (!targetGroup) return null;
  const normalized = targetGroup.toLowerCase();
  
  for (const region of Object.values(BODY_REGIONS)) {
    if (region.muscleGroups.some(m => normalized.includes(m.toLowerCase()))) {
      return region;
    }
  }
  return null;
}

/**
 * Get equipment category for an equipment item
 */
export function getEquipmentCategory(equipment: string): typeof EQUIPMENT_CATEGORIES[keyof typeof EQUIPMENT_CATEGORIES] | null {
  const normalized = equipment.toLowerCase();
  
  for (const category of Object.values(EQUIPMENT_CATEGORIES)) {
    if (category.items.some(item => normalized.includes(item.toLowerCase()) || item.toLowerCase().includes(normalized))) {
      return category;
    }
  }
  return EQUIPMENT_CATEGORIES.OTHER;
}

/**
 * Get movement pattern category
 */
export function getMovementCategory(patterns: string[]): typeof MOVEMENT_PATTERNS[keyof typeof MOVEMENT_PATTERNS] | null {
  if (!patterns || patterns.length === 0) return null;
  
  for (const pattern of patterns) {
    const normalized = pattern.toLowerCase();
    for (const category of Object.values(MOVEMENT_PATTERNS)) {
      if (category.patterns.some(p => normalized.includes(p.toLowerCase()))) {
        return category;
      }
    }
  }
  return null;
}

/**
 * Get difficulty level info
 */
export function getDifficultyLevel(difficulty: string | null | undefined): typeof DIFFICULTY_LEVELS[number] | null {
  if (!difficulty) return DIFFICULTY_LEVELS[2]; // Default to Intermediate
  const normalized = difficulty.toLowerCase();
  return DIFFICULTY_LEVELS.find(d => normalized.includes(d.id) || normalized.includes(d.name.toLowerCase())) || DIFFICULTY_LEVELS[2];
}

/**
 * Normalize category (fix "Unsorted*" etc.)
 */
export function normalizeCategory(category: string | undefined): string {
  if (!category || category.includes('Unsorted') || category === '*') {
    return 'General';
  }
  return category;
}

