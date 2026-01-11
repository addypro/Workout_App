/**
 * PDF Parsing Service
 *
 * Client-side orchestration for the vision-first PDF parsing pipeline.
 * Calls Supabase Edge Functions for the heavy lifting (Claude Vision).
 */

import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase/client';
import type {
  PDFAnalysis,
  ProgramOption,
  ExtractedProgram,
  ParsedPDFResult,
  AnalyzePDFRequest,
  AnalyzePDFResponse,
  ExtractProgramRequest,
  ExtractProgramResponse,
} from './types';
import { normalizeProgram } from './normalizer';

const EDGE_FUNCTION_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
  ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`
  : '';

/**
 * Read PDF file as base64 with file size
 */
export async function readPDFAsBase64(uri: string): Promise<{ base64: string; fileSize: number }> {
  if (Platform.OS === 'web') {
    // Web: Fetch blob and convert to base64
    const response = await fetch(uri);
    const blob = await response.blob();
    const fileSize = blob.size;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve({ base64, fileSize });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } else {
    // Native: Use expo-file-system
    const FileSystem = require('expo-file-system');
    const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { base64, fileSize: fileInfo.size || 0 };
  }
}

/**
 * Phase 1: Analyze PDF to detect structure and program options
 */
export async function analyzePDF(
  pdfBase64: string,
  filename: string,
  fileSize?: number
): Promise<AnalyzePDFResponse & { contentHash?: string; cached?: boolean }> {
  try {
    // Get auth token for edge function
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(`${EDGE_FUNCTION_URL}/parse-pdf-analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '',
      },
      body: JSON.stringify({
        pdfBase64,
        filename,
        fileSize,
      } as AnalyzePDFRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Analysis failed: ${errorText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('PDF analysis error:', error);
    return {
      success: false,
      error: error.message || 'Failed to analyze PDF',
    };
  }
}

/**
 * Phase 2: Extract program from PDF using selected option
 */
export async function extractProgram(
  pdfBase64: string,
  selectedOption: ProgramOption,
  knownExercises?: string[],
  contentHash?: string,
  fileSize?: number
): Promise<ExtractProgramResponse & { cached?: boolean }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(`${EDGE_FUNCTION_URL}/parse-pdf-extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '',
      },
      body: JSON.stringify({
        pdfBase64,
        selectedOption,
        knownExercises,
        contentHash,
        fileSize,
      } as ExtractProgramRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Extraction failed: ${errorText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('PDF extraction error:', error);
    return {
      success: false,
      error: error.message || 'Failed to extract program',
    };
  }
}

/**
 * Full PDF parsing pipeline
 */
export async function parsePDF(
  uri: string,
  filename: string,
  onProgress?: (stage: string, percent: number) => void
): Promise<ParsedPDFResult> {
  const startTime = Date.now();

  try {
    // Stage 1: Read PDF
    onProgress?.('Reading PDF...', 10);
    const { base64: pdfBase64, fileSize } = await readPDFAsBase64(uri);

    // Stage 2: Analyze structure (checks cache first)
    onProgress?.('Analyzing structure...', 30);
    const analysisResponse = await analyzePDF(pdfBase64, filename, fileSize);

    if (!analysisResponse.success || !analysisResponse.analysis) {
      return {
        status: 'error',
        errorMessage: analysisResponse.error || 'Analysis failed',
        metadata: {
          totalPages: 0,
          processingTimeMs: Date.now() - startTime,
        },
        analysis: {
          isWorkoutProgram: false,
          containsMultiplePrograms: false,
          programOptions: [],
          rejectionReason: analysisResponse.error,
        },
      };
    }

    const analysis = analysisResponse.analysis;
    const contentHash = analysisResponse.contentHash;

    // Log cache status for debugging
    if (analysisResponse.cached) {
      console.log('PDF analysis retrieved from cache');
    }

    // Check if it's actually a workout program
    if (!analysis.isWorkoutProgram) {
      return {
        status: 'no_workout_found',
        errorMessage: analysis.rejectionReason,
        metadata: {
          title: analysis.title,
          author: analysis.author,
          totalPages: analysis.totalPages || 0,
          processingTimeMs: Date.now() - startTime,
        },
        analysis,
      };
    }

    // If multiple programs, return analysis for user selection
    if (analysis.containsMultiplePrograms && analysis.programOptions.length > 1) {
      onProgress?.('Multiple programs detected', 50);
      return {
        status: 'partial_success',
        metadata: {
          title: analysis.title,
          author: analysis.author,
          totalPages: analysis.totalPages || 0,
          processingTimeMs: Date.now() - startTime,
          contentHash, // Include for subsequent extraction
        },
        analysis,
        warnings: ['Multiple program variations detected. Please select one to continue.'],
      };
    }

    // Stage 3: Extract the program (checks cache first)
    onProgress?.('Extracting workouts...', 60);
    const selectedOption = analysis.programOptions[0] || {
      name: analysis.title || 'Workout Program',
      pageStart: 1,
      pageEnd: analysis.totalPages || 100,
      description: '',
    };

    const extractionResponse = await extractProgram(
      pdfBase64,
      selectedOption,
      undefined,
      contentHash,
      fileSize
    );

    if (!extractionResponse.success || !extractionResponse.program) {
      return {
        status: 'error',
        errorMessage: extractionResponse.error || 'Extraction failed',
        metadata: {
          title: analysis.title,
          author: analysis.author,
          totalPages: analysis.totalPages || 0,
          processingTimeMs: Date.now() - startTime,
        },
        analysis,
      };
    }

    // Log cache status for debugging
    if (extractionResponse.cached) {
      console.log('PDF extraction retrieved from cache');
    }

    // Stage 4: Normalize exercise names
    onProgress?.('Matching exercises...', 80);
    const { normalizedProgram, unmatchedExercises, stats } = await normalizeProgram(
      extractionResponse.program
    );

    onProgress?.('Complete!', 100);

    return {
      status: stats.unmatched > 0 ? 'partial_success' : 'success',
      metadata: {
        title: analysis.title,
        author: analysis.author,
        totalPages: analysis.totalPages || 0,
        processingTimeMs: Date.now() - startTime,
      },
      analysis,
      selectedProgram: normalizedProgram,
      unmatchedExercises: unmatchedExercises.length > 0 ? unmatchedExercises : undefined,
      warnings: [
        ...(extractionResponse.warnings || []),
        ...(stats.unmatched > 0
          ? [`${stats.unmatched} exercises couldn't be matched automatically.`]
          : []),
      ],
    };
  } catch (error: any) {
    console.error('PDF parsing error:', error);
    return {
      status: 'error',
      errorMessage: error.message || 'Failed to parse PDF',
      metadata: {
        totalPages: 0,
        processingTimeMs: Date.now() - startTime,
      },
      analysis: {
        isWorkoutProgram: false,
        containsMultiplePrograms: false,
        programOptions: [],
      },
    };
  }
}

/**
 * Continue parsing after user selects a program option
 */
export async function parsePDFWithSelection(
  uri: string,
  filename: string,
  selectedOption: ProgramOption,
  analysis: PDFAnalysis,
  contentHash?: string,
  onProgress?: (stage: string, percent: number) => void
): Promise<ParsedPDFResult> {
  const startTime = Date.now();

  try {
    onProgress?.('Reading PDF...', 10);
    const { base64: pdfBase64, fileSize } = await readPDFAsBase64(uri);

    onProgress?.('Extracting workouts...', 40);
    const extractionResponse = await extractProgram(
      pdfBase64,
      selectedOption,
      undefined,
      contentHash,
      fileSize
    );

    if (!extractionResponse.success || !extractionResponse.program) {
      return {
        status: 'error',
        errorMessage: extractionResponse.error || 'Extraction failed',
        metadata: {
          title: analysis.title,
          author: analysis.author,
          totalPages: analysis.totalPages || 0,
          processingTimeMs: Date.now() - startTime,
        },
        analysis,
      };
    }

    // Log cache status for debugging
    if (extractionResponse.cached) {
      console.log('PDF extraction retrieved from cache');
    }

    onProgress?.('Matching exercises...', 70);
    const { normalizedProgram, unmatchedExercises, stats } = await normalizeProgram(
      extractionResponse.program
    );

    onProgress?.('Complete!', 100);

    return {
      status: stats.unmatched > 0 ? 'partial_success' : 'success',
      metadata: {
        title: analysis.title,
        author: analysis.author,
        totalPages: analysis.totalPages || 0,
        processingTimeMs: Date.now() - startTime,
      },
      analysis,
      selectedProgram: normalizedProgram,
      unmatchedExercises: unmatchedExercises.length > 0 ? unmatchedExercises : undefined,
      warnings: [
        ...(extractionResponse.warnings || []),
        ...(stats.unmatched > 0
          ? [`${stats.unmatched} exercises couldn't be matched automatically.`]
          : []),
      ],
    };
  } catch (error: any) {
    console.error('PDF parsing with selection error:', error);
    return {
      status: 'error',
      errorMessage: error.message || 'Failed to parse PDF',
      metadata: {
        totalPages: 0,
        processingTimeMs: Date.now() - startTime,
      },
      analysis,
    };
  }
}

/**
 * Check if PDF parsing is available (edge functions configured)
 */
export function isPDFParsingAvailable(): boolean {
  return Boolean(EDGE_FUNCTION_URL);
}
