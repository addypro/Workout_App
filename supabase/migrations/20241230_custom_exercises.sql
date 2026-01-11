-- ============================================
-- Custom Exercises Schema
-- ============================================
-- Allows users to create custom exercises with:
-- 1. User-specific visibility (RLS)
-- 2. Automatic pattern detection across users
-- 3. Promotion to global database when threshold met

-- ============================================
-- 1. Custom Exercises Table (User-specific)
-- ============================================

CREATE TABLE IF NOT EXISTS public.custom_exercises (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Exercise info
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  equipment TEXT[] DEFAULT '{}',
  muscle_groups TEXT[] DEFAULT '{}',
  movement_pattern TEXT,
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  notes TEXT,

  -- Usage tracking
  usage_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes for common queries
  CONSTRAINT unique_user_exercise UNIQUE (user_id, normalized_name)
);

-- Index for searching by normalized name
CREATE INDEX IF NOT EXISTS idx_custom_exercises_normalized_name
  ON public.custom_exercises(normalized_name);

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_custom_exercises_user_id
  ON public.custom_exercises(user_id);

-- ============================================
-- 2. Exercise Patterns Table (Aggregated)
-- ============================================
-- Tracks usage patterns across all users for promotion detection

CREATE TABLE IF NOT EXISTS public.exercise_patterns (
  normalized_name TEXT PRIMARY KEY,

  -- Aggregated stats
  unique_user_count INTEGER DEFAULT 0,
  total_usage_count INTEGER DEFAULT 0,

  -- Sample data for promoted exercise
  sample_name TEXT NOT NULL,
  sample_equipment TEXT[] DEFAULT '{}',
  sample_muscle_groups TEXT[] DEFAULT '{}',
  sample_movement_pattern TEXT,
  sample_difficulty TEXT,

  -- Tracking
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),

  -- Promotion status
  meets_threshold BOOLEAN DEFAULT FALSE,
  promoted_at TIMESTAMPTZ
);

-- ============================================
-- 3. Promoted Exercises Table (Global)
-- ============================================
-- Exercises that have been promoted based on usage patterns

CREATE TABLE IF NOT EXISTS public.promoted_exercises (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,

  -- From pattern aggregation
  normalized_name TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  equipment TEXT[] DEFAULT '{}',
  muscle_groups TEXT[] DEFAULT '{}',
  movement_pattern TEXT,
  difficulty TEXT,
  notes TEXT,

  -- Stats
  usage_count INTEGER DEFAULT 0,
  contributor_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Source tracking
  source_pattern_name TEXT REFERENCES public.exercise_patterns(normalized_name)
);

-- ============================================
-- 4. RLS Policies
-- ============================================

-- Enable RLS
ALTER TABLE public.custom_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promoted_exercises ENABLE ROW LEVEL SECURITY;

-- Custom exercises: Users can only see their own
CREATE POLICY "Users can view own custom exercises"
  ON public.custom_exercises FOR SELECT
  USING (user_id = auth.uid()::TEXT OR user_id LIKE 'anon_%');

CREATE POLICY "Users can insert own custom exercises"
  ON public.custom_exercises FOR INSERT
  WITH CHECK (user_id = auth.uid()::TEXT OR user_id LIKE 'anon_%');

CREATE POLICY "Users can update own custom exercises"
  ON public.custom_exercises FOR UPDATE
  USING (user_id = auth.uid()::TEXT OR user_id LIKE 'anon_%');

CREATE POLICY "Users can delete own custom exercises"
  ON public.custom_exercises FOR DELETE
  USING (user_id = auth.uid()::TEXT OR user_id LIKE 'anon_%');

-- Exercise patterns: Read-only for all (used for pattern detection internally)
CREATE POLICY "Anyone can view exercise patterns"
  ON public.exercise_patterns FOR SELECT
  USING (true);

-- Promoted exercises: Everyone can read
CREATE POLICY "Anyone can view promoted exercises"
  ON public.promoted_exercises FOR SELECT
  USING (true);

-- ============================================
-- 5. Trigger: Update Patterns on Custom Exercise Change
-- ============================================

CREATE OR REPLACE FUNCTION update_exercise_pattern()
RETURNS TRIGGER AS $$
DECLARE
  existing_pattern RECORD;
BEGIN
  -- Get or create pattern
  SELECT * INTO existing_pattern
  FROM public.exercise_patterns
  WHERE normalized_name = NEW.normalized_name;

  IF existing_pattern IS NULL THEN
    -- Create new pattern
    INSERT INTO public.exercise_patterns (
      normalized_name,
      unique_user_count,
      total_usage_count,
      sample_name,
      sample_equipment,
      sample_muscle_groups,
      sample_movement_pattern,
      sample_difficulty,
      first_seen_at,
      last_seen_at
    ) VALUES (
      NEW.normalized_name,
      1,
      NEW.usage_count,
      NEW.name,
      NEW.equipment,
      NEW.muscle_groups,
      NEW.movement_pattern,
      NEW.difficulty,
      NOW(),
      NOW()
    );
  ELSE
    -- Update existing pattern
    UPDATE public.exercise_patterns
    SET
      unique_user_count = (
        SELECT COUNT(DISTINCT user_id)
        FROM public.custom_exercises
        WHERE normalized_name = NEW.normalized_name
      ),
      total_usage_count = (
        SELECT COALESCE(SUM(usage_count), 0)
        FROM public.custom_exercises
        WHERE normalized_name = NEW.normalized_name
      ),
      last_seen_at = NOW(),
      -- Check promotion threshold
      meets_threshold = (
        SELECT COUNT(DISTINCT user_id) >= 10
          AND COALESCE(SUM(usage_count), 0) >= 50
        FROM public.custom_exercises
        WHERE normalized_name = NEW.normalized_name
      )
    WHERE normalized_name = NEW.normalized_name;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on insert/update
CREATE TRIGGER trigger_update_exercise_pattern
  AFTER INSERT OR UPDATE ON public.custom_exercises
  FOR EACH ROW
  EXECUTE FUNCTION update_exercise_pattern();

-- ============================================
-- 6. Function: Promote Exercises Meeting Threshold
-- ============================================
-- Run this periodically (e.g., daily via cron) to promote exercises

CREATE OR REPLACE FUNCTION promote_popular_exercises()
RETURNS INTEGER AS $$
DECLARE
  promoted_count INTEGER := 0;
  pattern RECORD;
BEGIN
  -- Find patterns that meet threshold but aren't promoted yet
  FOR pattern IN
    SELECT * FROM public.exercise_patterns
    WHERE meets_threshold = TRUE
      AND promoted_at IS NULL
      AND first_seen_at < NOW() - INTERVAL '7 days'  -- At least 7 days old
  LOOP
    -- Create promoted exercise
    INSERT INTO public.promoted_exercises (
      normalized_name,
      name,
      equipment,
      muscle_groups,
      movement_pattern,
      difficulty,
      usage_count,
      contributor_count,
      source_pattern_name
    ) VALUES (
      pattern.normalized_name,
      pattern.sample_name,
      pattern.sample_equipment,
      pattern.sample_muscle_groups,
      pattern.sample_movement_pattern,
      pattern.sample_difficulty,
      pattern.total_usage_count,
      pattern.unique_user_count,
      pattern.normalized_name
    )
    ON CONFLICT (normalized_name) DO UPDATE SET
      usage_count = EXCLUDED.usage_count,
      contributor_count = EXCLUDED.contributor_count,
      updated_at = NOW();

    -- Mark pattern as promoted
    UPDATE public.exercise_patterns
    SET promoted_at = NOW()
    WHERE normalized_name = pattern.normalized_name;

    promoted_count := promoted_count + 1;
  END LOOP;

  RETURN promoted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. Helpful Views
-- ============================================

-- View: Exercises pending promotion (for admin dashboard)
CREATE OR REPLACE VIEW pending_promotion AS
SELECT
  normalized_name,
  sample_name AS name,
  unique_user_count,
  total_usage_count,
  first_seen_at,
  last_seen_at,
  CASE
    WHEN unique_user_count >= 10 THEN 'Users met'
    ELSE unique_user_count || '/10 users'
  END AS user_status,
  CASE
    WHEN total_usage_count >= 50 THEN 'Usage met'
    ELSE total_usage_count || '/50 uses'
  END AS usage_status
FROM public.exercise_patterns
WHERE promoted_at IS NULL
ORDER BY unique_user_count DESC, total_usage_count DESC;

-- ============================================
-- 8. Grant Permissions
-- ============================================

-- Allow authenticated users to execute the pattern update function
GRANT EXECUTE ON FUNCTION update_exercise_pattern() TO authenticated;
GRANT EXECUTE ON FUNCTION update_exercise_pattern() TO anon;

-- Allow service role to run promotion
GRANT EXECUTE ON FUNCTION promote_popular_exercises() TO service_role;

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE public.custom_exercises IS 'User-created custom exercises with local-first sync';
COMMENT ON TABLE public.exercise_patterns IS 'Aggregated patterns for detecting popular custom exercises';
COMMENT ON TABLE public.promoted_exercises IS 'Custom exercises promoted to global visibility based on usage patterns';
COMMENT ON FUNCTION promote_popular_exercises() IS 'Run periodically to promote popular custom exercises to global database';
