-- ============================================
-- Workout Classes Database Schema
-- ============================================
-- Enables coaches to run group workout sessions with multiple athletes.
-- Supplements the existing 1:1 assigned workouts flow with N:1 class support.
--
-- Tables:
-- 1. class_templates - Reusable workout plans for classes
-- 2. class_sessions - Scheduled class instances
-- 3. class_participants - Athlete reservations for sessions
-- 4. class_participant_plans - Per-athlete planned exercises
-- 5. class_checkins - Check-in records
-- 6. class_workout_logs - Per-athlete completion records

-- ============================================
-- 1. Class Templates Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.class_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,

  -- Template info
  name TEXT NOT NULL,
  description TEXT,
  
  -- Workout content (reusable blueprint)
  exercises_json JSONB NOT NULL DEFAULT '[]',
  
  -- Duration estimate (minutes)
  estimated_duration_minutes INTEGER DEFAULT 60,
  
  -- Capacity defaults
  default_capacity INTEGER DEFAULT 20,
  
  -- Tags for filtering
  tags TEXT[] DEFAULT '{}',
  
  -- Usage tracking
  times_used INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_class_templates_coach_id
  ON public.class_templates(coach_id);

-- ============================================
-- 2. Class Sessions Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.class_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.class_templates(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,

  -- Session info (copied from template, can be customized)
  name TEXT NOT NULL,
  description TEXT,
  
  -- Scheduling
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  timezone TEXT DEFAULT 'America/New_York',
  
  -- Capacity
  capacity INTEGER NOT NULL DEFAULT 20,
  current_participant_count INTEGER DEFAULT 0,
  
  -- Workout content (snapshot from template, can be modified)
  exercises_json JSONB NOT NULL DEFAULT '[]',
  
  -- Notification settings
  reminder_minutes INTEGER DEFAULT 30,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'canceled')),
  
  -- Change tracking (for notifications)
  change_version INTEGER DEFAULT 1,
  
  -- Location (optional)
  location_name TEXT,
  location_address TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_class_sessions_template_id
  ON public.class_sessions(template_id);

CREATE INDEX IF NOT EXISTS idx_class_sessions_coach_id
  ON public.class_sessions(coach_id);

CREATE INDEX IF NOT EXISTS idx_class_sessions_start_at
  ON public.class_sessions(start_at);

CREATE INDEX IF NOT EXISTS idx_class_sessions_status
  ON public.class_sessions(status) WHERE status IN ('scheduled', 'in_progress');

-- ============================================
-- 3. Class Participants Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.class_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  athlete_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Status
  status TEXT NOT NULL DEFAULT 'joined'
    CHECK (status IN ('joined', 'waitlisted', 'canceled')),
  
  -- Join tracking
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  canceled_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one participant per session
  CONSTRAINT unique_session_participant UNIQUE (session_id, athlete_user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_class_participants_session_id
  ON public.class_participants(session_id);

CREATE INDEX IF NOT EXISTS idx_class_participants_athlete_id
  ON public.class_participants(athlete_user_id);

CREATE INDEX IF NOT EXISTS idx_class_participants_status
  ON public.class_participants(status) WHERE status = 'joined';

-- ============================================
-- 4. Class Participant Plans Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.class_participant_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  athlete_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Per-athlete planned exercises (coach can customize)
  planned_exercises_json JSONB NOT NULL DEFAULT '[]',
  
  -- Source of the plan
  source TEXT NOT NULL DEFAULT 'default'
    CHECK (source IN ('default', 'history', 'coach_override')),
  
  -- Version tracking
  plan_version INTEGER DEFAULT 1,
  
  -- Coach notes for this specific athlete
  coach_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one plan per athlete per session
  CONSTRAINT unique_participant_plan UNIQUE (session_id, athlete_user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_class_participant_plans_session_id
  ON public.class_participant_plans(session_id);

CREATE INDEX IF NOT EXISTS idx_class_participant_plans_athlete_id
  ON public.class_participant_plans(athlete_user_id);

-- ============================================
-- 5. Class Checkins Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.class_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  athlete_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Check-in details
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Method
  method TEXT NOT NULL DEFAULT 'tap'
    CHECK (method IN ('tap', 'code', 'qr', 'manual')),
  
  -- Code used (if method = 'code')
  code_used TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one check-in per athlete per session
  CONSTRAINT unique_session_checkin UNIQUE (session_id, athlete_user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_class_checkins_session_id
  ON public.class_checkins(session_id);

CREATE INDEX IF NOT EXISTS idx_class_checkins_athlete_id
  ON public.class_checkins(athlete_user_id);

-- ============================================
-- 6. Class Workout Logs Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.class_workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  athlete_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Workout content
  exercises_json JSONB NOT NULL DEFAULT '[]',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'reviewed', 'auto_completed')),
  
  -- Completion tracking
  reviewed_at TIMESTAMPTZ,
  auto_completed_at TIMESTAMPTZ,
  
  -- Feedback
  athlete_feedback TEXT,
  athlete_rating INTEGER CHECK (athlete_rating BETWEEN 1 AND 5),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one log per athlete per session
  CONSTRAINT unique_session_workout_log UNIQUE (session_id, athlete_user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_class_workout_logs_session_id
  ON public.class_workout_logs(session_id);

CREATE INDEX IF NOT EXISTS idx_class_workout_logs_athlete_id
  ON public.class_workout_logs(athlete_user_id);

CREATE INDEX IF NOT EXISTS idx_class_workout_logs_status
  ON public.class_workout_logs(status) WHERE status = 'pending_review';

-- ============================================
-- 7. Row Level Security Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.class_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_participant_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_workout_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- Class Templates Policies
-- ----------------------------------------

-- Coaches can view their own templates
CREATE POLICY "Coaches can view own templates"
  ON public.class_templates FOR SELECT
  USING (
    coach_id IN (
      SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
    )
  );

-- Coaches can create templates
CREATE POLICY "Coaches can create templates"
  ON public.class_templates FOR INSERT
  WITH CHECK (
    coach_id IN (
      SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
    )
  );

-- Coaches can update their templates
CREATE POLICY "Coaches can update own templates"
  ON public.class_templates FOR UPDATE
  USING (
    coach_id IN (
      SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
    )
  );

-- Coaches can delete their templates
CREATE POLICY "Coaches can delete own templates"
  ON public.class_templates FOR DELETE
  USING (
    coach_id IN (
      SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
    )
  );

-- ----------------------------------------
-- Class Sessions Policies
-- ----------------------------------------

-- Coaches can view their own sessions
CREATE POLICY "Coaches can view own sessions"
  ON public.class_sessions FOR SELECT
  USING (
    coach_id IN (
      SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
    )
  );

-- Athletes can view sessions they're participating in
CREATE POLICY "Athletes can view joined sessions"
  ON public.class_sessions FOR SELECT
  USING (
    id IN (
      SELECT session_id FROM public.class_participants
      WHERE athlete_user_id = auth.uid() AND status = 'joined'
    )
  );

-- Coaches can create sessions
CREATE POLICY "Coaches can create sessions"
  ON public.class_sessions FOR INSERT
  WITH CHECK (
    coach_id IN (
      SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
    )
  );

-- Coaches can update their sessions
CREATE POLICY "Coaches can update own sessions"
  ON public.class_sessions FOR UPDATE
  USING (
    coach_id IN (
      SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
    )
  );

-- Coaches can delete their sessions
CREATE POLICY "Coaches can delete own sessions"
  ON public.class_sessions FOR DELETE
  USING (
    coach_id IN (
      SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
    )
  );

-- ----------------------------------------
-- Class Participants Policies
-- ----------------------------------------

-- Coaches can view participants in their sessions
CREATE POLICY "Coaches can view session participants"
  ON public.class_participants FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM public.class_sessions
      WHERE coach_id IN (
        SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Athletes can view their own participation
CREATE POLICY "Athletes can view own participation"
  ON public.class_participants FOR SELECT
  USING (athlete_user_id = auth.uid());

-- Athletes can join sessions (insert)
CREATE POLICY "Athletes can join sessions"
  ON public.class_participants FOR INSERT
  WITH CHECK (athlete_user_id = auth.uid());

-- Athletes can update their participation (cancelation)
CREATE POLICY "Athletes can update own participation"
  ON public.class_participants FOR UPDATE
  USING (athlete_user_id = auth.uid());

-- ----------------------------------------
-- Class Participant Plans Policies
-- ----------------------------------------

-- Coaches can view plans in their sessions
CREATE POLICY "Coaches can view session plans"
  ON public.class_participant_plans FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM public.class_sessions
      WHERE coach_id IN (
        SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Athletes can view their own plans
CREATE POLICY "Athletes can view own plans"
  ON public.class_participant_plans FOR SELECT
  USING (athlete_user_id = auth.uid());

-- Coaches can create plans
CREATE POLICY "Coaches can create plans"
  ON public.class_participant_plans FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM public.class_sessions
      WHERE coach_id IN (
        SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Coaches can update plans
CREATE POLICY "Coaches can update plans"
  ON public.class_participant_plans FOR UPDATE
  USING (
    session_id IN (
      SELECT id FROM public.class_sessions
      WHERE coach_id IN (
        SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- ----------------------------------------
-- Class Checkins Policies
-- ----------------------------------------

-- Coaches can view checkins for their sessions
CREATE POLICY "Coaches can view session checkins"
  ON public.class_checkins FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM public.class_sessions
      WHERE coach_id IN (
        SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Athletes can view their own checkins
CREATE POLICY "Athletes can view own checkins"
  ON public.class_checkins FOR SELECT
  USING (athlete_user_id = auth.uid());

-- Athletes can check in
CREATE POLICY "Athletes can check in"
  ON public.class_checkins FOR INSERT
  WITH CHECK (athlete_user_id = auth.uid());

-- ----------------------------------------
-- Class Workout Logs Policies
-- ----------------------------------------

-- Coaches can view logs for their sessions
CREATE POLICY "Coaches can view session logs"
  ON public.class_workout_logs FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM public.class_sessions
      WHERE coach_id IN (
        SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Athletes can view their own logs
CREATE POLICY "Athletes can view own logs"
  ON public.class_workout_logs FOR SELECT
  USING (athlete_user_id = auth.uid());

-- System creates logs (via edge function), so we use coach's context
CREATE POLICY "Coaches can create logs"
  ON public.class_workout_logs FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM public.class_sessions
      WHERE coach_id IN (
        SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Athletes can update their own logs (review flow)
CREATE POLICY "Athletes can update own logs"
  ON public.class_workout_logs FOR UPDATE
  USING (athlete_user_id = auth.uid());

-- ============================================
-- 8. Triggers
-- ============================================

-- Apply updated_at triggers
CREATE TRIGGER trigger_class_templates_updated
  BEFORE UPDATE ON public.class_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_class_sessions_updated
  BEFORE UPDATE ON public.class_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_class_participants_updated
  BEFORE UPDATE ON public.class_participants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_class_participant_plans_updated
  BEFORE UPDATE ON public.class_participant_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_class_workout_logs_updated
  BEFORE UPDATE ON public.class_workout_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------
-- Participant count management
-- ----------------------------------------

CREATE OR REPLACE FUNCTION update_session_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.class_sessions
    SET current_participant_count = (
      SELECT COUNT(*) FROM public.class_participants
      WHERE session_id = NEW.session_id AND status = 'joined'
    )
    WHERE id = NEW.session_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE public.class_sessions
    SET current_participant_count = (
      SELECT COUNT(*) FROM public.class_participants
      WHERE session_id = OLD.session_id AND status = 'joined'
    )
    WHERE id = OLD.session_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_participant_count
  AFTER INSERT OR UPDATE OR DELETE ON public.class_participants
  FOR EACH ROW EXECUTE FUNCTION update_session_participant_count();

-- ----------------------------------------
-- Template usage count
-- ----------------------------------------

CREATE OR REPLACE FUNCTION update_template_usage_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.class_templates
    SET times_used = times_used + 1
    WHERE id = NEW.template_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_template_usage
  AFTER INSERT ON public.class_sessions
  FOR EACH ROW EXECUTE FUNCTION update_template_usage_count();
