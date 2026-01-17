-- Paths Progression Migration
-- Creates tables for gamified paths, lift stats tracking, and plan adaptation
-- Includes idempotency guards and offline-first support

-- ============================================
-- lift_stats: per-exercise strength tracking
-- ============================================
CREATE TABLE IF NOT EXISTS lift_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_key TEXT NOT NULL,  -- normalized: name.toLowerCase().replace(/\s+/g, '_')
  e1rm_kg NUMERIC(6,2),
  training_max_kg NUMERIC(6,2),
  ewma_e1rm_kg NUMERIC(6,2),   -- exponential weighted moving average
  volatility NUMERIC(6,4),      -- for adaptation confidence
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, exercise_key)
);

-- ============================================
-- user_path_instances: active path enrollments
-- ============================================
CREATE TABLE IF NOT EXISTS user_path_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id TEXT NOT NULL,
  challenge_id TEXT REFERENCES challenge_templates(id),
  tier TEXT CHECK (tier IN ('base','silver','gold','diamond')) DEFAULT 'base',
  status TEXT CHECK (status IN ('active','paused','completed','failed')) DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  config_json JSONB DEFAULT '{}'
);

-- Only one active path per user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_one_active_path
  ON user_path_instances(user_id) WHERE status = 'active';

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_path_instance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS path_instance_updated ON user_path_instances;
CREATE TRIGGER path_instance_updated
  BEFORE UPDATE ON user_path_instances
  FOR EACH ROW EXECUTE FUNCTION update_path_instance_timestamp();

-- ============================================
-- user_path_node_progress: per-node completion
-- ============================================
CREATE TABLE IF NOT EXISTS user_path_node_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  path_instance_id UUID REFERENCES user_path_instances(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  status TEXT CHECK (status IN ('locked','available','completed','skipped')) DEFAULT 'locked',
  completed_at TIMESTAMPTZ,
  progress_json JSONB DEFAULT '{}',
  UNIQUE(path_instance_id, node_id)
);

-- ============================================
-- plan_deltas: adaptation recommendations
-- ============================================
CREATE TABLE IF NOT EXISTS plan_deltas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  workout_id UUID NOT NULL,  -- Required for idempotency
  program_instance_id UUID,
  source TEXT CHECK (source IN ('assigned','self')) DEFAULT 'self',
  delta_json JSONB NOT NULL,
  UNIQUE(user_id, workout_id, source)  -- Full unique constraint since workout_id is NOT NULL
);

-- ============================================
-- processed_workouts: idempotency guard for XP
-- ============================================
CREATE TABLE IF NOT EXISTS processed_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id UUID NOT NULL,
  source TEXT CHECK (source IN ('assigned','self')) NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now(),
  xp_awarded INT DEFAULT 0,
  UNIQUE(user_id, workout_id, source)
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_lift_stats_user ON lift_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_path_instances_user_status ON user_path_instances(user_id, status);
CREATE INDEX IF NOT EXISTS idx_path_node_progress_instance ON user_path_node_progress(path_instance_id);
CREATE INDEX IF NOT EXISTS idx_plan_deltas_user ON plan_deltas(user_id);
CREATE INDEX IF NOT EXISTS idx_processed_workouts_user ON processed_workouts(user_id);

-- ============================================
-- RLS Policies (with INSERT protection via WITH CHECK)
-- ============================================
ALTER TABLE lift_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_path_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_path_node_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_deltas ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_workouts ENABLE ROW LEVEL SECURITY;

-- lift_stats
DROP POLICY IF EXISTS "lift_stats_own" ON lift_stats;
CREATE POLICY "lift_stats_own" ON lift_stats
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- user_path_instances
DROP POLICY IF EXISTS "path_instances_own" ON user_path_instances;
CREATE POLICY "path_instances_own" ON user_path_instances
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- user_path_node_progress
DROP POLICY IF EXISTS "path_node_progress_own" ON user_path_node_progress;
CREATE POLICY "path_node_progress_own" ON user_path_node_progress
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- plan_deltas
DROP POLICY IF EXISTS "plan_deltas_own" ON plan_deltas;
CREATE POLICY "plan_deltas_own" ON plan_deltas
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- processed_workouts
DROP POLICY IF EXISTS "processed_workouts_own" ON processed_workouts;
CREATE POLICY "processed_workouts_own" ON processed_workouts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
