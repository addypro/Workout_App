-- ============================================
-- Fix RLS Policy Recursion Issues
-- ============================================
-- The original policies created circular dependencies between tables.
-- This migration drops the problematic policies and recreates them
-- using SECURITY DEFINER functions to avoid recursion.

-- ============================================
-- 1. Create Helper Functions (SECURITY DEFINER)
-- ============================================

-- Get current user's coach ID (if they are a coach)
CREATE OR REPLACE FUNCTION get_my_coach_id()
RETURNS UUID AS $$
  SELECT id FROM public.coach_profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is a coach
CREATE OR REPLACE FUNCTION is_coach()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_profiles
    WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get coach IDs for current athlete
CREATE OR REPLACE FUNCTION get_my_coach_ids()
RETURNS SETOF UUID AS $$
  SELECT coach_id FROM public.coach_athletes
  WHERE athlete_user_id = auth.uid() AND status = 'active';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is athlete of a specific coach
CREATE OR REPLACE FUNCTION is_athlete_of_coach(coach_profile_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_athletes
    WHERE coach_id = coach_profile_id
    AND athlete_user_id = auth.uid()
    AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- 2. Drop Problematic Policies
-- ============================================

-- Coach Profiles
DROP POLICY IF EXISTS "Athletes can view their coach profile" ON public.coach_profiles;

-- Coach Athletes
DROP POLICY IF EXISTS "Coaches can view their athletes" ON public.coach_athletes;
DROP POLICY IF EXISTS "Coaches can invite athletes" ON public.coach_athletes;
DROP POLICY IF EXISTS "Coaches can update athlete relationships" ON public.coach_athletes;

-- Coach Invites
DROP POLICY IF EXISTS "Coaches can view their invites" ON public.coach_invites;
DROP POLICY IF EXISTS "Coaches can create invites" ON public.coach_invites;
DROP POLICY IF EXISTS "Coaches can update their invites" ON public.coach_invites;

-- Coach Programs
DROP POLICY IF EXISTS "Coaches can view own programs" ON public.coach_programs;
DROP POLICY IF EXISTS "Coaches can create programs" ON public.coach_programs;
DROP POLICY IF EXISTS "Coaches can update own programs" ON public.coach_programs;
DROP POLICY IF EXISTS "Coaches can delete own programs" ON public.coach_programs;
DROP POLICY IF EXISTS "Athletes can view assigned programs" ON public.coach_programs;

-- Program Assignments
DROP POLICY IF EXISTS "Coaches can view their assignments" ON public.program_assignments;
DROP POLICY IF EXISTS "Coaches can create assignments" ON public.program_assignments;
DROP POLICY IF EXISTS "Coaches can update assignments" ON public.program_assignments;

-- Assigned Workouts
DROP POLICY IF EXISTS "Coaches can view assigned workouts" ON public.assigned_workouts;
DROP POLICY IF EXISTS "Coaches can create assigned workouts" ON public.assigned_workouts;
DROP POLICY IF EXISTS "Coaches can update workout feedback" ON public.assigned_workouts;

-- Coach Exercises
DROP POLICY IF EXISTS "Coaches can view own exercises" ON public.coach_exercises;
DROP POLICY IF EXISTS "Coaches can create exercises" ON public.coach_exercises;
DROP POLICY IF EXISTS "Coaches can update own exercises" ON public.coach_exercises;
DROP POLICY IF EXISTS "Coaches can delete own exercises" ON public.coach_exercises;
DROP POLICY IF EXISTS "Athletes can view coach shared exercises" ON public.coach_exercises;

-- ============================================
-- 3. Recreate Policies Using Helper Functions
-- ============================================

-- ----------------------------------------
-- Coach Profiles Policies (Fixed)
-- ----------------------------------------

-- Athletes can view their coach's profile (using helper function)
CREATE POLICY "Athletes can view their coach profile"
  ON public.coach_profiles FOR SELECT
  USING (is_athlete_of_coach(id));

-- ----------------------------------------
-- Coach Athletes Policies (Fixed)
-- ----------------------------------------

-- Coaches can view their athletes
CREATE POLICY "Coaches can view their athletes"
  ON public.coach_athletes FOR SELECT
  USING (coach_id = get_my_coach_id());

-- Coaches can create athlete relationships
CREATE POLICY "Coaches can invite athletes"
  ON public.coach_athletes FOR INSERT
  WITH CHECK (coach_id = get_my_coach_id());

-- Coaches can update athlete relationships
CREATE POLICY "Coaches can update athlete relationships"
  ON public.coach_athletes FOR UPDATE
  USING (coach_id = get_my_coach_id());

-- ----------------------------------------
-- Coach Invites Policies (Fixed)
-- ----------------------------------------

-- Coaches can view their invites
CREATE POLICY "Coaches can view their invites"
  ON public.coach_invites FOR SELECT
  USING (coach_id = get_my_coach_id());

-- Coaches can create invites
CREATE POLICY "Coaches can create invites"
  ON public.coach_invites FOR INSERT
  WITH CHECK (coach_id = get_my_coach_id());

-- Coaches can update their invites
CREATE POLICY "Coaches can update their invites"
  ON public.coach_invites FOR UPDATE
  USING (coach_id = get_my_coach_id());

-- ----------------------------------------
-- Coach Programs Policies (Fixed)
-- ----------------------------------------

-- Coaches can view their own programs
CREATE POLICY "Coaches can view own programs"
  ON public.coach_programs FOR SELECT
  USING (coach_id = get_my_coach_id());

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
  WITH CHECK (coach_id = get_my_coach_id());

-- Coaches can update their programs
CREATE POLICY "Coaches can update own programs"
  ON public.coach_programs FOR UPDATE
  USING (coach_id = get_my_coach_id());

-- Coaches can delete their programs
CREATE POLICY "Coaches can delete own programs"
  ON public.coach_programs FOR DELETE
  USING (coach_id = get_my_coach_id());

-- ----------------------------------------
-- Program Assignments Policies (Fixed)
-- ----------------------------------------

-- Coaches can view assignments they created
CREATE POLICY "Coaches can view their assignments"
  ON public.program_assignments FOR SELECT
  USING (coach_id = get_my_coach_id());

-- Coaches can create assignments
CREATE POLICY "Coaches can create assignments"
  ON public.program_assignments FOR INSERT
  WITH CHECK (coach_id = get_my_coach_id());

-- Coaches can update assignments
CREATE POLICY "Coaches can update assignments"
  ON public.program_assignments FOR UPDATE
  USING (coach_id = get_my_coach_id());

-- ----------------------------------------
-- Assigned Workouts Policies (Fixed)
-- ----------------------------------------

-- Coaches can view workouts for their athletes
CREATE POLICY "Coaches can view assigned workouts"
  ON public.assigned_workouts FOR SELECT
  USING (
    assignment_id IN (
      SELECT id FROM public.program_assignments
      WHERE coach_id = get_my_coach_id()
    )
  );

-- Coaches can create workouts
CREATE POLICY "Coaches can create assigned workouts"
  ON public.assigned_workouts FOR INSERT
  WITH CHECK (
    assignment_id IN (
      SELECT id FROM public.program_assignments
      WHERE coach_id = get_my_coach_id()
    )
  );

-- Coaches can add feedback
CREATE POLICY "Coaches can update workout feedback"
  ON public.assigned_workouts FOR UPDATE
  USING (
    assignment_id IN (
      SELECT id FROM public.program_assignments
      WHERE coach_id = get_my_coach_id()
    )
  );

-- ----------------------------------------
-- Coach Exercises Policies (Fixed)
-- ----------------------------------------

-- Coaches can view their own exercises
CREATE POLICY "Coaches can view own exercises"
  ON public.coach_exercises FOR SELECT
  USING (coach_id = get_my_coach_id());

-- Athletes can view exercises shared by their coach
CREATE POLICY "Athletes can view coach shared exercises"
  ON public.coach_exercises FOR SELECT
  USING (
    share_with_athletes = true AND
    coach_id IN (SELECT get_my_coach_ids())
  );

-- Coaches can create exercises
CREATE POLICY "Coaches can create exercises"
  ON public.coach_exercises FOR INSERT
  WITH CHECK (coach_id = get_my_coach_id());

-- Coaches can update their exercises
CREATE POLICY "Coaches can update own exercises"
  ON public.coach_exercises FOR UPDATE
  USING (coach_id = get_my_coach_id());

-- Coaches can delete their exercises
CREATE POLICY "Coaches can delete own exercises"
  ON public.coach_exercises FOR DELETE
  USING (coach_id = get_my_coach_id());

-- ============================================
-- 4. Grant Execute on Helper Functions
-- ============================================

GRANT EXECUTE ON FUNCTION get_my_coach_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_coach() TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_coach_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION is_athlete_of_coach(UUID) TO authenticated;
