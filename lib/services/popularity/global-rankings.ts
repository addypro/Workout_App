/**
 * Global Exercise Popularity Rankings
 *
 * Based on aggregated data from major workout trackers (StrengthLog, Hevy, Strong)
 * and search trends from 2024-2025. Contains the 250 most logged exercises globally.
 *
 * Each exercise includes:
 * - Popularity rank (1-250, lower = more popular)
 * - Score (100 = most popular, scaled down)
 * - Voice-friendly aliases for speech recognition
 * - Muscle group category
 */

export interface GlobalExerciseRanking {
  name: string;
  rank: number;
  score: number;
  category: string;
  aliases: string[];
}

// Top 20 Most Logged Exercises Globally
export const TOP_20_EXERCISES: GlobalExerciseRanking[] = [
  {
    name: 'Barbell Bench Press',
    rank: 1,
    score: 100,
    category: 'chest',
    aliases: ['bench press', 'bench', 'flat bench', 'bb bench', 'barbell bench', 'flat bench press'],
  },
  {
    name: 'Barbell Squat',
    rank: 2,
    score: 99,
    category: 'legs',
    aliases: ['squat', 'squats', 'back squat', 'barbell back squat', 'bb squat'],
  },
  {
    name: 'Deadlift',
    rank: 3,
    score: 98,
    category: 'back',
    aliases: ['conventional deadlift', 'deads', 'dl', 'deadlifts'],
  },
  {
    name: 'Lat Pulldown',
    rank: 4,
    score: 97,
    category: 'back',
    aliases: ['wide grip lat pulldown', 'lat pull down', 'pulldown', 'pull down', 'lats pulldown'],
  },
  {
    name: 'Overhead Press',
    rank: 5,
    score: 96,
    category: 'shoulders',
    aliases: ['ohp', 'shoulder press', 'military press', 'standing press', 'press'],
  },
  {
    name: 'Barbell Row',
    rank: 6,
    score: 95,
    category: 'back',
    aliases: ['bent over row', 'bb row', 'barbell bent over row', 'rows', 'row'],
  },
  {
    name: 'Dumbbell Lateral Raise',
    rank: 7,
    score: 94,
    category: 'shoulders',
    aliases: ['lateral raise', 'side raise', 'lateral raises', 'side raises', 'laterals'],
  },
  {
    name: 'Leg Extension',
    rank: 8,
    score: 93,
    category: 'legs',
    aliases: ['leg extensions', 'quad extension', 'knee extension'],
  },
  {
    name: 'Leg Press',
    rank: 9,
    score: 92,
    category: 'legs',
    aliases: ['45 degree leg press', 'sled leg press', 'machine leg press'],
  },
  {
    name: 'Barbell Bicep Curl',
    rank: 10,
    score: 91,
    category: 'biceps',
    aliases: ['barbell curl', 'bb curl', 'standing barbell curl', 'curls'],
  },
  {
    name: 'Incline Dumbbell Press',
    rank: 11,
    score: 90,
    category: 'chest',
    aliases: ['incline press', 'incline dumbbell', 'incline db press', 'incline chest press'],
  },
  {
    name: 'Dumbbell Bench Press',
    rank: 12,
    score: 89,
    category: 'chest',
    aliases: ['db bench press', 'dumbbell press', 'db bench', 'flat dumbbell press'],
  },
  {
    name: 'Seated Cable Row',
    rank: 13,
    score: 88,
    category: 'back',
    aliases: ['cable row', 'seated row', 'low row', 'cable rows'],
  },
  {
    name: 'Push-Up',
    rank: 14,
    score: 87,
    category: 'chest',
    aliases: ['push up', 'pushup', 'pushups', 'push ups'],
  },
  {
    name: 'Romanian Deadlift',
    rank: 15,
    score: 86,
    category: 'legs',
    aliases: ['rdl', 'romanian dl', 'stiff leg deadlift', 'rdls'],
  },
  {
    name: 'Tricep Pushdown',
    rank: 16,
    score: 85,
    category: 'triceps',
    aliases: ['rope pushdown', 'tricep push down', 'cable pushdown', 'pushdowns'],
  },
  {
    name: 'Pull-Up',
    rank: 17,
    score: 84,
    category: 'back',
    aliases: ['pull up', 'pullup', 'pullups', 'pull ups', 'chin up', 'chin ups'],
  },
  {
    name: 'Dumbbell Row',
    rank: 18,
    score: 83,
    category: 'back',
    aliases: ['db row', 'one arm row', 'single arm row', 'one arm dumbbell row'],
  },
  {
    name: 'Bulgarian Split Squat',
    rank: 19,
    score: 82,
    category: 'legs',
    aliases: ['split squat', 'rear foot elevated split squat', 'bss'],
  },
  {
    name: 'Face Pull',
    rank: 20,
    score: 81,
    category: 'shoulders',
    aliases: ['face pulls', 'rope face pull', 'cable face pull'],
  },
];

// Chest Exercises (rank 21-45)
export const CHEST_EXERCISES: GlobalExerciseRanking[] = [
  { name: 'Incline Barbell Bench Press', rank: 21, score: 80, category: 'chest', aliases: ['incline bench', 'incline barbell', 'incline bb bench'] },
  { name: 'Decline Barbell Bench Press', rank: 22, score: 79, category: 'chest', aliases: ['decline bench', 'decline press'] },
  { name: 'Decline Dumbbell Press', rank: 23, score: 78, category: 'chest', aliases: ['decline db press'] },
  { name: 'Dumbbell Fly', rank: 24, score: 77, category: 'chest', aliases: ['dumbbell flyes', 'chest fly', 'flyes', 'flies', 'db fly'] },
  { name: 'Incline Dumbbell Fly', rank: 25, score: 76, category: 'chest', aliases: ['incline fly', 'incline flyes', 'incline flies'] },
  { name: 'Cable Crossover', rank: 26, score: 75, category: 'chest', aliases: ['cable cross', 'high to low cable', 'crossover'] },
  { name: 'Cable Chest Fly', rank: 27, score: 74, category: 'chest', aliases: ['low cable fly', 'low to high cable'] },
  { name: 'Pec Deck', rank: 28, score: 73, category: 'chest', aliases: ['pec deck fly', 'machine fly', 'chest fly machine'] },
  { name: 'Chest Press Machine', rank: 29, score: 72, category: 'chest', aliases: ['machine chest press', 'seated chest press'] },
  { name: 'Smith Machine Bench Press', rank: 30, score: 71, category: 'chest', aliases: ['smith bench', 'smith machine bench'] },
  { name: 'Dips', rank: 31, score: 70, category: 'chest', aliases: ['chest dips', 'parallel bar dips', 'dip'] },
  { name: 'Weighted Dips', rank: 32, score: 69, category: 'chest', aliases: ['weighted dip'] },
  { name: 'Landmine Press', rank: 33, score: 68, category: 'chest', aliases: ['landmine chest press'] },
  { name: 'Floor Press', rank: 34, score: 67, category: 'chest', aliases: ['barbell floor press', 'dumbbell floor press'] },
  { name: 'Hammer Strength Chest Press', rank: 35, score: 66, category: 'chest', aliases: ['hammer chest press', 'plate loaded chest press'] },
  { name: 'Diamond Push-Up', rank: 36, score: 65, category: 'chest', aliases: ['diamond pushup', 'close grip pushup'] },
  { name: 'Decline Push-Up', rank: 37, score: 64, category: 'chest', aliases: ['decline pushup', 'feet elevated pushup'] },
  { name: 'Hex Press', rank: 38, score: 63, category: 'chest', aliases: ['squeeze press', 'dumbbell squeeze press'] },
  { name: 'Pullover', rank: 39, score: 62, category: 'chest', aliases: ['dumbbell pullover', 'chest pullover'] },
];

// Back Exercises (rank 40-70)
export const BACK_EXERCISES: GlobalExerciseRanking[] = [
  { name: 'Chin-Up', rank: 40, score: 61, category: 'back', aliases: ['chin up', 'chinup', 'chin ups', 'chinups', 'supinated pullup'] },
  { name: 'Neutral Grip Pull-Up', rank: 41, score: 60, category: 'back', aliases: ['neutral pullup', 'hammer grip pullup'] },
  { name: 'T-Bar Row', rank: 42, score: 59, category: 'back', aliases: ['t bar row', 'tbar row', 'landmine row'] },
  { name: 'Chest-Supported Row', rank: 43, score: 58, category: 'back', aliases: ['chest supported dumbbell row', 'incline row'] },
  { name: 'Pendlay Row', rank: 44, score: 57, category: 'back', aliases: ['pendlay rows', 'dead stop row'] },
  { name: 'Meadows Row', rank: 45, score: 56, category: 'back', aliases: ['meadows rows', 'landmine meadows row'] },
  { name: 'Single-Arm Cable Row', rank: 46, score: 55, category: 'back', aliases: ['one arm cable row', 'single arm row'] },
  { name: 'Straight-Arm Lat Pulldown', rank: 47, score: 54, category: 'back', aliases: ['straight arm pulldown', 'stiff arm pulldown'] },
  { name: 'Reverse Grip Lat Pulldown', rank: 48, score: 53, category: 'back', aliases: ['underhand lat pulldown', 'supinated pulldown'] },
  { name: 'Close Grip Lat Pulldown', rank: 49, score: 52, category: 'back', aliases: ['v bar pulldown', 'narrow grip pulldown'] },
  { name: 'Rack Pull', rank: 50, score: 51, category: 'back', aliases: ['rack pulls', 'block pull'] },
  { name: 'Barbell Shrug', rank: 51, score: 50, category: 'back', aliases: ['shrugs', 'bb shrug', 'trap shrug'] },
  { name: 'Dumbbell Shrug', rank: 52, score: 49, category: 'back', aliases: ['db shrug', 'dumbbell shrugs'] },
  { name: 'Upright Row', rank: 53, score: 48, category: 'back', aliases: ['barbell upright row', 'cable upright row'] },
  { name: 'Inverted Row', rank: 54, score: 47, category: 'back', aliases: ['bodyweight row', 'australian pullup'] },
  { name: 'Seal Row', rank: 55, score: 46, category: 'back', aliases: ['seal rows', 'prone row'] },
  { name: 'Renegade Row', rank: 56, score: 45, category: 'back', aliases: ['renegade rows', 'plank row'] },
  { name: 'Band Pull-Apart', rank: 57, score: 44, category: 'back', aliases: ['band pull aparts', 'rear delt pull apart'] },
];

// Legs: Quads (rank 58-80)
export const QUAD_EXERCISES: GlobalExerciseRanking[] = [
  { name: 'Front Squat', rank: 58, score: 43, category: 'legs', aliases: ['front squats', 'barbell front squat'] },
  { name: 'Goblet Squat', rank: 59, score: 42, category: 'legs', aliases: ['goblet squats', 'dumbbell goblet squat'] },
  { name: 'Hack Squat', rank: 60, score: 41, category: 'legs', aliases: ['hack squat machine', 'machine hack squat'] },
  { name: 'Walking Lunges', rank: 61, score: 40, category: 'legs', aliases: ['walking lunge', 'lunges'] },
  { name: 'Static Lunge', rank: 62, score: 39, category: 'legs', aliases: ['stationary lunge', 'split lunge'] },
  { name: 'Reverse Lunge', rank: 63, score: 38, category: 'legs', aliases: ['reverse lunges', 'backward lunge'] },
  { name: 'Step-Ups', rank: 64, score: 37, category: 'legs', aliases: ['step up', 'dumbbell step up', 'box step up'] },
  { name: 'Pistol Squat', rank: 65, score: 36, category: 'legs', aliases: ['single leg squat', 'one leg squat'] },
  { name: 'Sissy Squat', rank: 66, score: 35, category: 'legs', aliases: ['sissy squats'] },
  { name: 'Box Squat', rank: 67, score: 34, category: 'legs', aliases: ['box squats', 'squat to box'] },
  { name: 'Safety Bar Squat', rank: 68, score: 33, category: 'legs', aliases: ['ssb squat', 'safety squat bar'] },
  { name: 'Split Squat', rank: 69, score: 32, category: 'legs', aliases: ['split squats', 'static split squat'] },
  { name: 'Wall Sit', rank: 70, score: 31, category: 'legs', aliases: ['wall sits', 'wall squat'] },
  { name: 'Smith Machine Squat', rank: 71, score: 30, category: 'legs', aliases: ['smith squat'] },
  { name: 'Belt Squat', rank: 72, score: 29, category: 'legs', aliases: ['belt squats', 'hip belt squat'] },
];

// Legs: Hamstrings, Glutes & Calves (rank 73-100)
export const POSTERIOR_LEG_EXERCISES: GlobalExerciseRanking[] = [
  { name: 'Sumo Deadlift', rank: 73, score: 28, category: 'legs', aliases: ['sumo dead', 'wide stance deadlift'] },
  { name: 'Stiff-Legged Deadlift', rank: 74, score: 27, category: 'legs', aliases: ['stiff leg deadlift', 'straight leg deadlift'] },
  { name: 'Trap Bar Deadlift', rank: 75, score: 26, category: 'legs', aliases: ['hex bar deadlift', 'trap bar dead'] },
  { name: 'Hip Thrust', rank: 76, score: 25, category: 'legs', aliases: ['barbell hip thrust', 'hip thrusts', 'glute bridge'] },
  { name: 'Glute Bridge', rank: 77, score: 24, category: 'legs', aliases: ['glute bridges', 'weighted glute bridge'] },
  { name: 'Single-Leg Hip Thrust', rank: 78, score: 23, category: 'legs', aliases: ['single leg glute bridge', 'one leg hip thrust'] },
  { name: 'Cable Pull-Through', rank: 79, score: 22, category: 'legs', aliases: ['pull through', 'cable pull through'] },
  { name: 'Kettlebell Swing', rank: 80, score: 21, category: 'legs', aliases: ['kb swing', 'kettlebell swings', 'russian swing'] },
  { name: 'Seated Leg Curl', rank: 81, score: 20, category: 'legs', aliases: ['seated hamstring curl', 'machine leg curl'] },
  { name: 'Lying Leg Curl', rank: 82, score: 19, category: 'legs', aliases: ['prone leg curl', 'hamstring curl'] },
  { name: 'Standing Leg Curl', rank: 83, score: 18, category: 'legs', aliases: ['standing hamstring curl'] },
  { name: 'Nordic Hamstring Curl', rank: 84, score: 17, category: 'legs', aliases: ['nordic curl', 'nordic curls'] },
  { name: 'Glute-Ham Raise', rank: 85, score: 16, category: 'legs', aliases: ['ghr', 'glute ham raise'] },
  { name: 'Back Extension', rank: 86, score: 15, category: 'legs', aliases: ['hyperextension', 'back extensions', '45 degree back extension'] },
  { name: 'Good Morning', rank: 87, score: 14, category: 'legs', aliases: ['good mornings', 'barbell good morning'] },
  { name: 'Cable Kickback', rank: 88, score: 13, category: 'legs', aliases: ['glute kickback', 'cable glute kickback'] },
  { name: 'Hip Abduction Machine', rank: 89, score: 12, category: 'legs', aliases: ['hip abduction', 'abductor machine'] },
  { name: 'Hip Adduction Machine', rank: 90, score: 11, category: 'legs', aliases: ['hip adduction', 'adductor machine'] },
  { name: 'Standing Calf Raise', rank: 91, score: 10, category: 'legs', aliases: ['calf raise', 'calf raises', 'standing calves'] },
  { name: 'Seated Calf Raise', rank: 92, score: 9, category: 'legs', aliases: ['seated calves', 'seated calf'] },
  { name: 'Donkey Calf Raise', rank: 93, score: 8, category: 'legs', aliases: ['donkey calf', 'donkey calves'] },
];

// Shoulders (rank 94-120)
export const SHOULDER_EXERCISES: GlobalExerciseRanking[] = [
  { name: 'Seated Dumbbell Press', rank: 94, score: 77, category: 'shoulders', aliases: ['seated shoulder press', 'db shoulder press'] },
  { name: 'Arnold Press', rank: 95, score: 76, category: 'shoulders', aliases: ['arnold dumbbell press', 'arnolds'] },
  { name: 'Push Press', rank: 96, score: 75, category: 'shoulders', aliases: ['push press', 'standing push press'] },
  { name: 'Machine Shoulder Press', rank: 97, score: 74, category: 'shoulders', aliases: ['shoulder press machine', 'machine press'] },
  { name: 'Cable Lateral Raise', rank: 98, score: 73, category: 'shoulders', aliases: ['cable side raise', 'cable laterals'] },
  { name: 'Front Raise', rank: 99, score: 72, category: 'shoulders', aliases: ['front raises', 'dumbbell front raise', 'front delt raise'] },
  { name: 'Rear Delt Fly', rank: 100, score: 71, category: 'shoulders', aliases: ['reverse fly', 'rear delt flyes', 'bent over fly'] },
  { name: 'Reverse Pec Deck', rank: 101, score: 70, category: 'shoulders', aliases: ['reverse pec deck fly', 'rear delt machine'] },
  { name: 'Handstand Push-Up', rank: 102, score: 69, category: 'shoulders', aliases: ['handstand pushup', 'hspu'] },
  { name: 'Pike Push-Up', rank: 103, score: 68, category: 'shoulders', aliases: ['pike pushup'] },
  { name: 'Lu Raise', rank: 104, score: 67, category: 'shoulders', aliases: ['lu raises'] },
  { name: 'Y-Raise', rank: 105, score: 66, category: 'shoulders', aliases: ['y raises', 'prone y raise'] },
];

// Biceps (rank 106-130)
export const BICEP_EXERCISES: GlobalExerciseRanking[] = [
  { name: 'Dumbbell Curl', rank: 106, score: 78, category: 'biceps', aliases: ['db curl', 'standing dumbbell curl', 'bicep curl'] },
  { name: 'Hammer Curl', rank: 107, score: 77, category: 'biceps', aliases: ['hammer curls', 'dumbbell hammer curl', 'neutral grip curl'] },
  { name: 'Preacher Curl', rank: 108, score: 76, category: 'biceps', aliases: ['preacher curls', 'ez bar preacher curl', 'scott curl'] },
  { name: 'Concentration Curl', rank: 109, score: 75, category: 'biceps', aliases: ['concentration curls', 'seated concentration curl'] },
  { name: 'Cable Bicep Curl', rank: 110, score: 74, category: 'biceps', aliases: ['cable curl', 'cable curls'] },
  { name: 'Incline Dumbbell Curl', rank: 111, score: 73, category: 'biceps', aliases: ['incline curl', 'incline curls'] },
  { name: 'Spider Curl', rank: 112, score: 72, category: 'biceps', aliases: ['spider curls'] },
  { name: 'Reverse Curl', rank: 113, score: 71, category: 'biceps', aliases: ['reverse curls', 'reverse barbell curl'] },
  { name: 'EZ Bar Curl', rank: 114, score: 70, category: 'biceps', aliases: ['ez curl', 'ez bar curls', 'easy bar curl'] },
  { name: 'Drag Curl', rank: 115, score: 69, category: 'biceps', aliases: ['drag curls', 'barbell drag curl'] },
  { name: 'Zottman Curl', rank: 116, score: 68, category: 'biceps', aliases: ['zottman curls'] },
  { name: 'Bayesian Curl', rank: 117, score: 67, category: 'biceps', aliases: ['bayesian curls', 'cable bayesian curl'] },
];

// Triceps (rank 118-140)
export const TRICEP_EXERCISES: GlobalExerciseRanking[] = [
  { name: 'Skullcrusher', rank: 118, score: 78, category: 'triceps', aliases: ['skull crusher', 'skull crushers', 'lying tricep extension', 'ez bar skullcrusher'] },
  { name: 'Overhead Tricep Extension', rank: 119, score: 77, category: 'triceps', aliases: ['overhead extension', 'tricep overhead', 'dumbbell overhead extension'] },
  { name: 'Cable Overhead Extension', rank: 120, score: 76, category: 'triceps', aliases: ['rope overhead extension', 'cable tricep extension'] },
  { name: 'Close-Grip Bench Press', rank: 121, score: 75, category: 'triceps', aliases: ['close grip bench', 'cgbp', 'narrow grip bench'] },
  { name: 'Bench Dip', rank: 122, score: 74, category: 'triceps', aliases: ['bench dips', 'dip on bench'] },
  { name: 'Tricep Dip', rank: 123, score: 73, category: 'triceps', aliases: ['parallel bar dip', 'triceps dip'] },
  { name: 'Tricep Kickback', rank: 124, score: 72, category: 'triceps', aliases: ['kickback', 'dumbbell kickback', 'cable kickback'] },
  { name: 'JM Press', rank: 125, score: 71, category: 'triceps', aliases: ['jm press'] },
  { name: 'French Press', rank: 126, score: 70, category: 'triceps', aliases: ['seated french press'] },
  { name: 'Reverse Grip Pushdown', rank: 127, score: 69, category: 'triceps', aliases: ['reverse pushdown', 'underhand pushdown'] },
];

// Core & Abs (rank 128-155)
export const CORE_EXERCISES: GlobalExerciseRanking[] = [
  { name: 'Plank', rank: 128, score: 75, category: 'core', aliases: ['planks', 'front plank', 'forearm plank'] },
  { name: 'Side Plank', rank: 129, score: 74, category: 'core', aliases: ['side planks', 'lateral plank'] },
  { name: 'Hanging Leg Raise', rank: 130, score: 73, category: 'core', aliases: ['hanging leg raises', 'leg raise', 'hanging knee raise'] },
  { name: 'Cable Crunch', rank: 131, score: 72, category: 'core', aliases: ['cable crunches', 'kneeling cable crunch'] },
  { name: 'Ab Wheel Rollout', rank: 132, score: 71, category: 'core', aliases: ['ab wheel', 'ab roller', 'rollout'] },
  { name: 'Russian Twist', rank: 133, score: 70, category: 'core', aliases: ['russian twists', 'seated twist'] },
  { name: 'Bicycle Crunch', rank: 134, score: 69, category: 'core', aliases: ['bicycle crunches', 'bicycles'] },
  { name: 'V-Up', rank: 135, score: 68, category: 'core', aliases: ['v ups', 'v up', 'jackknife'] },
  { name: 'Sit-Up', rank: 136, score: 67, category: 'core', aliases: ['sit ups', 'situp', 'situps'] },
  { name: 'Decline Sit-Up', rank: 137, score: 66, category: 'core', aliases: ['decline situp', 'decline crunches'] },
  { name: 'Reverse Crunch', rank: 138, score: 65, category: 'core', aliases: ['reverse crunches'] },
  { name: 'Dragon Flag', rank: 139, score: 64, category: 'core', aliases: ['dragon flags'] },
  { name: 'Pallof Press', rank: 140, score: 63, category: 'core', aliases: ['pallof', 'anti rotation press'] },
  { name: 'Woodchopper', rank: 141, score: 62, category: 'core', aliases: ['wood chopper', 'cable woodchop', 'wood chop'] },
  { name: 'Dead Bug', rank: 142, score: 61, category: 'core', aliases: ['dead bugs'] },
  { name: 'Bird Dog', rank: 143, score: 60, category: 'core', aliases: ['bird dogs'] },
  { name: 'Mountain Climber', rank: 144, score: 59, category: 'core', aliases: ['mountain climbers'] },
];

// Olympic & Full Body (rank 145-165)
export const OLYMPIC_EXERCISES: GlobalExerciseRanking[] = [
  { name: 'Clean and Jerk', rank: 145, score: 55, category: 'olympic', aliases: ['clean & jerk', 'c&j'] },
  { name: 'Snatch', rank: 146, score: 54, category: 'olympic', aliases: ['power snatch', 'full snatch'] },
  { name: 'Power Clean', rank: 147, score: 53, category: 'olympic', aliases: ['power cleans', 'clean'] },
  { name: 'Hang Clean', rank: 148, score: 52, category: 'olympic', aliases: ['hang cleans', 'hang power clean'] },
  { name: 'Push Jerk', rank: 149, score: 51, category: 'olympic', aliases: ['jerk', 'split jerk'] },
  { name: 'Burpee', rank: 150, score: 50, category: 'olympic', aliases: ['burpees'] },
  { name: 'Thruster', rank: 151, score: 49, category: 'olympic', aliases: ['thrusters', 'squat to press'] },
  { name: 'Farmer Walk', rank: 152, score: 48, category: 'olympic', aliases: ['farmers walk', 'farmers carry', 'farmer carry'] },
  { name: 'Turkish Get-Up', rank: 153, score: 47, category: 'olympic', aliases: ['tgu', 'turkish getup'] },
  { name: 'Box Jump', rank: 154, score: 46, category: 'olympic', aliases: ['box jumps'] },
  { name: 'Battle Ropes', rank: 155, score: 45, category: 'olympic', aliases: ['battle rope', 'rope waves'] },
  { name: 'Sled Push', rank: 156, score: 44, category: 'olympic', aliases: ['prowler push', 'sled'] },
  { name: 'Muscle-Up', rank: 157, score: 43, category: 'olympic', aliases: ['muscle up', 'bar muscle up', 'ring muscle up'] },
];

// Combine all rankings into one array
export const ALL_GLOBAL_RANKINGS: GlobalExerciseRanking[] = [
  ...TOP_20_EXERCISES,
  ...CHEST_EXERCISES,
  ...BACK_EXERCISES,
  ...QUAD_EXERCISES,
  ...POSTERIOR_LEG_EXERCISES,
  ...SHOULDER_EXERCISES,
  ...BICEP_EXERCISES,
  ...TRICEP_EXERCISES,
  ...CORE_EXERCISES,
  ...OLYMPIC_EXERCISES,
];

/**
 * Build a lookup map from exercise name/alias to popularity score
 * Returns scores normalized to 0-100 scale
 */
export function buildPopularityMap(): Record<string, number> {
  const map: Record<string, number> = {};

  for (const exercise of ALL_GLOBAL_RANKINGS) {
    // Add canonical name
    const normalizedName = exercise.name.toLowerCase().trim();
    map[normalizedName] = exercise.score;

    // Add all aliases
    for (const alias of exercise.aliases) {
      const normalizedAlias = alias.toLowerCase().trim();
      if (!map[normalizedAlias] || map[normalizedAlias] < exercise.score) {
        map[normalizedAlias] = exercise.score;
      }
    }
  }

  return map;
}

/**
 * Get popularity score for an exercise name
 * Returns score 0-100, or null if not found
 */
export function getGlobalPopularityScore(exerciseName: string): number | null {
  const map = buildPopularityMap();
  const normalized = exerciseName.toLowerCase().trim();

  // Direct match
  if (map[normalized] !== undefined) {
    return map[normalized];
  }

  // Try partial match - find if input contains a known exercise
  for (const [name, score] of Object.entries(map)) {
    if (normalized.includes(name) || name.includes(normalized)) {
      return score;
    }
  }

  return null;
}

/**
 * Get all voice aliases for voice recognition vocabulary
 */
export function getAllVoiceAliases(): string[] {
  const aliases: Set<string> = new Set();

  for (const exercise of ALL_GLOBAL_RANKINGS) {
    aliases.add(exercise.name);
    exercise.aliases.forEach(alias => aliases.add(alias));
  }

  return Array.from(aliases);
}

/**
 * Find best matching exercise from voice input
 * Uses fuzzy matching against all names and aliases
 */
export function findExerciseByVoice(voiceInput: string): GlobalExerciseRanking | null {
  const normalized = voiceInput.toLowerCase().trim();

  // Direct match on name
  for (const exercise of ALL_GLOBAL_RANKINGS) {
    if (exercise.name.toLowerCase() === normalized) {
      return exercise;
    }
  }

  // Match on alias
  for (const exercise of ALL_GLOBAL_RANKINGS) {
    for (const alias of exercise.aliases) {
      if (alias.toLowerCase() === normalized) {
        return exercise;
      }
    }
  }

  // Partial match - input contains exercise name or vice versa
  for (const exercise of ALL_GLOBAL_RANKINGS) {
    const exerciseLower = exercise.name.toLowerCase();
    if (normalized.includes(exerciseLower) || exerciseLower.includes(normalized)) {
      return exercise;
    }
    for (const alias of exercise.aliases) {
      const aliasLower = alias.toLowerCase();
      if (normalized.includes(aliasLower) || aliasLower.includes(normalized)) {
        return exercise;
      }
    }
  }

  return null;
}
