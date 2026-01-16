/**
 * PDF Validator Service
 * 
 * Client-side validation for PDF uploads before sending to server.
 * Includes signature detection for quick workout content check.
 */

// Maximum file size: 100MB
export const MAX_PDF_SIZE = 100 * 1024 * 1024;

// Supported MIME types
export const SUPPORTED_MIME_TYPES = [
    'application/pdf',
    'application/x-pdf',
];

/**
 * Workout signature patterns for quick detection
 * These patterns indicate the PDF likely contains workout content
 */
const WORKOUT_SIGNATURES = [
    /sets?\s*[x×]\s*\d+/i,                          // "3x10", "4 sets x 8"
    /\d+\s*(?:reps?|repetitions?)/i,                // "10 reps"
    /(?:day|week)\s*\d+/i,                          // "Day 1", "Week 2"
    /(?:push|pull|legs?|upper|lower)\s+day/i,       // "Push Day", "Leg Day"
    /(?:chest|back|shoulders?|arms?)\s+day/i,
    /(?:warmup|warm-up|working sets?)/i,
    /(?:superset|dropset|giant\s+set)/i,
    /(?:AMRAP|RPE\s*\d)/i,
];

export interface ValidationResult {
    valid: boolean;
    error?: string;
    signatureMatch?: number;
}

/**
 * Validate a PDF file before upload
 */
export function validatePDFFile(
    file: { name: string; size: number; mimeType?: string }
): ValidationResult {
    // Check file extension
    if (!file.name?.toLowerCase().endsWith('.pdf')) {
        return {
            valid: false,
            error: 'Please select a PDF file',
        };
    }

    // Check file size
    if (file.size > MAX_PDF_SIZE) {
        const sizeMB = Math.round(MAX_PDF_SIZE / 1024 / 1024);
        return {
            valid: false,
            error: `File too large. Maximum size is ${sizeMB}MB`,
        };
    }

    // Check MIME type if available
    if (file.mimeType && !SUPPORTED_MIME_TYPES.includes(file.mimeType)) {
        return {
            valid: false,
            error: 'Invalid file type. Please select a PDF file.',
        };
    }

    return { valid: true };
}

/**
 * Quick signature check on text content
 * Returns number of workout patterns matched
 */
export function checkWorkoutSignatures(text: string): {
    passes: boolean;
    matchCount: number;
    confidence: number;
} {
    const matches = WORKOUT_SIGNATURES.filter(pattern => pattern.test(text));
    const matchCount = matches.length;

    return {
        passes: matchCount >= 2,
        matchCount,
        confidence: Math.min(1, matchCount / 5),  // 5 matches = 100% confidence
    };
}

/**
 * Extract text hints from PDF filename
 * Helps with early detection of non-workout content
 */
export function analyzeFilename(filename: string): {
    likelyWorkout: boolean;
    hints: string[];
} {
    const lower = filename.toLowerCase();
    const hints: string[] = [];

    // Positive indicators
    const workoutKeywords = ['workout', 'program', 'training', 'routine', 'split', 'bodybuilding', 'strength', 'hypertrophy', 'ppl', 'push', 'pull', 'legs'];
    const hasWorkoutKeyword = workoutKeywords.some(kw => lower.includes(kw));
    if (hasWorkoutKeyword) hints.push('workout_keyword_in_name');

    // Negative indicators
    const nonWorkoutKeywords = ['nutrition', 'diet', 'meal', 'recipe', 'supplement', 'cookbook', 'guide book'];
    const hasNonWorkoutKeyword = nonWorkoutKeywords.some(kw => lower.includes(kw));
    if (hasNonWorkoutKeyword) hints.push('non_workout_keyword_in_name');

    return {
        likelyWorkout: hasWorkoutKeyword && !hasNonWorkoutKeyword,
        hints,
    };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
