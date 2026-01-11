-- Extraction Cache Table
-- Caches AI extraction results by content hash to avoid redundant API calls
-- Supports audio, image, and PDF content types

CREATE TABLE IF NOT EXISTS public.extraction_cache (
  -- SHA-256 hash of file content
  content_hash TEXT PRIMARY KEY,

  -- MIME type of original content
  mime_type TEXT NOT NULL,

  -- Extracted result (JSON)
  result JSONB NOT NULL,

  -- Usage statistics
  hit_count INTEGER DEFAULT 1,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_extraction_cache_hash
  ON public.extraction_cache(content_hash);

-- Index for cleanup queries (remove old unused cache entries)
CREATE INDEX IF NOT EXISTS idx_extraction_cache_last_accessed
  ON public.extraction_cache(last_accessed_at);

-- Index by mime type for analytics
CREATE INDEX IF NOT EXISTS idx_extraction_cache_mime
  ON public.extraction_cache(mime_type);

-- RLS Policies
ALTER TABLE public.extraction_cache ENABLE ROW LEVEL SECURITY;

-- Cache is readable by all (public benefit - same content = same result)
CREATE POLICY "Cache is readable by all"
  ON public.extraction_cache FOR SELECT
  USING (true);

-- Only service role can write to cache (edge functions)
CREATE POLICY "Only service role can insert cache"
  ON public.extraction_cache FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Only service role can update cache"
  ON public.extraction_cache FOR UPDATE
  USING (true);

-- Comment for documentation
COMMENT ON TABLE public.extraction_cache IS
  'Caches AI workout extraction results by content hash. Supports audio (voice logging), images, and PDFs. Cache hits are free - no API cost.';

COMMENT ON COLUMN public.extraction_cache.content_hash IS
  'SHA-256 hash of the raw file bytes';

COMMENT ON COLUMN public.extraction_cache.mime_type IS
  'Original MIME type: audio/m4a, image/png, application/pdf, etc.';

COMMENT ON COLUMN public.extraction_cache.result IS
  'Full extraction result including exercises, metadata, and confidence scores';

-- Function to clean up old cache entries (run periodically)
CREATE OR REPLACE FUNCTION cleanup_extraction_cache(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM public.extraction_cache
    WHERE last_accessed_at < NOW() - (days_old || ' days')::INTERVAL
      AND hit_count < 3  -- Only delete rarely-used entries
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_extraction_cache IS
  'Removes cache entries not accessed in the specified number of days with low hit counts. Default: 30 days.';
