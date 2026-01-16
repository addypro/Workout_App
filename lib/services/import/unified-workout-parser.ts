/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * unified_workout_parser.ts
 *
 * Robust, dependency-free CSV parser + import normalizer for:
 *   - Hevy "workouts export" CSV (one row per set)
 *   - Strong "workouts export" CSV (one row per set; optional Notes/Workout Notes/Rest Timer variants)
 *
 * Output: UnifiedWorkoutRecord[]
 *
 * Design goals:
 *  - Auto-detect export type from headers (user doesn't care which app exported it)
 *  - Never throw from top-level parse functions (returns diagnostics instead)
 *  - Preserve order, keep parsing even if a few rows are malformed
 *  - Stable workout IDs via SHA-1 of (completedAt + workoutName)
 */

export interface UnifiedWorkoutRecord {
    id: string;                    // Stable hash ID (from date + name)
    type: 'quick' | 'program';     // Always 'quick' for imports
    userId: string;
    workoutName: string;           // "Push Day", "Morning Workout"
    completedAt: string;           // ISO timestamp
    durationSeconds: number;
    exercises: UnifiedExercise[];
    notes?: string;
}

export interface UnifiedExercise {
    name: string;                  // Canonical exercise name
    setsCompleted: number;
    totalSets: number;
    bestSet: { reps: number; weight: number };
    sets: UnifiedSet[];
}

export interface UnifiedSet {
    reps: number;
    weight: number;
    isCompleted: boolean;
}

export type ExportType = 'hevy' | 'strong' | 'unknown';

export interface ParseDiagnostics {
    exportType: ExportType;
    warnings: string[];
    errors: string[];
}

export interface ParseResult {
    workouts: UnifiedWorkoutRecord[];
    diagnostics: ParseDiagnostics;
}

type Row = Record<string, string | null | undefined>;

// -------------------------------
// Public API
// -------------------------------

/**
 * Parse a single CSV string (Hevy or Strong) into UnifiedWorkoutRecord[].
 * This function NEVER throws. Errors are returned in diagnostics.
 */
export function parseUnifiedWorkoutsFromCsv(
    csvText: string,
    userId: string,
): ParseResult {
    const diagnostics: ParseDiagnostics = { exportType: 'unknown', warnings: [], errors: [] };

    try {
        const table = parseCsvToTable(csvText);
        if (table.headers.length === 0) {
            diagnostics.errors.push('CSV has no headers.');
            return { workouts: [], diagnostics };
        }

        const exportType = detectExportType(table.headers);
        diagnostics.exportType = exportType;

        if (exportType === 'hevy') {
            const workouts = parseHevyTableToUnified(table, userId, diagnostics);
            return { workouts, diagnostics };
        }

        if (exportType === 'strong') {
            const workouts = parseStrongTableToUnified(table, userId, diagnostics);
            return { workouts, diagnostics };
        }

        diagnostics.errors.push('Unable to detect export type (neither Hevy nor Strong).');
        return { workouts: [], diagnostics };
    } catch (err: any) {
        diagnostics.errors.push(`Fatal parse error: ${err?.message ?? String(err)}`);
        return { workouts: [], diagnostics };
    }
}

/**
 * Parse multiple CSV strings/files and merge results.
 * Deduplicates workouts by id (stable hash).
 */
export function parseUnifiedWorkoutsFromMultipleCsv(
    inputs: Array<{ name?: string; csvText: string }>,
    userId: string,
): ParseResult {
    const merged: UnifiedWorkoutRecord[] = [];
    const seen = new Set<string>();
    const diagnostics: ParseDiagnostics = { exportType: 'unknown', warnings: [], errors: [] };

    for (const inp of inputs) {
        const res = parseUnifiedWorkoutsFromCsv(inp.csvText, userId);
        diagnostics.warnings.push(...res.diagnostics.warnings.map(w => inp.name ? `[${inp.name}] ${w}` : w));
        diagnostics.errors.push(...res.diagnostics.errors.map(e => inp.name ? `[${inp.name}] ${e}` : e));

        // exportType is per-file; merged exportType can be "unknown" if mixed.
        if (diagnostics.exportType === 'unknown') diagnostics.exportType = res.diagnostics.exportType;
        else if (res.diagnostics.exportType !== 'unknown' && res.diagnostics.exportType !== diagnostics.exportType) {
            diagnostics.exportType = 'unknown';
        }

        for (const w of res.workouts) {
            if (!seen.has(w.id)) {
                seen.add(w.id);
                merged.push(w);
            }
        }
    }

    // Sort by completedAt when possible
    merged.sort((a, b) => (a.completedAt || '').localeCompare(b.completedAt || ''));
    return { workouts: merged, diagnostics };
}

// -------------------------------
// CSV parsing (RFC4180-ish, robust to quoted newlines)
// -------------------------------

interface CsvTable {
    headers: string[];
    rows: Row[];
    delimiter: string;
}

function normalizeBom(s: string): string {
    return s.replace(/^\uFEFF/, '');
}

/**
 * Sniff delimiter by counting candidate delimiters in the first ~20 non-empty lines,
 * while respecting quoted sections.
 */
function sniffDelimiter(text: string): string {
    const candidates = [',', ';', '\t', '|'];
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0).slice(0, 20);
    if (lines.length === 0) return ',';

    const counts: Record<string, number> = {};
    for (const c of candidates) counts[c] = 0;

    for (const line of lines) {
        for (const c of candidates) counts[c] += countDelimiterOutsideQuotes(line, c);
    }

    // choose max count; fallback comma
    let best = ',';
    let bestCount = -1;
    for (const c of candidates) {
        if (counts[c] > bestCount) { bestCount = counts[c]; best = c; }
    }
    return best;
}

function countDelimiterOutsideQuotes(line: string, delim: string): number {
    let inQuotes = false;
    let count = 0;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            // handle doubled quotes
            if (inQuotes && line[i + 1] === '"') { i++; continue; }
            inQuotes = !inQuotes;
            continue;
        }
        if (!inQuotes && ch === delim) count++;
    }
    return count;
}

/**
 * Parse CSV text into headers + rows.
 * Does not throw on row length mismatch: pads/truncates.
 */
function parseCsvToTable(csvText: string): CsvTable {
    const text = normalizeBom(csvText ?? '');
    const delimiter = sniffDelimiter(text);

    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;

    const pushField = () => {
        row.push(field);
        field = '';
    };
    const pushRow = () => {
        // avoid pushing final empty row
        if (row.length === 1 && row[0] === '' && rows.length === 0) return;
        rows.push(row);
        row = [];
    };

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];

        if (ch === '"') {
            if (inQuotes && text[i + 1] === '"') {
                field += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (!inQuotes && ch === delimiter) {
            pushField();
            continue;
        }

        if (!inQuotes && (ch === '\n' || ch === '\r')) {
            // Handle CRLF or lone CR
            if (ch === '\r' && text[i + 1] === '\n') i++;
            pushField();
            pushRow();
            continue;
        }

        field += ch;
    }

    // flush last field/row
    pushField();
    pushRow();

    // headers
    const rawHeaders = (rows[0] ?? []).map(h => (h ?? '').trim());
    const headers = rawHeaders.map(h => stripBom(h).trim());
    const dataRows = rows.slice(1);

    const outRows: Row[] = [];
    for (const r of dataRows) {
        const padded = r.slice(0, headers.length);
        while (padded.length < headers.length) padded.push('');
        const obj: Row = {};
        for (let j = 0; j < headers.length; j++) {
            const key = headers[j];
            const val = padded[j];
            obj[key] = val === '' ? null : val;
        }
        outRows.push(obj);
    }

    return { headers, rows: outRows, delimiter };
}

function stripBom(s: string): string {
    return s.replace(/^\uFEFF/, '');
}

// -------------------------------
// Export type detection
// -------------------------------

function headerKey(h: string): string {
    return (h ?? '')
        .trim()
        .toLowerCase()
        .replace(/\uFEFF/g, '')
        .replace(/\s+/g, ' ')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function detectExportType(headers: string[]): ExportType {
    const hk = new Set(headers.map(headerKey));

    // Hevy signature
    const hevyRequired = ['title', 'start_time', 'exercise_title', 'set_index'];
    if (hevyRequired.every(k => hk.has(k))) return 'hevy';

    // Strong signature
    const strongRequired = ['date', 'workout_name', 'exercise_name', 'set_order'];
    if (strongRequired.every(k => hk.has(k))) return 'strong';

    return 'unknown';
}

// -------------------------------
// Common parsing helpers
// -------------------------------

function normalizeWhitespace(s: string): string {
    return s.replace(/\s+/g, ' ').trim();
}

function parseDurationToSeconds(s: string | null | undefined): number {
    if (!s) return 0;
    const str = String(s).trim();
    if (!str) return 0;

    // token style: "1h 40m", "12h 52m", "1m", "30s"
    const re = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)\b/gi;
    let total = 0;
    let found = false;
    let m: RegExpExecArray | null;
    while ((m = re.exec(str)) !== null) {
        found = true;
        const num = Number(m[1]);
        const unit = m[2].toLowerCase();
        if (!Number.isFinite(num)) continue;
        if (unit.startsWith('h')) total += num * 3600;
        else if (unit.startsWith('m')) total += num * 60;
        else total += num;
    }

    if (found) return Math.round(total);

    // pure number -> assume seconds
    const n = Number(str);
    if (Number.isFinite(n)) return Math.round(n);
    return 0;
}

// -------------------------------
// Stable ID (SHA-1)
// -------------------------------

export function stableWorkoutId(completedAtIso: string, workoutName: string): string {
    const base = `${completedAtIso || ''}||${workoutName || ''}`;
    return sha1(base);
}

/**
 * SHA-1, dependency-free.
 */
function sha1(msg: string): string {
    function rotl(n: number, s: number) { return (n << s) | (n >>> (32 - s)); }
    function toHex(i: number) { return ('00000000' + i.toString(16)).slice(-8); }

    // UTF-8 encode
    const utf8 = unescape(encodeURIComponent(msg));
    const ml = utf8.length * 8;

    const words: number[] = [];
    for (let i = 0; i < utf8.length; i++) {
        words[i >> 2] |= utf8.charCodeAt(i) << (24 - (i % 4) * 8);
    }
    words[ml >> 5] |= 0x80 << (24 - (ml % 32));
    words[(((ml + 64) >> 9) << 4) + 15] = ml;

    let h0 = 0x67452301;
    let h1 = 0xEFCDAB89;
    let h2 = 0x98BADCFE;
    let h3 = 0x10325476;
    let h4 = 0xC3D2E1F0;

    const w = new Array<number>(80);

    for (let i = 0; i < words.length; i += 16) {
        for (let t = 0; t < 16; t++) w[t] = words[i + t] | 0;
        for (let t = 16; t < 80; t++) w[t] = rotl(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1);

        let a = h0, b = h1, c = h2, d = h3, e = h4;

        for (let t = 0; t < 80; t++) {
            let f: number, k: number;
            if (t < 20) { f = (b & c) | (~b & d); k = 0x5A827999; }
            else if (t < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
            else if (t < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
            else { f = b ^ c ^ d; k = 0xCA62C1D6; }

            const temp = (rotl(a, 5) + f + e + k + w[t]) | 0;
            e = d;
            d = c;
            c = rotl(b, 30) | 0;
            b = a;
            a = temp;
        }

        h0 = (h0 + a) | 0;
        h1 = (h1 + b) | 0;
        h2 = (h2 + c) | 0;
        h3 = (h3 + d) | 0;
        h4 = (h4 + e) | 0;
    }

    return (toHex(h0) + toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4)).toLowerCase();
}

// -------------------------------
// Hevy date parsing (locale tolerant)
// -------------------------------

const MONTH_MAP: Record<string, number> = {
    // English
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
    jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
    oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,

    // Spanish
    ene: 1, enero: 1, febrero: 2, marzo: 3, abr: 4, abril: 4, mayo: 5, junio: 6, julio: 7,
    ago: 8, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, dic: 12, diciembre: 12,

    // French (accents stripped)
    janv: 1, janvier: 1, fevr: 2, fevrier: 2, mars: 3, avr: 4, avril: 4, mai: 5, juin: 6,
    juil: 7, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,

    // German (accents stripped) - excluding duplicates with English
    januar: 1, februar: 2, maerz: 3, marz: 3, juni: 6, juli: 7,
    oktober: 10, dezember: 12, dez: 12, okt: 10,

    // Portuguese (accents stripped)
    janeiro: 1, fevereiro: 2, marco: 3, maio: 5, junho: 6, julho: 7, setembro: 9,
    outubro: 10, dezembro: 12, set: 9, out: 10,

    // Italian (some tokens may appear without accents; keep conservative)
    gennaio: 1, febbraio: 2, aprile: 4, maggio: 5, giugno: 6, luglio: 7, ottobre: 10, dicembre: 12,
};

function stripAccents(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Parse Hevy timestamps commonly like: "28 Mar 2025, 17:29"
 * Returns ISO string (UTC Z) if possible; otherwise falls back to epoch ISO with warning.
 */
function parseHevyTimestampToIso(
    raw: string | null | undefined,
    diagnostics: ParseDiagnostics,
): string {
    const epoch = new Date(0).toISOString();
    if (!raw) return epoch;

    const s = normalizeWhitespace(String(raw));
    if (!s) return epoch;

    // "28 Mar 2025, 17:29" or "28 Mar 2025, 17:29:05"
    const m1 = s.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ.]+)\s+(\d{4}),\s*(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (m1) {
        const day = Number(m1[1]);
        const monthToken = stripAccents(m1[2].replace(/\./g, '')).toLowerCase();
        const year = Number(m1[3]);
        const hh = Number(m1[4]);
        const mm = Number(m1[5]);
        const ss = m1[6] ? Number(m1[6]) : 0;

        const month = MONTH_MAP[monthToken] ?? MONTH_MAP[monthToken.slice(0, 3)];
        if (month && isValidDateParts(year, month, day, hh, mm, ss)) {
            return makeIso(year, month, day, hh, mm, ss);
        }
    }

    // "2025-03-28 17:29[:ss]" or "2025-03-28T17:29"
    const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (m2) {
        const year = Number(m2[1]);
        const month = Number(m2[2]);
        const day = Number(m2[3]);
        const hh = Number(m2[4]);
        const mm = Number(m2[5]);
        const ss = m2[6] ? Number(m2[6]) : 0;
        if (isValidDateParts(year, month, day, hh, mm, ss)) {
            return makeIso(year, month, day, hh, mm, ss);
        }
    }

    // Fallback: Date.parse
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return new Date(t).toISOString();

    diagnostics.warnings.push(`Unparseable Hevy timestamp: "${raw}". Using epoch.`);
    return epoch;
}

function isValidDateParts(y: number, m: number, d: number, hh: number, mm: number, ss: number): boolean {
    if (![y, m, d, hh, mm, ss].every(n => Number.isFinite(n))) return false;
    if (m < 1 || m > 12) return false;
    if (d < 1 || d > 31) return false;
    if (hh < 0 || hh > 23) return false;
    if (mm < 0 || mm > 59) return false;
    if (ss < 0 || ss > 59) return false;
    return true;
}

function makeIso(y: number, m: number, d: number, hh: number, mm: number, ss: number): string {
    const t = Date.UTC(y, m - 1, d, hh, mm, ss);
    return new Date(t).toISOString();
}

// -------------------------------
// Hevy -> Unified
// -------------------------------

function parseHevyTableToUnified(table: CsvTable, userId: string, diagnostics: ParseDiagnostics): UnifiedWorkoutRecord[] {
    const idx = buildHeaderIndex(table.headers);

    const get = (r: Row, name: string): string | null => {
        const key = findHeaderByKey(idx, name);
        if (!key) return null;
        const v = r[key];
        return v === undefined ? null : (v === null ? null : String(v));
    };

    // Group by (title, start_time_iso)
    type WKey = string;
    const workouts = new Map<WKey, {
        workoutName: string;
        completedAt: string;
        endAt: string;
        description: string | null;
        rows: Row[];
    }>();

    const order: WKey[] = [];

    for (const r of table.rows) {
        const title = normalizeWhitespace(get(r, 'title') ?? '');
        const startIso = parseHevyTimestampToIso(get(r, 'start_time'), diagnostics);

        const key = `${title}||${startIso}`;
        if (!workouts.has(key)) {
            workouts.set(key, {
                workoutName: title || 'Workout',
                completedAt: startIso,
                endAt: parseHevyTimestampToIso(get(r, 'end_time'), diagnostics),
                description: get(r, 'description'),
                rows: [],
            });
            order.push(key);
        }

        const w = workouts.get(key)!;
        w.rows.push(r);

        const desc = get(r, 'description');
        if ((!w.description || w.description.trim() === '') && desc) w.description = desc;

        const endRaw = get(r, 'end_time');
        if (w.endAt === new Date(0).toISOString() && endRaw) {
            w.endAt = parseHevyTimestampToIso(endRaw, diagnostics);
        }
    }

    const out: UnifiedWorkoutRecord[] = [];

    for (const key of order) {
        const w = workouts.get(key)!;

        const durationSeconds = computeDurationSeconds(w.completedAt, w.endAt);

        const exercises: UnifiedExercise[] = [];

        let currentExerciseName: string | null = null;
        let currentSupersetId: string | null = null;
        let currentSets: UnifiedSet[] = [];
        let currentNotes: string[] = [];

        const flushExercise = () => {
            if (!currentExerciseName) return;
            exercises.push(buildUnifiedExercise(currentExerciseName, currentSets));
            currentExerciseName = null;
            currentSupersetId = null;
            currentSets = [];
            currentNotes = [];
        };

        const extraNotes: string[] = [];

        for (const r of w.rows) {
            const exName = normalizeWhitespace(get(r, 'exercise_title') ?? 'Exercise');
            const ssid = normalizeWhitespace(get(r, 'superset_id') ?? '');

            const exNote = get(r, 'exercise_notes');
            if (exNote && exNote.trim()) {
                const sNote = exNote.trim();
                if (!currentNotes.includes(sNote)) currentNotes.push(sNote);
            }

            if (currentExerciseName === null) {
                currentExerciseName = exName;
                currentSupersetId = ssid || null;
            } else if (currentExerciseName !== exName || (currentSupersetId ?? '') !== (ssid || '')) {
                if (currentNotes.length > 0) {
                    extraNotes.push(`Exercise notes — ${currentExerciseName}: ${currentNotes.join(' | ')}`);
                }
                flushExercise();
                currentExerciseName = exName;
                currentSupersetId = ssid || null;
            }

            const reps = safeNumber(get(r, 'reps'));
            const wLbs = safeNumber(get(r, 'weight_lbs'));
            const wKg = safeNumber(get(r, 'weight_kg'));
            const weight = wLbs !== null ? wLbs : (wKg !== null ? wKg : 0);
            const isCompleted = (reps > 0) || (weight > 0);

            currentSets.push({ reps, weight, isCompleted });
        }

        if (currentExerciseName !== null) {
            if (currentNotes.length > 0) {
                extraNotes.push(`Exercise notes — ${currentExerciseName}: ${currentNotes.join(' | ')}`);
            }
            flushExercise();
        }

        const notesParts: string[] = [];
        if (w.description && w.description.trim()) notesParts.push(w.description.trim());
        notesParts.push(...extraNotes);

        const workoutName = w.workoutName || 'Workout';
        const completedAt = w.completedAt || new Date(0).toISOString();
        const id = stableWorkoutId(completedAt, workoutName);

        out.push({
            id,
            type: 'quick',
            userId,
            workoutName,
            completedAt,
            durationSeconds,
            exercises,
            notes: notesParts.length ? notesParts.join('\n') : undefined,
        });
    }

    return out;
}

function computeDurationSeconds(startIso: string, endIso: string): number {
    try {
        const t1 = Date.parse(startIso);
        const t2 = Date.parse(endIso);
        if (!Number.isNaN(t1) && !Number.isNaN(t2) && t2 >= t1) {
            return Math.round((t2 - t1) / 1000);
        }
    } catch {
        // ignore
    }
    return 0;
}

function safeNumber(raw: string | null): number {
    if (raw === null || raw === undefined) return 0;
    const n = Number(String(raw).trim());
    return Number.isFinite(n) ? n : 0;
}

// -------------------------------
// Strong -> Unified
// -------------------------------

const STRONG_SYNONYMS: Record<string, string[]> = {
    date: ['date', 'workout_date', 'start_time', 'timestamp'],
    workout_name: ['workout_name', 'workout'],
    duration: ['duration', 'workout_duration', 'session_duration'],
    exercise_name: ['exercise_name', 'exercise'],
    set_order: ['set_order', 'set', 'set_number', 'set_no'],
    weight: ['weight', 'kg', 'lb', 'weight_kg', 'weight_lb'],
    reps: ['reps', 'rep', 'repetitions'],
    distance: ['distance', 'meters', 'miles', 'km'],
    seconds: ['seconds', 'time', 'time_seconds', 'duration_seconds'],
    rpe: ['rpe', 'effort', 'rir'],
    notes: ['notes', 'set_notes', 'exercise_notes', 'note'],
    workout_notes: ['workout_notes', 'session_notes', 'notes_workout'],
    rest_timer: ['rest_timer', 'rest', 'rest_seconds', 'rest_time', 'rest_timer_seconds'],
};

function parseStrongTableToUnified(table: CsvTable, userId: string, diagnostics: ParseDiagnostics): UnifiedWorkoutRecord[] {
    const map = buildStrongMapping(table.headers);

    const need = ['date', 'workout_name', 'exercise_name'];
    const missing = need.filter(k => !map[k]);
    if (missing.length) {
        diagnostics.errors.push(`Strong export missing required columns: ${missing.join(', ')}`);
        return [];
    }

    type WKey = string;
    const workouts = new Map<WKey, {
        workoutName: string;
        completedAt: string;
        durationSeconds: number;
        workoutNotes: string[];
        rows: Row[];
    }>();
    const order: WKey[] = [];

    for (const r of table.rows) {
        const dateRaw = getRow(r, map.date);
        const workoutName = normalizeWhitespace(getRow(r, map.workout_name) ?? '') || 'Workout';
        const completedAt = parseStrongTimestampToIso(dateRaw, diagnostics);
        const key = `${completedAt}||${workoutName}`;

        if (!workouts.has(key)) {
            workouts.set(key, {
                workoutName,
                completedAt,
                durationSeconds: parseDurationToSeconds(getRow(r, map.duration)),
                workoutNotes: [],
                rows: [],
            });
            order.push(key);
        }

        const w = workouts.get(key)!;
        w.rows.push(r);

        const dur = parseDurationToSeconds(getRow(r, map.duration));
        if (dur > w.durationSeconds) w.durationSeconds = dur;

        if (map.workout_notes) {
            const wn = getRow(r, map.workout_notes);
            if (wn && wn.trim() && !w.workoutNotes.includes(wn.trim())) w.workoutNotes.push(wn.trim());
        }
    }

    const out: UnifiedWorkoutRecord[] = [];

    for (const key of order) {
        const w = workouts.get(key)!;

        const exercises: UnifiedExercise[] = [];
        let currentName: string | null = null;
        let currentSets: UnifiedSet[] = [];
        const extraNotes: string[] = [];

        const flush = () => {
            if (!currentName) return;
            exercises.push(buildUnifiedExercise(currentName, currentSets));
            currentName = null;
            currentSets = [];
        };

        for (const r of w.rows) {
            const exName = normalizeWhitespace(getRow(r, map.exercise_name) ?? 'Exercise');

            if (currentName === null) currentName = exName;
            else if (currentName !== exName) flush(), currentName = exName;

            const reps = safeNumber(getRow(r, map.reps));
            const weight = safeNumber(getRow(r, map.weight));
            const isCompleted = (reps > 0) || (weight > 0);

            if (map.notes) {
                const n = getRow(r, map.notes);
                if (n && n.trim()) extraNotes.push(`Set note — ${exName}: ${n.trim()}`);
            }

            currentSets.push({ reps, weight, isCompleted });
        }

        flush();

        const notesParts: string[] = [];
        if (w.workoutNotes.length) notesParts.push(w.workoutNotes.join('\n'));
        if (extraNotes.length) notesParts.push(...extraNotes);

        const id = stableWorkoutId(w.completedAt, w.workoutName);

        out.push({
            id,
            type: 'quick',
            userId,
            workoutName: w.workoutName,
            completedAt: w.completedAt,
            durationSeconds: w.durationSeconds,
            exercises,
            notes: notesParts.length ? notesParts.join('\n') : undefined,
        });
    }

    return out;
}

function getRow(r: Row, key: string | undefined): string | null {
    if (!key) return null;
    const v = r[key];
    return v === undefined ? null : (v === null ? null : String(v));
}

function buildStrongMapping(headers: string[]): Record<string, string | undefined> {
    const hkToHeader: Record<string, string> = {};
    for (const h of headers) {
        hkToHeader[headerKey(h)] = h;
    }
    const mapping: Record<string, string | undefined> = {};
    for (const canon of Object.keys(STRONG_SYNONYMS)) {
        const synonyms = STRONG_SYNONYMS[canon];
        let found: string | undefined;
        for (const s of synonyms) {
            if (hkToHeader[s]) { found = hkToHeader[s]; break; }
        }
        mapping[canon] = found;
    }
    return mapping;
}

function parseStrongTimestampToIso(raw: string | null | undefined, diagnostics: ParseDiagnostics): string {
    const epoch = new Date(0).toISOString();
    if (!raw) return epoch;
    const s = normalizeWhitespace(String(raw));
    if (!s) return epoch;

    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
    if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = Number(m[3]);
        const hh = Number(m[4]);
        const mm = Number(m[5]);
        const ss = Number(m[6]);
        if (isValidDateParts(y, mo, d, hh, mm, ss)) {
            return makeIso(y, mo, d, hh, mm, ss);
        }
    }

    const t = Date.parse(s);
    if (!Number.isNaN(t)) return new Date(t).toISOString();

    diagnostics.warnings.push(`Unparseable Strong timestamp: "${raw}". Using epoch.`);
    return epoch;
}

// -------------------------------
// Exercise aggregation helpers
// -------------------------------

function buildUnifiedExercise(name: string, sets: UnifiedSet[]): UnifiedExercise {
    const totalSets = sets.length;
    const setsCompleted = sets.filter(s => s.isCompleted).length;

    let best = { reps: 0, weight: 0 };
    for (const s of sets) {
        if (!s.isCompleted) continue;
        if (s.weight > best.weight) best = { reps: s.reps, weight: s.weight };
        else if (s.weight === best.weight && s.reps > best.reps) best = { reps: s.reps, weight: s.weight };
    }

    return {
        name: canonicalizeExerciseName(name),
        totalSets,
        setsCompleted,
        bestSet: best,
        sets,
    };
}

function canonicalizeExerciseName(name: string): string {
    return normalizeWhitespace(name);
}

// -------------------------------
// Header index helpers
// -------------------------------

function buildHeaderIndex(headers: string[]): Record<string, string> {
    const idx: Record<string, string> = {};
    for (const h of headers) idx[headerKey(h)] = h;
    return idx;
}

function findHeaderByKey(idx: Record<string, string>, key: string): string | undefined {
    return idx[headerKey(key)];
}
