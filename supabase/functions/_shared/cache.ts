/**
 * PDF Cache Utilities
 *
 * Handles cache lookups and storage for parsed PDF programs.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Use service role client for cache operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CacheEntry {
  content_hash: string;
  filename: string | null;
  file_size_bytes: number | null;
  analysis_result: any | null;
  extracted_programs: Record<string, any>;
  hit_count: number;
  created_at: string;
  last_accessed_at: string;
}

/**
 * Check if analysis result exists in cache
 */
export async function getCachedAnalysis(
  contentHash: string
): Promise<{ found: boolean; analysis?: any }> {
  const { data, error } = await supabase
    .from('parsed_program_cache')
    .select('analysis_result, hit_count')
    .eq('content_hash', contentHash)
    .single();

  if (error || !data?.analysis_result) {
    return { found: false };
  }

  // Update hit count
  await supabase
    .from('parsed_program_cache')
    .update({
      hit_count: (data.hit_count || 0) + 1,
      last_accessed_at: new Date().toISOString(),
    })
    .eq('content_hash', contentHash);

  return { found: true, analysis: data.analysis_result };
}

/**
 * Store analysis result in cache
 */
export async function cacheAnalysis(
  contentHash: string,
  filename: string,
  fileSizeBytes: number | null,
  analysis: any
): Promise<void> {
  const { error } = await supabase.from('parsed_program_cache').upsert(
    {
      content_hash: contentHash,
      filename,
      file_size_bytes: fileSizeBytes,
      analysis_result: analysis,
      extracted_programs: {},
      hit_count: 1,
      created_at: new Date().toISOString(),
      last_accessed_at: new Date().toISOString(),
    },
    { onConflict: 'content_hash' }
  );

  if (error) {
    console.error('Failed to cache analysis:', error);
  }
}

/**
 * Check if extracted program exists in cache
 */
export async function getCachedExtraction(
  contentHash: string,
  programName: string
): Promise<{ found: boolean; program?: any }> {
  const { data, error } = await supabase
    .from('parsed_program_cache')
    .select('extracted_programs, hit_count')
    .eq('content_hash', contentHash)
    .single();

  if (error || !data?.extracted_programs) {
    return { found: false };
  }

  const programs = data.extracted_programs as Record<string, any>;
  const cachedProgram = programs[programName];

  if (!cachedProgram) {
    return { found: false };
  }

  // Update hit count
  await supabase
    .from('parsed_program_cache')
    .update({
      hit_count: (data.hit_count || 0) + 1,
      last_accessed_at: new Date().toISOString(),
    })
    .eq('content_hash', contentHash);

  return { found: true, program: cachedProgram };
}

/**
 * Store extracted program in cache
 */
export async function cacheExtraction(
  contentHash: string,
  programName: string,
  program: any
): Promise<void> {
  // First get existing programs
  const { data } = await supabase
    .from('parsed_program_cache')
    .select('extracted_programs')
    .eq('content_hash', contentHash)
    .single();

  const existingPrograms = (data?.extracted_programs as Record<string, any>) || {};
  const updatedPrograms = {
    ...existingPrograms,
    [programName]: program,
  };

  const { error } = await supabase
    .from('parsed_program_cache')
    .update({
      extracted_programs: updatedPrograms,
      last_accessed_at: new Date().toISOString(),
    })
    .eq('content_hash', contentHash);

  if (error) {
    console.error('Failed to cache extraction:', error);
  }
}

/**
 * Get cache statistics (for monitoring)
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  totalHits: number;
}> {
  const { data, error } = await supabase
    .from('parsed_program_cache')
    .select('hit_count');

  if (error || !data) {
    return { totalEntries: 0, totalHits: 0 };
  }

  return {
    totalEntries: data.length,
    totalHits: data.reduce((sum, entry) => sum + (entry.hit_count || 0), 0),
  };
}
