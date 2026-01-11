-- PDF Program Cache Table
-- Caches parsed PDF programs by content hash to avoid re-parsing identical files

CREATE TABLE IF NOT EXISTS public.parsed_program_cache (
  -- SHA-256 hash of PDF content (base64)
  content_hash TEXT PRIMARY KEY,

  -- Original filename (for reference)
  filename TEXT,

  -- File size in bytes (helps with hash collision detection)
  file_size_bytes INTEGER,

  -- Analysis phase result (from parse-pdf-analyze)
  analysis_result JSONB,

  -- Extracted program data (from parse-pdf-extract)
  -- Keyed by program option name for multi-program PDFs
  extracted_programs JSONB DEFAULT '{}',

  -- Usage statistics
  hit_count INTEGER DEFAULT 1,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pdf_cache_hash ON public.parsed_program_cache(content_hash);

-- Index for cleanup queries (remove old unused cache entries)
CREATE INDEX IF NOT EXISTS idx_pdf_cache_last_accessed ON public.parsed_program_cache(last_accessed_at);

-- Function to update hit count and last accessed timestamp
CREATE OR REPLACE FUNCTION update_cache_hit()
RETURNS TRIGGER AS $$
BEGIN
  NEW.hit_count := OLD.hit_count + 1;
  NEW.last_accessed_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE public.parsed_program_cache ENABLE ROW LEVEL SECURITY;

-- Anyone can read from cache (public benefit)
CREATE POLICY "Cache is readable by all"
  ON public.parsed_program_cache FOR SELECT
  USING (true);

-- Only service role can write to cache (edge functions)
CREATE POLICY "Only service role can insert cache"
  ON public.parsed_program_cache FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Only service role can update cache"
  ON public.parsed_program_cache FOR UPDATE
  USING (true);

-- Comment for documentation
COMMENT ON TABLE public.parsed_program_cache IS
  'Caches parsed PDF workout programs to avoid redundant AI parsing. Content is identified by SHA-256 hash of the PDF base64 data.';
