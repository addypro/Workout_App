-- PDF Extraction Cache
-- Stores extracted workout programs from PDFs to avoid re-processing

CREATE TABLE pdf_extraction_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content identification
  content_hash TEXT UNIQUE NOT NULL,  -- SHA-256 of PDF bytes
  file_size INTEGER,
  page_count INTEGER,
  source_filename TEXT,
  
  -- Classification result (Stage 2: Gate)
  classification JSONB,
  -- Example: { "isWorkoutProgram": true, "confidence": 0.95, "programType": "hypertrophy" }
  
  -- Extracted program (Stage 3)
  extracted_program JSONB,
  -- Example: { "name": "Pure Bodybuilding", "weeks": [...], "exercises": [...] }
  
  -- Metrics
  tokens_used INTEGER,
  processing_time_ms INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast hash lookups
CREATE INDEX idx_pdf_cache_hash ON pdf_extraction_cache(content_hash);

-- RLS: Cache is public for reads (shared across users)
ALTER TABLE pdf_extraction_cache ENABLE ROW LEVEL SECURITY;

-- Anyone can read cached extractions
CREATE POLICY "pdf_cache_read" ON pdf_extraction_cache
  FOR SELECT USING (true);

-- Only service role can insert/update (via edge function)
CREATE POLICY "pdf_cache_write" ON pdf_extraction_cache
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "pdf_cache_update" ON pdf_extraction_cache
  FOR UPDATE USING (auth.role() = 'service_role');

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_pdf_cache_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pdf_cache_updated
  BEFORE UPDATE ON pdf_extraction_cache
  FOR EACH ROW EXECUTE FUNCTION update_pdf_cache_timestamp();

-- Comment
COMMENT ON TABLE pdf_extraction_cache IS 'Caches extracted workout programs from PDFs to save on LLM token costs';
