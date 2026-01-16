-- Coach Workflow System Migration
-- Adds support for quick workouts, scheduled times, and notification tracking

-- ============================================
-- QUICK WORKOUTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS coach_quick_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES coach_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  exercises JSONB NOT NULL DEFAULT '[]',
  estimated_duration INTEGER, -- minutes
  times_assigned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for coach lookup
CREATE INDEX IF NOT EXISTS idx_quick_workouts_coach ON coach_quick_workouts(coach_id);

-- RLS policies
ALTER TABLE coach_quick_workouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coaches manage own quick workouts" ON coach_quick_workouts;

-- Coaches can manage their own quick workouts
CREATE POLICY "Coaches manage own quick workouts"
  ON coach_quick_workouts
  FOR ALL
  USING (coach_id IN (
    SELECT id FROM coach_profiles WHERE user_id = auth.uid()
  ));

-- ============================================
-- ASSIGNED WORKOUTS EXTENSIONS
-- ============================================

-- Add scheduled time column (optional specific time for workout)
ALTER TABLE assigned_workouts
  ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMPTZ;

-- Add notification tracking columns
ALTER TABLE assigned_workouts
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE;

ALTER TABLE assigned_workouts
  ADD COLUMN IF NOT EXISTS incomplete_notification_sent BOOLEAN DEFAULT FALSE;

-- Index for finding workouts needing reminders or incomplete notifications
CREATE INDEX IF NOT EXISTS idx_assigned_workouts_pending_notifications
  ON assigned_workouts(scheduled_date, scheduled_time, reminder_sent, incomplete_notification_sent)
  WHERE status IN ('pending', 'in_progress');

-- ============================================
-- QUICK WORKOUT ASSIGNMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS quick_workout_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quick_workout_id UUID NOT NULL REFERENCES coach_quick_workouts(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES coach_profiles(id) ON DELETE CASCADE,
  athlete_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  scheduled_time TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  actual_results JSONB DEFAULT '{}',
  athlete_feedback TEXT,
  athlete_rating INTEGER,
  coach_notes TEXT,
  reminder_sent BOOLEAN DEFAULT FALSE,
  incomplete_notification_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for quick workout assignments
CREATE INDEX IF NOT EXISTS idx_quick_workout_assignments_athlete
  ON quick_workout_assignments(athlete_user_id, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_quick_workout_assignments_coach
  ON quick_workout_assignments(coach_id, scheduled_date);

-- RLS policies
ALTER TABLE quick_workout_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coaches manage own quick workout assignments" ON quick_workout_assignments;
DROP POLICY IF EXISTS "Athletes view own quick workout assignments" ON quick_workout_assignments;
DROP POLICY IF EXISTS "Athletes update own quick workout assignments" ON quick_workout_assignments;

-- Coaches can manage assignments they created
CREATE POLICY "Coaches manage own quick workout assignments"
  ON quick_workout_assignments
  FOR ALL
  USING (coach_id IN (
    SELECT id FROM coach_profiles WHERE user_id = auth.uid()
  ));

-- Athletes can view and update their own assignments
CREATE POLICY "Athletes view own quick workout assignments"
  ON quick_workout_assignments
  FOR SELECT
  USING (athlete_user_id = auth.uid());

CREATE POLICY "Athletes update own quick workout assignments"
  ON quick_workout_assignments
  FOR UPDATE
  USING (athlete_user_id = auth.uid())
  WITH CHECK (athlete_user_id = auth.uid());

-- ============================================
-- TRIGGER FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to new tables
DROP TRIGGER IF EXISTS update_quick_workouts_updated_at ON coach_quick_workouts;
CREATE TRIGGER update_quick_workouts_updated_at
  BEFORE UPDATE ON coach_quick_workouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quick_workout_assignments_updated_at ON quick_workout_assignments;
CREATE TRIGGER update_quick_workout_assignments_updated_at
  BEFORE UPDATE ON quick_workout_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
