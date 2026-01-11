-- ============================================
-- Coach Feature Database Schema
-- ============================================
-- Enables coaches to manage athletes and share workout programs
-- with subscription-based tier limits (Starter: 10, Pro: 50, Elite: unlimited)
--
-- Tables:
-- 1. coach_profiles - Coach user data and subscription info
-- 2. coach_athletes - Coach-athlete relationships
-- 3. coach_programs - Workout programs created by coaches
-- 4. program_assignments - Programs assigned to athletes
-- 5. assigned_workouts - Individual workouts within assignments
-- 6. coach_exercises - Custom exercises created by coaches
-- 7. coach_invites - Invite codes and links for athlete onboarding

-- ============================================
-- 1. Coach Profiles Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.coach_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Profile info
  display_name TEXT NOT NULL,
  business_name TEXT,
  bio TEXT,
  specializations TEXT[] DEFAULT '{}',
  avatar_url TEXT,

  -- Stripe subscription
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'trial'
    CHECK (subscription_tier IN ('trial', 'starter', 'pro', 'elite')),
  subscription_status TEXT DEFAULT 'active'
    CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'incomplete')),

  -- Tier limits
  max_athletes INTEGER NOT NULL DEFAULT 50,
  current_athlete_count INTEGER NOT NULL DEFAULT 0,

  -- Trial tracking
  trial_started_at TIMESTAMPTZ DEFAULT NOW(),
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_coach_profiles_user_id
  ON public.coach_profiles(user_id);

-- Index for Stripe lookups
CREATE INDEX IF NOT EXISTS idx_coach_profiles_stripe_customer
  ON public.coach_profiles(stripe_customer_id);

-- ============================================
-- 2. Coach Athletes Relationship Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.coach_athletes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
  athlete_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Invite tracking
  invite_method TEXT NOT NULL CHECK (invite_method IN ('code', 'link', 'email')),
  invite_code TEXT UNIQUE,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'removed', 'left')),

  -- Permissions (controlled by athlete)
  share_workout_history BOOLEAN DEFAULT false,
  share_body_metrics BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one athlete per coach
  CONSTRAINT unique_coach_athlete UNIQUE (coach_id, athlete_user_id)
);

-- Index for coach lookups
CREATE INDEX IF NOT EXISTS idx_coach_athletes_coach_id
  ON public.coach_athletes(coach_id);

-- Index for athlete lookups
CREATE INDEX IF NOT EXISTS idx_coach_athletes_athlete_id
  ON public.coach_athletes(athlete_user_id);

-- Index for invite code lookups
CREATE INDEX IF NOT EXISTS idx_coach_athletes_invite_code
  ON public.coach_athletes(invite_code) WHERE invite_code IS NOT NULL;

-- ============================================
-- 3. Coach Invites Table (for link/email invites)
-- ============================================

CREATE TABLE IF NOT EXISTS public.coach_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,

  -- Invite details
  invite_type TEXT NOT NULL CHECK (invite_type IN ('code', 'link', 'email')),
  invite_code TEXT UNIQUE NOT NULL,
  invite_link_token TEXT UNIQUE,
  email TEXT,

  -- Usage limits
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,

  -- Expiration
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for code lookups
CREATE INDEX IF NOT EXISTS idx_coach_invites_code
  ON public.coach_invites(invite_code);

-- Index for link token lookups
CREATE INDEX IF NOT EXISTS idx_coach_invites_token
  ON public.coach_invites(invite_link_token) WHERE invite_link_token IS NOT NULL;

-- ============================================
-- 4. Coach Programs Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.coach_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,

  -- Program info
  name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN (
    'strength', 'hypertrophy', 'powerlifting', 'bodybuilding',
    'crossfit', 'sport_specific', 'rehabilitation', 'general_fitness'
  )),
  sport TEXT, -- For sport_specific programs (e.g., 'basketball', 'football')
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced', 'elite')),

  -- Duration
  duration_weeks INTEGER,
  days_per_week INTEGER CHECK (days_per_week BETWEEN 1 AND 7),

  -- Program structure (JSON array of workout templates)
  workouts JSONB NOT NULL DEFAULT '[]',

  -- Visibility
  is_template BOOLEAN DEFAULT false, -- Can be reused/assigned multiple times
  is_public BOOLEAN DEFAULT false,   -- Visible to other coaches (future marketplace)

  -- Stats
  times_assigned INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for coach lookups
CREATE INDEX IF NOT EXISTS idx_coach_programs_coach_id
  ON public.coach_programs(coach_id);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_coach_programs_category
  ON public.coach_programs(category);

-- ============================================
-- 5. Program Assignments Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.program_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.coach_programs(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
  athlete_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Assignment details
  start_date DATE NOT NULL,
  end_date DATE,
  current_week INTEGER DEFAULT 1,

  -- Status
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'paused', 'completed', 'canceled')),

  -- Customization (athlete-specific modifications)
  modifications JSONB DEFAULT '{}',

  -- Notes
  coach_notes TEXT,
  athlete_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for athlete lookups
CREATE INDEX IF NOT EXISTS idx_program_assignments_athlete
  ON public.program_assignments(athlete_user_id);

-- Index for coach lookups
CREATE INDEX IF NOT EXISTS idx_program_assignments_coach
  ON public.program_assignments(coach_id);

-- Index for active assignments
CREATE INDEX IF NOT EXISTS idx_program_assignments_status
  ON public.program_assignments(status) WHERE status = 'active';

-- ============================================
-- 6. Assigned Workouts Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.assigned_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.program_assignments(id) ON DELETE CASCADE,
  athlete_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Workout details
  scheduled_date DATE NOT NULL,
  week_number INTEGER NOT NULL,
  day_number INTEGER NOT NULL,
  workout_name TEXT NOT NULL,

  -- Workout content (exercises, sets, reps, etc.)
  exercises JSONB NOT NULL DEFAULT '[]',

  -- Status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),

  -- Completion tracking
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Results (logged by athlete)
  actual_results JSONB DEFAULT '{}',

  -- Feedback
  athlete_feedback TEXT,
  athlete_rating INTEGER CHECK (athlete_rating BETWEEN 1 AND 5),
  coach_feedback TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for athlete lookups
CREATE INDEX IF NOT EXISTS idx_assigned_workouts_athlete
  ON public.assigned_workouts(athlete_user_id);

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_assigned_workouts_date
  ON public.assigned_workouts(scheduled_date);

-- Index for assignment lookups
CREATE INDEX IF NOT EXISTS idx_assigned_workouts_assignment
  ON public.assigned_workouts(assignment_id);

-- ============================================
-- 7. Coach Exercises Table (Custom Exercises)
-- ============================================

CREATE TABLE IF NOT EXISTS public.coach_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,

  -- Exercise info
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  description TEXT,
  instructions TEXT,

  -- Categorization
  equipment TEXT[] DEFAULT '{}',
  muscle_groups TEXT[] DEFAULT '{}',
  movement_pattern TEXT,
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced', 'elite')),

  -- Media
  video_url TEXT,        -- YouTube or other video link
  thumbnail_url TEXT,
  demo_images TEXT[] DEFAULT '{}',

  -- Sport-specific tags
  sport_tags TEXT[] DEFAULT '{}',

  -- Visibility
  share_with_athletes BOOLEAN DEFAULT true, -- Athletes can see this exercise

  -- Usage tracking
  usage_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique per coach
  CONSTRAINT unique_coach_exercise UNIQUE (coach_id, normalized_name)
);

-- Index for coach lookups
CREATE INDEX IF NOT EXISTS idx_coach_exercises_coach_id
  ON public.coach_exercises(coach_id);

-- Index for name search
CREATE INDEX IF NOT EXISTS idx_coach_exercises_name
  ON public.coach_exercises(normalized_name);

-- ============================================
-- 8. Row Level Security Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.coach_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assigned_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_exercises ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- Coach Profiles Policies
-- ----------------------------------------

-- Coaches can view their own profile
CREATE POLICY "Coaches can view own profile"
  ON public.coach_profiles FOR SELECT
  USING (user_id = auth.uid());

-- Coaches can insert their own profile
CREATE POLICY "Coaches can create own profile"
  ON public.coach_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Coaches can update their own profile
CREATE POLICY "Coaches can update own profile"
  ON public.coach_profiles FOR UPDATE
  USING (user_id = auth.uid());

-- Athletes can view their coach's profile
CREATE POLICY "Athletes can view their coach profile"
  ON public.coach_profiles FOR SELECT
  USING (
    id IN (
      SELECT coach_id FROM public.coach_athletes
      WHERE athlete_user_id = auth.uid() AND status = 'active'
    )
  );

-- ----------------------------------------
-- Coach Athletes Policies
-- ----------------------------------------

-- Coaches can view their athletes
CREATE POLICY "Coaches can view their athletes"
  ON public.coach_athletes FOR SELECT
  USING (
    coach_id IN (
      SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
    )
  );

-- Athletes can view their coach relationship
CREATE POLICY "Athletes can view their coach relationship"
  ON public.coach_athletes FOR SELECT
  USING (athlete_user_id = auth.uid());

-- Coaches can create athlete relationships
CREATE POLICY "Coaches can invite athletes"
  ON public.coach_athletes FOR INSERT
  WITH CHECK (
    coach_id IN (
      SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
    )
  );

-- Coaches can update athlete relationships
CREATE POLICY "Coaches can update athlete relationships"
  ON public.coach_athletes FOR UPDATE
  USING (
    coach_id IN (
      SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
    )
  );

-- Athletes can update their own sharing preferences
CREATE POLICY "Athletes can update sharing preferences"
  ON public.coach_athletes FOR UPDATE
  USING (athlete_user_id = auth.uid())
  WITH CHECK (
    -- Athletes can only modify sharing preferences, not other fields
    athlete_user_id = auth.uid()
  );

-- ----------------------------------------
-- Coach Invites Policies
-- ----------------------------------------

-- Coaches can view their invites
CREATE POLICY "Coaches can view their invites"
  ON public.coach_invites FOR SELECT
  USING (
    coach_id IN (
      SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
    )
  );

-- Coaches can create invites
CREATE POLICY "Coaches can create invites"
  ON public.coach_invites FOR INSERT
  WITH CHECK (
    coach_id IN (
      SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
    )
  );

-- Anyone can look up an invite by code (for joining)
CREATE POLICY "Anyone can lookup invites by code"
  ON public.coach_invites FOR SELECT
  USING (is_active = true AND expires_at > NOW());

-- Coaches can deactivate invites
CREATE POLICY "Coaches can update their invites"
  ON public.coach_invites FOR UPDATE
  USING (
    coach_id IN (
      SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
    )
  );

-- ----------------------------------------
-- Coach Programs Policies
-- ----------------------------------------

-- Coaches can view their own programs
CREATE POLICY "Coaches can view own programs"
  ON public.coach_programs FOR SELECT
  USING (
    coach_id IN (
      SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
    )
  );

-- Athletes can view programs assigned to them
CREATE POLICY "Athletes can view assigned programs"
  ON public.coach_programs FOR SELECT
  USING (
    id IN (
      SELECT program_id FROM public.program_assignments
      WHERE athlete_user_id = auth.uid()
    )
  );

-- Coaches can create programs
CREATE POLICY "Coaches can create programs"
  ON public.coach_programs FOR INSERT
  WITH CHECK (
    coach_id IN (
      SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
    )
  );

-- Coaches can update their programs
CREATE POLICY "Coaches can update own programs"
  ON public.coach_programs FOR UPDATE
  USING (
    coach_id IN (
      SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
    )
  );

-- Coaches can delete their programs
CREATE POLICY "Coaches can delete own programs"
  ON public.coach_programs FOR DELETE
  USING (
    coach_id IN (
      SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
    )
  );

-- ----------------------------------------
-- Program Assignments Policies
-- ----------------------------------------

-- Coaches can view assignments they created
CREATE POLICY "Coaches can view their assignments"
  ON public.program_assignments FOR SELECT
  USING (
    coach_id IN (
      SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
    )
  );

-- Athletes can view their assignments
CREATE POLICY "Athletes can view their assignments"
  ON public.program_assignments FOR SELECT
  USING (athlete_user_id = auth.uid());

-- Coaches can create assignments
CREATE POLICY "Coaches can create assignments"
  ON public.program_assignments FOR INSERT
  WITH CHECK (
    coach_id IN (
      SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
    )
  );

-- Coaches can update assignments
CREATE POLICY "Coaches can update assignments"
  ON public.program_assignments FOR UPDATE
  USING (
    coach_id IN (
      SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
    )
  );

-- Athletes can add notes to their assignments
CREATE POLICY "Athletes can update assignment notes"
  ON public.program_assignments FOR UPDATE
  USING (athlete_user_id = auth.uid());

-- ----------------------------------------
-- Assigned Workouts Policies
-- ----------------------------------------

-- Coaches can view workouts for their athletes
CREATE POLICY "Coaches can view assigned workouts"
  ON public.assigned_workouts FOR SELECT
  USING (
    assignment_id IN (
      SELECT id FROM public.program_assignments
      WHERE coach_id IN (
        SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Athletes can view their workouts
CREATE POLICY "Athletes can view their workouts"
  ON public.assigned_workouts FOR SELECT
  USING (athlete_user_id = auth.uid());

-- Coaches can create workouts
CREATE POLICY "Coaches can create assigned workouts"
  ON public.assigned_workouts FOR INSERT
  WITH CHECK (
    assignment_id IN (
      SELECT id FROM public.program_assignments
      WHERE coach_id IN (
        SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Athletes can update their workout results
CREATE POLICY "Athletes can update workout results"
  ON public.assigned_workouts FOR UPDATE
  USING (athlete_user_id = auth.uid());

-- Coaches can add feedback
CREATE POLICY "Coaches can update workout feedback"
  ON public.assigned_workouts FOR UPDATE
  USING (
    assignment_id IN (
      SELECT id FROM public.program_assignments
      WHERE coach_id IN (
        SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- ----------------------------------------
-- Coach Exercises Policies
-- ----------------------------------------

-- Coaches can view their own exercises
CREATE POLICY "Coaches can view own exercises"
  ON public.coach_exercises FOR SELECT
  USING (
    coach_id IN (
      SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
    )
  );

-- Athletes can view exercises shared by their coach
CREATE POLICY "Athletes can view coach shared exercises"
  ON public.coach_exercises FOR SELECT
  USING (
    share_with_athletes = true AND
    coach_id IN (
      SELECT coach_id FROM public.coach_athletes
      WHERE athlete_user_id = auth.uid() AND status = 'active'
    )
  );

-- Coaches can create exercises
CREATE POLICY "Coaches can create exercises"
  ON public.coach_exercises FOR INSERT
  WITH CHECK (
    coach_id IN (
      SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
    )
  );

-- Coaches can update their exercises
CREATE POLICY "Coaches can update own exercises"
  ON public.coach_exercises FOR UPDATE
  USING (
    coach_id IN (
      SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
    )
  );

-- Coaches can delete their exercises
CREATE POLICY "Coaches can delete own exercises"
  ON public.coach_exercises FOR DELETE
  USING (
    coach_id IN (
      SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- 9. Triggers and Functions
-- ============================================

-- ----------------------------------------
-- Update timestamps trigger
-- ----------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER trigger_coach_profiles_updated
  BEFORE UPDATE ON public.coach_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_coach_athletes_updated
  BEFORE UPDATE ON public.coach_athletes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_coach_programs_updated
  BEFORE UPDATE ON public.coach_programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_program_assignments_updated
  BEFORE UPDATE ON public.program_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_assigned_workouts_updated
  BEFORE UPDATE ON public.assigned_workouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_coach_exercises_updated
  BEFORE UPDATE ON public.coach_exercises
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------
-- Athlete count management
-- ----------------------------------------

CREATE OR REPLACE FUNCTION update_coach_athlete_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update count when athlete status changes
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.coach_profiles
    SET current_athlete_count = (
      SELECT COUNT(*) FROM public.coach_athletes
      WHERE coach_id = NEW.coach_id AND status = 'active'
    )
    WHERE id = NEW.coach_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE public.coach_profiles
    SET current_athlete_count = (
      SELECT COUNT(*) FROM public.coach_athletes
      WHERE coach_id = OLD.coach_id AND status = 'active'
    )
    WHERE id = OLD.coach_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_athlete_count
  AFTER INSERT OR UPDATE OR DELETE ON public.coach_athletes
  FOR EACH ROW EXECUTE FUNCTION update_coach_athlete_count();

-- ----------------------------------------
-- Enforce tier limits
-- ----------------------------------------

CREATE OR REPLACE FUNCTION check_athlete_limit()
RETURNS TRIGGER AS $$
DECLARE
  coach_record RECORD;
BEGIN
  -- Only check on active status
  IF NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  -- Get coach profile
  SELECT * INTO coach_record
  FROM public.coach_profiles
  WHERE id = NEW.coach_id;

  -- Check if coach exists
  IF coach_record IS NULL THEN
    RAISE EXCEPTION 'Coach profile not found';
  END IF;

  -- Check trial expiration
  IF coach_record.subscription_tier = 'trial' AND
     coach_record.trial_ends_at < NOW() THEN
    RAISE EXCEPTION 'Trial period has expired. Please subscribe to continue adding athletes.';
  END IF;

  -- Check subscription status
  IF coach_record.subscription_status != 'active' AND
     coach_record.subscription_tier != 'trial' THEN
    RAISE EXCEPTION 'Subscription is not active. Please update your subscription.';
  END IF;

  -- Check athlete limit
  IF coach_record.current_athlete_count >= coach_record.max_athletes THEN
    RAISE EXCEPTION 'Athlete limit reached (% of %). Upgrade your plan to add more athletes.',
      coach_record.current_athlete_count, coach_record.max_athletes;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_athlete_limit
  BEFORE INSERT OR UPDATE ON public.coach_athletes
  FOR EACH ROW EXECUTE FUNCTION check_athlete_limit();

-- ----------------------------------------
-- Set tier limits based on subscription
-- ----------------------------------------

CREATE OR REPLACE FUNCTION set_tier_limits()
RETURNS TRIGGER AS $$
BEGIN
  CASE NEW.subscription_tier
    WHEN 'trial' THEN
      NEW.max_athletes := 50; -- Full access during trial
    WHEN 'starter' THEN
      NEW.max_athletes := 10;
    WHEN 'pro' THEN
      NEW.max_athletes := 50;
    WHEN 'elite' THEN
      NEW.max_athletes := 99999; -- Essentially unlimited
    ELSE
      NEW.max_athletes := 0;
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_tier_limits
  BEFORE INSERT OR UPDATE OF subscription_tier ON public.coach_profiles
  FOR EACH ROW EXECUTE FUNCTION set_tier_limits();

-- ============================================
-- 10. Helper Functions
-- ============================================

-- Generate unique invite code
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Generate 8-character alphanumeric code
    code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));

    -- Check if code exists
    SELECT EXISTS(
      SELECT 1 FROM public.coach_invites WHERE invite_code = code
      UNION
      SELECT 1 FROM public.coach_athletes WHERE invite_code = code
    ) INTO exists_check;

    EXIT WHEN NOT exists_check;
  END LOOP;

  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Accept invite and join coach
CREATE OR REPLACE FUNCTION accept_coach_invite(
  p_invite_code TEXT,
  p_share_history BOOLEAN DEFAULT false,
  p_share_metrics BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
  invite_record RECORD;
  coach_record RECORD;
  athlete_id UUID;
  result_id UUID;
BEGIN
  -- Look up invite
  SELECT * INTO invite_record
  FROM public.coach_invites
  WHERE invite_code = p_invite_code
    AND is_active = true
    AND expires_at > NOW()
    AND (max_uses IS NULL OR current_uses < max_uses);

  IF invite_record IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite code';
  END IF;

  -- Get coach profile
  SELECT * INTO coach_record
  FROM public.coach_profiles
  WHERE id = invite_record.coach_id;

  -- Check athlete limit before accepting
  IF coach_record.current_athlete_count >= coach_record.max_athletes THEN
    RAISE EXCEPTION 'Coach has reached their athlete limit';
  END IF;

  -- Create athlete relationship
  INSERT INTO public.coach_athletes (
    coach_id,
    athlete_user_id,
    invite_method,
    invite_code,
    joined_at,
    status,
    share_workout_history,
    share_body_metrics
  ) VALUES (
    invite_record.coach_id,
    auth.uid(),
    invite_record.invite_type,
    p_invite_code,
    NOW(),
    'active',
    p_share_history,
    p_share_metrics
  )
  RETURNING id INTO result_id;

  -- Update invite usage
  UPDATE public.coach_invites
  SET current_uses = current_uses + 1
  WHERE id = invite_record.id;

  RETURN result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 11. Views for Common Queries
-- ============================================

-- Coach dashboard overview
CREATE OR REPLACE VIEW coach_dashboard AS
SELECT
  cp.id AS coach_id,
  cp.user_id,
  cp.display_name,
  cp.subscription_tier,
  cp.subscription_status,
  cp.current_athlete_count,
  cp.max_athletes,
  cp.trial_ends_at,
  CASE
    WHEN cp.subscription_tier = 'trial' AND cp.trial_ends_at > NOW()
    THEN EXTRACT(DAY FROM cp.trial_ends_at - NOW())::INTEGER
    ELSE NULL
  END AS trial_days_remaining,
  (SELECT COUNT(*) FROM public.coach_programs WHERE coach_id = cp.id) AS total_programs,
  (SELECT COUNT(*) FROM public.program_assignments
   WHERE coach_id = cp.id AND status = 'active') AS active_assignments
FROM public.coach_profiles cp
WHERE cp.user_id = auth.uid();

-- Athlete's coach view
CREATE OR REPLACE VIEW athlete_coaches AS
SELECT
  cp.id AS coach_id,
  cp.display_name AS coach_name,
  cp.business_name,
  cp.bio,
  cp.avatar_url,
  ca.status,
  ca.share_workout_history,
  ca.share_body_metrics,
  ca.joined_at,
  (SELECT COUNT(*) FROM public.program_assignments
   WHERE athlete_user_id = auth.uid()
   AND coach_id = cp.id
   AND status = 'active') AS active_programs
FROM public.coach_athletes ca
JOIN public.coach_profiles cp ON ca.coach_id = cp.id
WHERE ca.athlete_user_id = auth.uid();

-- ============================================
-- 12. Grant Permissions
-- ============================================

-- Allow authenticated users to use helper functions
GRANT EXECUTE ON FUNCTION generate_invite_code() TO authenticated;
GRANT EXECUTE ON FUNCTION accept_coach_invite(TEXT, BOOLEAN, BOOLEAN) TO authenticated;

-- Grant access to views
GRANT SELECT ON coach_dashboard TO authenticated;
GRANT SELECT ON athlete_coaches TO authenticated;

-- ============================================
-- 13. Comments for Documentation
-- ============================================

COMMENT ON TABLE public.coach_profiles IS 'Coach user profiles with subscription and tier information';
COMMENT ON TABLE public.coach_athletes IS 'Relationships between coaches and their athletes';
COMMENT ON TABLE public.coach_invites IS 'Invite codes and links for athlete onboarding';
COMMENT ON TABLE public.coach_programs IS 'Workout programs created by coaches';
COMMENT ON TABLE public.program_assignments IS 'Programs assigned to specific athletes';
COMMENT ON TABLE public.assigned_workouts IS 'Individual workouts within an assignment';
COMMENT ON TABLE public.coach_exercises IS 'Custom exercises created by coaches';

COMMENT ON FUNCTION check_athlete_limit() IS 'Enforces subscription tier athlete limits';
COMMENT ON FUNCTION set_tier_limits() IS 'Sets max_athletes based on subscription tier';
COMMENT ON FUNCTION accept_coach_invite(TEXT, BOOLEAN, BOOLEAN) IS 'Allows athlete to accept coach invite with sharing preferences';
COMMENT ON VIEW coach_dashboard IS 'Aggregated view for coach dashboard stats';
COMMENT ON VIEW athlete_coaches IS 'View of coaches for an athlete';
