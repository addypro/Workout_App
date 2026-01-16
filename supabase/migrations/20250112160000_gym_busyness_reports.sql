-- ============================================
-- Gym Busyness Reports
-- ============================================
-- Simple user-reported gym busyness after workouts.
-- Replaces the inaccurate traffic aggregation approach.

-- Create busyness reports table
CREATE TABLE IF NOT EXISTS public.gym_busyness_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Report data
  busyness INTEGER NOT NULL CHECK (busyness BETWEEN 1 AND 3),
  -- 1 = Empty, 2 = Moderate, 3 = Packed
  
  -- Time context
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  hour_of_day INTEGER NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for aggregation queries
CREATE INDEX IF NOT EXISTS idx_gym_busyness_gym_time 
  ON public.gym_busyness_reports(gym_id, day_of_week, hour_of_day);

-- Index for user lookups (rate limiting)
CREATE INDEX IF NOT EXISTS idx_gym_busyness_user 
  ON public.gym_busyness_reports(user_id, reported_at DESC);

-- RLS
ALTER TABLE public.gym_busyness_reports ENABLE ROW LEVEL SECURITY;

-- Users can insert their own reports
DROP POLICY IF EXISTS "Users can report busyness" ON public.gym_busyness_reports;
CREATE POLICY "Users can report busyness"
  ON public.gym_busyness_reports FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Everyone can read aggregated reports (via function, not direct table access)
DROP POLICY IF EXISTS "Reports are readable" ON public.gym_busyness_reports;
CREATE POLICY "Reports are readable"
  ON public.gym_busyness_reports FOR SELECT
  USING (true);

-- ============================================
-- Aggregation Function
-- ============================================

CREATE OR REPLACE FUNCTION get_gym_busyness_patterns(gym_uuid UUID)
RETURNS TABLE (
  day_of_week INTEGER,
  hour_of_day INTEGER,
  avg_busyness NUMERIC,
  report_count INTEGER,
  label TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.day_of_week,
    r.hour_of_day,
    ROUND(AVG(r.busyness)::NUMERIC, 1) as avg_busyness,
    COUNT(*)::INTEGER as report_count,
    CASE 
      WHEN AVG(r.busyness) < 1.5 THEN 'Usually Empty'
      WHEN AVG(r.busyness) < 2.5 THEN 'Usually Moderate'
      ELSE 'Usually Packed'
    END as label
  FROM public.gym_busyness_reports r
  WHERE r.gym_id = gym_uuid
    AND r.reported_at > NOW() - INTERVAL '90 days'
  GROUP BY r.day_of_week, r.hour_of_day
  HAVING COUNT(*) >= 3  -- Minimum reports for reliability
  ORDER BY r.day_of_week, r.hour_of_day;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access
GRANT EXECUTE ON FUNCTION get_gym_busyness_patterns TO authenticated;
GRANT SELECT, INSERT ON public.gym_busyness_reports TO authenticated;
