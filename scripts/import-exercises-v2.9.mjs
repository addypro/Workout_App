import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';

const ROOT = process.cwd();
const INPUT = path.join(ROOT, 'Functional+Fitness+Exercise+Database+(version+2.9).xlsx');
const OUTPUT = path.join(ROOT, 'data', 'exercises-v2.9.json');

const wb = XLSX.readFile(INPUT, { cellDates: true });
const ws = wb.Sheets['Exercises'];
if (!ws) {
  throw new Error('Sheet "Exercises" not found. Sheets: ' + wb.SheetNames.join(', '));
}

// We detected the header on row 12 (1-based) during inspection.
const HEADER_ROW_1BASED = 12;

// Pull the sheet as a dense 2D array
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false });
const headerRow = rows[HEADER_ROW_1BASED - 1];
if (!Array.isArray(headerRow) || !String(headerRow[0] || '').toLowerCase().includes('exercise')) {
  throw new Error('Unexpected header row at ' + HEADER_ROW_1BASED);
}

const headers = headerRow.map((h) => String(h || '').trim());
const colIndex = (name) => headers.findIndex((h) => h.trim().toLowerCase() === name.trim().toLowerCase());

const COL = {
  exercise: colIndex('Exercise'),
  difficulty: colIndex('Difficulty Level'),
  targetGroup: colIndex('Target Muscle Group'),
  primeMover: colIndex('Prime Mover Muscle'),
  secondaryMuscle: colIndex('Secondary Muscle'),
  tertiaryMuscle: colIndex('Tertiary Muscle'),
  primaryEquipment: colIndex('Primary Equipment'),
  secondaryEquipment: colIndex('Secondary Equipment'),
  bodyRegion: colIndex('Body Region'),
  classification: colIndex('Primary Exercise Classification'),
  shortDemo: colIndex('Short YouTube Demonstration'),
  deepExplain: colIndex('In-Depth YouTube Explanation'),
  move1: colIndex('Movement Pattern #1'),
  move2: colIndex('Movement Pattern #2'),
  move3: colIndex('Movement Pattern #3'),
  plane1: colIndex('Plane Of Motion #1'),
  plane2: colIndex('Plane Of Motion #2'),
  plane3: colIndex('Plane Of Motion #3'),
};

const missing = Object.entries(COL).filter(([, v]) => v === -1).map(([k]) => k);
if (missing.length) {
  throw new Error('Missing expected columns: ' + missing.join(', '));
}

function normStr(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (s.toLowerCase() === 'none') return null;
  return s;
}

function uniq(arr) {
  const out = [];
  const seen = new Set();
  for (const v of arr) {
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

const dataRows = rows
  .slice(HEADER_ROW_1BASED)
  .filter((r) => Array.isArray(r) && normStr(r[COL.exercise]));

const exercises = dataRows.map((r, i) => {
  const name = normStr(r[COL.exercise]);
  const primaryEq = normStr(r[COL.primaryEquipment]);
  const secondaryEq = normStr(r[COL.secondaryEquipment]);

  const equipment = uniq([primaryEq, secondaryEq]);

  // Categories: prefer classification, fallback to body region
  const category = normStr(r[COL.classification]) ?? normStr(r[COL.bodyRegion]);

  // Many cells in this file are placeholders like "Video Demonstration".
  // If the cell is a URL string, keep it; otherwise omit.
  const shortDemo = normStr(r[COL.shortDemo]);
  const deepExplain = normStr(r[COL.deepExplain]);
  const videoUrl =
    (shortDemo && /^https?:\/\//i.test(shortDemo) ? shortDemo : null) ??
    (deepExplain && /^https?:\/\//i.test(deepExplain) ? deepExplain : null) ??
    undefined;

  const movementPatterns = uniq([normStr(r[COL.move1]), normStr(r[COL.move2]), normStr(r[COL.move3])]);
  const planesOfMotion = uniq([normStr(r[COL.plane1]), normStr(r[COL.plane2]), normStr(r[COL.plane3])]);

  return {
    // IDs are added in the app service to keep this file stable.
    name,
    aliases: [],
    category,
    equipment,
    difficulty: normStr(r[COL.difficulty]),
    muscles: {
      targetGroup: normStr(r[COL.targetGroup]),
      primeMover: normStr(r[COL.primeMover]),
      secondary: normStr(r[COL.secondaryMuscle]),
      tertiary: normStr(r[COL.tertiaryMuscle]),
    },
    movementPatterns,
    planesOfMotion,
    videoUrl,
  };
});

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(exercises, null, 2) + '\n', 'utf8');

console.log('WROTE', OUTPUT);
console.log('EXERCISES', exercises.length);


