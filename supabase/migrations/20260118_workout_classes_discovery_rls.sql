-- ============================================
-- Workout Classes: Add Discovery RLS Policy
-- ============================================
-- Athletes need to browse available sessions they haven't joined yet.
-- This policy enables the getAvailableSessions() function to work.

-- Allow athletes to view upcoming sessions with available capacity
-- This is required for the Discover Classes screen (Phase 7)
CREATE POLICY "Athletes can view available sessions"
  ON public.class_sessions FOR SELECT
  USING (
    -- Session must be scheduled (not in progress, completed, or canceled)
    status = 'scheduled' 
    -- Session must be in the future
    AND start_at > NOW()
    -- Session must have capacity available
    AND current_participant_count < capacity
  );

-- Note: This policy is additive to existing policies:
-- 1. "Coaches can view own sessions" - for coach dashboard
-- 2. "Athletes can view joined sessions" - for My Classes
-- 3. "Athletes can view available sessions" (NEW) - for Discovery
