-- ============================================
-- Popularity System Schema for Workout App
-- Run this in Supabase SQL Editor
--
-- IMPORTANT: This script works with EXISTING tables:
--   - workout_logs (already exists with "userId", etc.)
--   - workout_log_exercises (already exists with "workoutLogId", "exerciseName", etc.)
--
-- This script ONLY creates the NEW popularity tracking tables
-- and adds triggers to the existing tables.
-- ============================================

-- ============================================
-- PART 1: DROP EXISTING POPULARITY OBJECTS (safe cleanup)
-- ============================================

-- Drop triggers on existing tables (safe if they don't exist)
DROP TRIGGER IF EXISTS on_workout_exercise_logged ON public.workout_log_exercises;

-- Drop functions
DROP FUNCTION IF EXISTS update_exercise_usage_from_log_exercises();
DROP FUNCTION IF EXISTS recalculate_popularity_scores();
DROP FUNCTION IF EXISTS normalize_exercise_name(TEXT);

-- Drop policies (ignore errors if tables/policies don't exist)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Anyone can read exercise stats" ON public.exercise_usage_stats;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view own exercise usage" ON public.user_exercise_usage;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Anyone can read popularity cache" ON public.popularity_cache;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Drop tables (CASCADE to drop dependent objects)
DROP TABLE IF EXISTS public.popularity_adjustment_log CASCADE;
DROP TABLE IF EXISTS public.popularity_cache CASCADE;
DROP TABLE IF EXISTS public.user_exercise_usage CASCADE;
DROP TABLE IF EXISTS public.exercise_usage_stats CASCADE;

-- ============================================
-- PART 2: CREATE NEW POPULARITY TABLES
-- ============================================

-- 1. EXERCISE USAGE STATS TABLE
-- Aggregates exercise popularity across all users
CREATE TABLE public.exercise_usage_stats (
  "exerciseName" TEXT PRIMARY KEY,
  "canonicalName" TEXT NOT NULL,
  "totalWorkoutAppearances" INTEGER DEFAULT 0,
  "totalSetCompletions" INTEGER DEFAULT 0,
  "uniqueUserCount" INTEGER DEFAULT 0,
  "last30DaysAppearances" INTEGER DEFAULT 0,
  "last30DaysUsers" INTEGER DEFAULT 0,
  "rawPopularityScore" NUMERIC(5,2) DEFAULT 0,
  "bayesianAdjustedScore" NUMERIC(5,2) DEFAULT 50,
  "finalPopularityScore" NUMERIC(5,2) DEFAULT 50,
  "firstSeenAt" TIMESTAMPTZ DEFAULT NOW(),
  "lastUpdatedAt" TIMESTAMPTZ DEFAULT NOW(),
  "confidenceLevel" TEXT DEFAULT 'low' CHECK ("confidenceLevel" IN ('low', 'medium', 'high')),
  "meetsAdjustmentThreshold" BOOLEAN DEFAULT FALSE
);

-- 2. USER EXERCISE USAGE TABLE
-- Tracks which exercises each user has performed (for unique user counts)
CREATE TABLE public.user_exercise_usage (
  "userId" UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  "exerciseName" TEXT NOT NULL,
  "firstUsedAt" TIMESTAMPTZ DEFAULT NOW(),
  "lastUsedAt" TIMESTAMPTZ DEFAULT NOW(),
  "totalAppearances" INTEGER DEFAULT 1,
  PRIMARY KEY ("userId", "exerciseName")
);

-- 3. POPULARITY CACHE TABLE
-- Single-row table with pre-computed scores for client fetching
CREATE TABLE public.popularity_cache (
  id INTEGER PRIMARY KEY DEFAULT 1,
  scores JSONB NOT NULL DEFAULT '{}',
  "generatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1,
  "totalWorkoutsAnalyzed" INTEGER DEFAULT 0,
  "totalUsersAnalyzed" INTEGER DEFAULT 0
);

-- 4. POPULARITY ADJUSTMENT LOG
-- History of when popularity was recalculated
CREATE TABLE public.popularity_adjustment_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "adjustmentDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  "exercisesAdjusted" INTEGER NOT NULL,
  "totalWorkoutsAnalyzed" INTEGER NOT NULL,
  "totalUniqueUsers" INTEGER NOT NULL,
  "adjustmentSummary" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PART 3: CREATE INDEXES
-- ============================================

CREATE INDEX idx_exercise_usage_popularity ON public.exercise_usage_stats("finalPopularityScore" DESC);
CREATE INDEX idx_exercise_usage_threshold ON public.exercise_usage_stats("meetsAdjustmentThreshold") WHERE "meetsAdjustmentThreshold" = TRUE;
CREATE INDEX idx_exercise_usage_last_updated ON public.exercise_usage_stats("lastUpdatedAt" DESC);
CREATE INDEX idx_user_exercise_usage_exercise ON public.user_exercise_usage("exerciseName");

-- ============================================
-- PART 4: ENABLE RLS
-- ============================================

ALTER TABLE public.exercise_usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_exercise_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.popularity_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.popularity_adjustment_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 5: CREATE POLICIES
-- ============================================

-- Exercise usage stats (public read - no sensitive data)
CREATE POLICY "Anyone can read exercise stats" ON public.exercise_usage_stats
  FOR SELECT USING (true);

-- User exercise usage (users see only their own)
CREATE POLICY "Users can view own exercise usage" ON public.user_exercise_usage
  FOR SELECT USING (auth.uid() = "userId");

-- Popularity cache (public read)
CREATE POLICY "Anyone can read popularity cache" ON public.popularity_cache
  FOR SELECT USING (true);

-- ============================================
-- PART 6: CREATE FUNCTIONS
-- ============================================

-- Function to normalize exercise names for consistent matching
CREATE OR REPLACE FUNCTION normalize_exercise_name(name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(trim(regexp_replace(name, '\s+', ' ', 'g')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update exercise usage when a workout exercise is logged
-- This triggers on INSERT to workout_log_exercises (the normalized table)
CREATE OR REPLACE FUNCTION update_exercise_usage_from_log_exercises()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_exercise_name TEXT;
  v_canonical_name TEXT;
  v_sets_completed INTEGER;
BEGIN
  -- Get the userId from the parent workout_logs row
  SELECT wl."userId" INTO v_user_id
  FROM public.workout_logs wl
  WHERE wl.id = NEW."workoutLogId";

  -- Skip if we can't find the parent workout
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get exercise name - adapt to your actual column names
  -- Common column names: exerciseName, exercise_name, name
  v_canonical_name := COALESCE(
    NEW."exerciseName",
    NEW."name",
    'unknown'
  );
  v_exercise_name := normalize_exercise_name(v_canonical_name);

  -- Get sets completed - adapt to your actual column names
  -- Common column names: setsCompleted, sets_completed, sets, completedSets
  v_sets_completed := COALESCE(
    NEW."setsCompleted",
    NEW."completedSets",
    NEW.sets,
    1
  );

  -- Skip empty names
  IF v_exercise_name IS NULL OR v_exercise_name = '' THEN
    RETURN NEW;
  END IF;

  -- Update or insert exercise stats
  INSERT INTO public.exercise_usage_stats (
    "exerciseName",
    "canonicalName",
    "totalWorkoutAppearances",
    "totalSetCompletions",
    "firstSeenAt",
    "lastUpdatedAt"
  )
  VALUES (v_exercise_name, v_canonical_name, 1, v_sets_completed, NOW(), NOW())
  ON CONFLICT ("exerciseName") DO UPDATE SET
    "totalWorkoutAppearances" = exercise_usage_stats."totalWorkoutAppearances" + 1,
    "totalSetCompletions" = exercise_usage_stats."totalSetCompletions" + EXCLUDED."totalSetCompletions",
    "lastUpdatedAt" = NOW();

  -- Track unique user usage
  INSERT INTO public.user_exercise_usage ("userId", "exerciseName", "firstUsedAt", "lastUsedAt", "totalAppearances")
  VALUES (v_user_id, v_exercise_name, NOW(), NOW(), 1)
  ON CONFLICT ("userId", "exerciseName") DO UPDATE SET
    "lastUsedAt" = NOW(),
    "totalAppearances" = user_exercise_usage."totalAppearances" + 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Popularity recalculation function (run periodically or manually)
CREATE OR REPLACE FUNCTION recalculate_popularity_scores()
RETURNS TABLE (
  exercises_updated INTEGER,
  threshold_met BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_total_workouts INTEGER;
  v_total_users INTEGER;
  v_updated_count INTEGER := 0;
  v_global_prior NUMERIC := 50;       -- Starting point (neutral)
  v_prior_strength NUMERIC := 100;    -- How much weight to give prior
  v_min_total_workouts INTEGER := 1000;
  v_min_total_users INTEGER := 100;
  v_min_exercise_appearances INTEGER := 100;
  v_min_exercise_users INTEGER := 50;
BEGIN
  -- Get global totals from workout_logs
  SELECT COUNT(*), COUNT(DISTINCT wl."userId")
  INTO v_total_workouts, v_total_users
  FROM public.workout_logs wl;

  -- Check if global threshold is met (law of large numbers)
  IF v_total_workouts < v_min_total_workouts OR v_total_users < v_min_total_users THEN
    RETURN QUERY SELECT
      0::INTEGER,
      FALSE,
      format('Threshold not met: %s workouts from %s users (need %s workouts from %s users)',
             v_total_workouts, v_total_users, v_min_total_workouts, v_min_total_users);
    RETURN;
  END IF;

  -- Update unique user counts for each exercise
  UPDATE public.exercise_usage_stats es SET
    "uniqueUserCount" = (
      SELECT COUNT(DISTINCT ueu."userId")
      FROM public.user_exercise_usage ueu
      WHERE ueu."exerciseName" = es."exerciseName"
    );

  -- Calculate raw popularity (appearances per 1000 workouts, capped at 100)
  UPDATE public.exercise_usage_stats SET
    "rawPopularityScore" = LEAST(100, ("totalWorkoutAppearances"::numeric / v_total_workouts * 1000));

  -- Apply Bayesian smoothing: (n × observed + prior_strength × prior) / (n + prior_strength)
  UPDATE public.exercise_usage_stats SET
    "bayesianAdjustedScore" = (
      ("uniqueUserCount" * "rawPopularityScore" + v_prior_strength * v_global_prior)
      / ("uniqueUserCount" + v_prior_strength)
    );

  -- Set confidence levels and threshold status
  UPDATE public.exercise_usage_stats SET
    "confidenceLevel" = CASE
      WHEN "uniqueUserCount" >= 500 THEN 'high'
      WHEN "uniqueUserCount" >= 100 THEN 'medium'
      ELSE 'low'
    END,
    "meetsAdjustmentThreshold" = (
      "totalWorkoutAppearances" >= v_min_exercise_appearances
      AND "uniqueUserCount" >= v_min_exercise_users
    );

  -- Final score = Bayesian score for exercises meeting threshold, else 50 (neutral)
  UPDATE public.exercise_usage_stats SET
    "finalPopularityScore" = CASE
      WHEN "meetsAdjustmentThreshold" THEN "bayesianAdjustedScore"
      ELSE 50
    END;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- Update popularity cache (single row with all scores)
  INSERT INTO public.popularity_cache (id, scores, "generatedAt", version, "totalWorkoutsAnalyzed", "totalUsersAnalyzed")
  VALUES (
    1,
    (SELECT COALESCE(jsonb_object_agg("exerciseName", ROUND("finalPopularityScore", 2)), '{}')
     FROM public.exercise_usage_stats
     WHERE "meetsAdjustmentThreshold" = TRUE),
    NOW(),
    COALESCE((SELECT version FROM public.popularity_cache WHERE id = 1), 0) + 1,
    v_total_workouts,
    v_total_users
  )
  ON CONFLICT (id) DO UPDATE SET
    scores = EXCLUDED.scores,
    "generatedAt" = NOW(),
    version = popularity_cache.version + 1,
    "totalWorkoutsAnalyzed" = v_total_workouts,
    "totalUsersAnalyzed" = v_total_users;

  -- Log the adjustment for auditing
  INSERT INTO public.popularity_adjustment_log (
    "exercisesAdjusted",
    "totalWorkoutsAnalyzed",
    "totalUniqueUsers",
    "adjustmentSummary"
  )
  SELECT
    COUNT(*) FILTER (WHERE "meetsAdjustmentThreshold"),
    v_total_workouts,
    v_total_users,
    COALESCE(jsonb_agg(jsonb_build_object(
      'exercise', "exerciseName",
      'score', ROUND("finalPopularityScore", 2),
      'users', "uniqueUserCount",
      'appearances', "totalWorkoutAppearances"
    )) FILTER (WHERE "meetsAdjustmentThreshold"), '[]')
  FROM public.exercise_usage_stats;

  RETURN QUERY SELECT
    v_updated_count,
    TRUE,
    format('Updated %s exercises. %s meet adjustment threshold.',
           v_updated_count,
           (SELECT COUNT(*) FROM public.exercise_usage_stats WHERE "meetsAdjustmentThreshold"));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 7: CREATE TRIGGER ON EXISTING TABLE
-- ============================================

-- This trigger fires when exercises are added to workout_log_exercises
-- It updates the popularity tracking tables
CREATE TRIGGER on_workout_exercise_logged
  AFTER INSERT ON public.workout_log_exercises
  FOR EACH ROW EXECUTE FUNCTION update_exercise_usage_from_log_exercises();

-- ============================================
-- PART 8: INITIALIZE DATA
-- ============================================

-- Initialize popularity cache with empty data
INSERT INTO public.popularity_cache (id, scores, "generatedAt", version)
VALUES (1, '{}', NOW(), 1)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DONE!
--
-- What this script created:
-- - exercise_usage_stats: Tracks popularity metrics for each exercise
-- - user_exercise_usage: Tracks which users have done which exercises
-- - popularity_cache: Pre-computed scores for client fetching
-- - popularity_adjustment_log: History of recalculations
-- - Trigger on workout_log_exercises to update stats automatically
--
-- To recalculate popularity scores manually, run:
--   SELECT * FROM recalculate_popularity_scores();
-- ============================================
