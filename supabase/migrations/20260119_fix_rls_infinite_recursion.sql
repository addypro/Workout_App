-- ============================================
-- FIX: Infinite Recursion in class_sessions RLS
-- ============================================
-- 
-- PROBLEM: The "Athletes can view joined sessions" policy on class_sessions
-- queries class_participants, which has its own RLS that queries class_sessions.
-- This creates infinite recursion (PostgreSQL error 42P17).
--
-- SOLUTION: Drop the problematic policies and recreate them using
-- security_invoker functions that bypass RLS during the check.
-- 
-- Manhattan Project: CRITICAL INFRASTRUCTURE FIX
-- ============================================

-- Step 1: Drop the problematic policies
DROP POLICY IF EXISTS "Athletes can view joined sessions" ON public.class_sessions;
DROP POLICY IF EXISTS "Coaches can view session participants" ON public.class_participants;

-- Step 2: Create a security definer function to check participation
-- This function runs with elevated privileges to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.user_is_session_participant(p_session_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.class_participants
        WHERE session_id = p_session_id 
        AND athlete_user_id = p_user_id 
        AND status = 'joined'
    );
$$;

-- Step 3: Create a security definer function to check if user is session coach
CREATE OR REPLACE FUNCTION public.user_is_session_coach(p_session_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.class_sessions cs
        JOIN public.coach_profiles cp ON cs.coach_id = cp.id
        WHERE cs.id = p_session_id AND cp.user_id = p_user_id
    );
$$;

-- Step 4: Recreate athlete policy using the security definer function
CREATE POLICY "Athletes can view joined sessions"
  ON public.class_sessions FOR SELECT
  USING (
    public.user_is_session_participant(id, auth.uid())
  );

-- Step 5: Recreate coach participants policy using security definer function
CREATE POLICY "Coaches can view session participants"
  ON public.class_participants FOR SELECT
  USING (
    public.user_is_session_coach(session_id, auth.uid())
    OR athlete_user_id = auth.uid()
  );

-- Grant execute permissions on the helper functions
GRANT EXECUTE ON FUNCTION public.user_is_session_participant(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_session_coach(UUID, UUID) TO authenticated;

-- ============================================
-- VERIFICATION COMMENT
-- ============================================
-- After this migration:
-- - class_sessions RLS no longer directly queries class_participants
-- - class_participants RLS no longer directly queries class_sessions
-- - The SECURITY DEFINER functions bypass RLS during their execution
-- - No more infinite recursion!
