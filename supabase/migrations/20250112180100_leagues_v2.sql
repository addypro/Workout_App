-- League V2 Migration
-- 8-tier Chess.com style league system

-- ============================================
-- LEAGUE TIERS
-- ============================================

CREATE TABLE IF NOT EXISTS league_tiers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  rank_order INT NOT NULL, -- 1=Wood, 8=Legend
  icon TEXT,
  color TEXT,
  promotion_percent DECIMAL(3,2) DEFAULT 0.20, -- Top 20% promoted
  demotion_percent DECIMAL(3,2) DEFAULT 0.10   -- Bottom 10% demoted
);

-- Seed tiers
INSERT INTO league_tiers (id, name, rank_order, icon, color, promotion_percent, demotion_percent)
VALUES
  (1, 'Wood', 1, '🪵', '#8B4513', 0.20, 0.00),    -- Can't demote from Wood
  (2, 'Stone', 2, '🪨', '#708090', 0.20, 0.10),
  (3, 'Bronze', 3, '🥉', '#CD7F32', 0.20, 0.10),
  (4, 'Silver', 4, '🥈', '#C0C0C0', 0.20, 0.10),
  (5, 'Gold', 5, '🥇', '#FFD700', 0.20, 0.10),
  (6, 'Crystal', 6, '💎', '#E0FFFF', 0.20, 0.10),
  (7, 'Master', 7, '👑', '#9400D3', 0.20, 0.10),
  (8, 'Legend', 8, '🔥', '#FF4500', 0.00, 0.10)   -- Can't promote from Legend
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- LEAGUE PERIODS (Weekly cycles)
-- ============================================

CREATE TABLE IF NOT EXISTS league_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'processing')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- LEAGUE STANDINGS
-- ============================================

CREATE TABLE IF NOT EXISTS league_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID REFERENCES league_periods(id) ON DELETE CASCADE,
  tier_id INT REFERENCES league_tiers(id),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  xp INT DEFAULT 0,
  rank INT,
  promotion_status TEXT CHECK (promotion_status IN ('promoted', 'demoted', 'retained')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(period_id, user_id)
);

-- ============================================
-- XP EVENTS (Audit trail)
-- ============================================

CREATE TABLE IF NOT EXISTS league_xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  period_id UUID REFERENCES league_periods(id) ON DELETE CASCADE,
  event_type TEXT CHECK (event_type IN ('workout', 'pr', 'challenge_node', 'bonus')),
  xp_amount INT NOT NULL,
  source_id TEXT, -- workout_id, pr_id, etc.
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_league_standings_period ON league_standings(period_id);
CREATE INDEX IF NOT EXISTS idx_league_standings_tier ON league_standings(tier_id);
CREATE INDEX IF NOT EXISTS idx_league_standings_user ON league_standings(user_id);
CREATE INDEX IF NOT EXISTS idx_league_standings_xp ON league_standings(xp DESC);
CREATE INDEX IF NOT EXISTS idx_league_xp_events_user ON league_xp_events(user_id);
CREATE INDEX IF NOT EXISTS idx_league_xp_events_period ON league_xp_events(period_id);
CREATE INDEX IF NOT EXISTS idx_league_periods_status ON league_periods(status);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE league_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_xp_events ENABLE ROW LEVEL SECURITY;

-- Tiers are public
CREATE POLICY "league_tiers_public_read" ON league_tiers
  FOR SELECT USING (true);

-- Periods are public
CREATE POLICY "league_periods_public_read" ON league_periods
  FOR SELECT USING (true);

-- Standings are public (for leaderboards)
CREATE POLICY "league_standings_public_read" ON league_standings
  FOR SELECT USING (true);

-- Users can see their own XP events
CREATE POLICY "league_xp_events_select_own" ON league_xp_events
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to add XP to a user's standing
CREATE OR REPLACE FUNCTION add_league_xp(
  p_user_id UUID,
  p_xp_amount INT,
  p_event_type TEXT,
  p_source_id TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period_id UUID;
  v_tier_id INT;
BEGIN
  -- Get current active period
  SELECT id INTO v_period_id
  FROM league_periods
  WHERE status = 'active'
  ORDER BY start_date DESC
  LIMIT 1;
  
  IF v_period_id IS NULL THEN
    -- Create new period if none exists
    INSERT INTO league_periods (start_date, end_date, status)
    VALUES (
      date_trunc('week', CURRENT_DATE)::DATE,
      (date_trunc('week', CURRENT_DATE) + INTERVAL '6 days')::DATE,
      'active'
    )
    RETURNING id INTO v_period_id;
  END IF;
  
  -- Ensure user has a standing record
  INSERT INTO league_standings (period_id, tier_id, user_id, xp)
  VALUES (v_period_id, 1, p_user_id, 0) -- Start in Wood tier
  ON CONFLICT (period_id, user_id) DO NOTHING;
  
  -- Add XP
  UPDATE league_standings
  SET xp = xp + p_xp_amount, updated_at = now()
  WHERE period_id = v_period_id AND user_id = p_user_id;
  
  -- Log the event
  INSERT INTO league_xp_events (user_id, period_id, event_type, xp_amount, source_id)
  VALUES (p_user_id, v_period_id, p_event_type, p_xp_amount, p_source_id);
END;
$$;

-- Function to get user's current standing
CREATE OR REPLACE FUNCTION get_user_standing(p_user_id UUID)
RETURNS TABLE (
  tier_name TEXT,
  tier_icon TEXT,
  tier_color TEXT,
  xp INT,
  rank INT,
  cohort_size INT,
  in_promotion_zone BOOLEAN,
  in_danger_zone BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period_id UUID;
BEGIN
  -- Get current active period
  SELECT id INTO v_period_id
  FROM league_periods
  WHERE status = 'active'
  ORDER BY start_date DESC
  LIMIT 1;
  
  IF v_period_id IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  WITH ranked AS (
    SELECT 
      ls.*,
      ROW_NUMBER() OVER (PARTITION BY ls.tier_id ORDER BY ls.xp DESC) as calc_rank,
      COUNT(*) OVER (PARTITION BY ls.tier_id) as tier_size
    FROM league_standings ls
    WHERE ls.period_id = v_period_id
  )
  SELECT 
    lt.name as tier_name,
    lt.icon as tier_icon,
    lt.color as tier_color,
    r.xp,
    r.calc_rank::INT as rank,
    r.tier_size::INT as cohort_size,
    r.calc_rank <= CEIL(r.tier_size * lt.promotion_percent) as in_promotion_zone,
    r.calc_rank > r.tier_size - FLOOR(r.tier_size * lt.demotion_percent) as in_danger_zone
  FROM ranked r
  JOIN league_tiers lt ON lt.id = r.tier_id
  WHERE r.user_id = p_user_id;
END;
$$;
