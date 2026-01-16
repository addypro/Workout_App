-- Challenges Feature Migration
-- Creates tables for the Challenges system

-- ============================================
-- CHALLENGE TEMPLATES (Admin-defined)
-- ============================================

CREATE TABLE IF NOT EXISTS challenge_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('strength', 'volume', 'endurance', 'hybrid')),
  duration_days INT, -- NULL = unlimited (milestone-based)
  rules JSONB NOT NULL DEFAULT '{}',
  -- rules schema:
  -- {
  --   "resetOnMiss": boolean,        -- Iron Will: reset to day 1 if missed
  --   "workoutsPerDay": number,      -- Required workouts per day
  --   "verification": string,        -- 'pr_sum' | 'pr_detector' | 'voice_log' | 'none'
  --   "prSumTarget": number,         -- Target PR sum for strength challenges
  --   "requiredExercises": string[]  -- Required exercises for PR-based
  -- }
  path_config JSONB NOT NULL DEFAULT '{}',
  -- path_config schema:
  -- {
  --   "workouts": [{ id, name, type, week, day, threshold }],
  --   "checkpointInterval": number,
  --   "bossNode": { id, name, type }
  -- }
  badge_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- USER CHALLENGES
-- ============================================

CREATE TABLE IF NOT EXISTS user_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id TEXT REFERENCES challenge_templates(id),
  path_id TEXT, -- Links to Pathfinder path
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  current_day INT DEFAULT 1,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
  metadata JSONB DEFAULT '{}',
  -- metadata schema:
  -- {
  --   "currentPRSum": number,
  --   "lastActivityDate": string,
  --   "workoutsToday": number
  -- }
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, template_id, start_date)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_challenges_user_id ON user_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_challenges_status ON user_challenges(status);
CREATE INDEX IF NOT EXISTS idx_user_challenges_template ON user_challenges(template_id);
CREATE INDEX IF NOT EXISTS idx_challenge_templates_active ON challenge_templates(is_active);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE challenge_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_challenges ENABLE ROW LEVEL SECURITY;

-- Anyone can read active templates
CREATE POLICY "challenge_templates_public_read" ON challenge_templates
  FOR SELECT
  USING (is_active = true);

-- Users can read/manage their own challenges
CREATE POLICY "user_challenges_select_own" ON user_challenges
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_challenges_insert_own" ON user_challenges
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_challenges_update_own" ON user_challenges
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "user_challenges_delete_own" ON user_challenges
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- SEED DATA: Challenge Templates
-- ============================================

INSERT INTO challenge_templates (id, name, description, category, duration_days, rules, path_config, badge_id)
VALUES
  (
    'iron-will-75',
    'The Iron Will 75',
    '75 Days. 2 Workouts/Day. No Exceptions. Miss a day? Start over.',
    'volume',
    75,
    '{"resetOnMiss": true, "workoutsPerDay": 2, "verification": "voice_log"}',
    '{"checkpointInterval": 7}',
    'iron-mind-badge'
  ),
  (
    '1000lb-club',
    'The 1000lb Club',
    'Bench + Squat + Deadlift = 1000 lbs. Join the elite.',
    'strength',
    NULL,
    '{"verification": "pr_sum", "prSumTarget": 1000, "requiredExercises": ["bench press", "squat", "deadlift"]}',
    '{"workouts": [{"id": "base-camp", "name": "Base Camp", "type": "checkpoint", "threshold": 500}, {"id": "the-climb", "name": "The Climb", "type": "milestone", "threshold": 750}, {"id": "the-summit", "name": "The Summit", "type": "boss", "threshold": 1000}]}',
    '1000lb-club-badge'
  ),
  (
    'runners-awakening',
    'The Runner''s Awakening',
    '8 weeks from couch to 5K. Start walking, finish running.',
    'endurance',
    56,
    '{"verification": "voice_log", "workoutsPerDay": 1}',
    '{"checkpointInterval": 7}',
    'endurance-badge'
  ),
  (
    'hyrox-engine',
    'The Hyrox Engine',
    '12 weeks of hybrid training. Running meets functional fitness.',
    'hybrid',
    84,
    '{"verification": "voice_log", "workoutsPerDay": 1}',
    '{"checkpointInterval": 7}',
    'hyrox-engine-badge'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to increment challenge day
CREATE OR REPLACE FUNCTION increment_challenge_day(
  p_challenge_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_challenges
  SET 
    current_day = current_day + 1,
    updated_at = now()
  WHERE id = p_challenge_id
    AND auth.uid() = user_id;
END;
$$;

-- Function to reset challenge (Iron Will failure)
CREATE OR REPLACE FUNCTION reset_challenge(
  p_challenge_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_challenges
  SET 
    current_day = 1,
    metadata = jsonb_set(COALESCE(metadata, '{}'), '{workoutsToday}', '0'),
    updated_at = now()
  WHERE id = p_challenge_id
    AND auth.uid() = user_id;
END;
$$;

-- Function to complete a challenge
CREATE OR REPLACE FUNCTION complete_challenge(
  p_challenge_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_challenges
  SET 
    status = 'completed',
    updated_at = now()
  WHERE id = p_challenge_id
    AND auth.uid() = user_id;
END;
$$;
