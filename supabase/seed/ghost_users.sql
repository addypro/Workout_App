-- Ghost Users Seeding Script
-- Creates 50 ghost users distributed across leagues
-- Run manually: npx supabase db push (will run with migrations)

-- Create ghost users in auth.users table
-- NOTE: This requires service_role access and should be run as admin

DO $$
DECLARE
  ghost_id UUID;
  tier INT;
  xp_per_week INT;
  ghost_names TEXT[] := ARRAY[
    'IronMike', 'FitnessFan', 'GymRat', 'PowerPete', 'StrongSteve',
    'SarahLifts', 'JakeTheSnake', 'ConsistentCarl', 'SteadySarah', 'RegularRyan',
    'GrinderGary', 'EliteEmma', 'ChampChris', 'BeastMode', 'GainsTrain',
    'FitFreak', 'IronWill', 'MuscleMan', 'SwoleSister', 'LiftLord',
    'RepQueen', 'SquatKing', 'DeadliftDan', 'BenchBoss', 'CardioKid',
    'EnduranceEli', 'SpeedySpencer', 'TurboTina', 'PowerPam', 'StrengthSam',
    'MightyMax', 'FlexFiona', 'CrunchKing', 'PlankPro', 'CoreCrusher',
    'BicepBilly', 'TricepTom', 'ShoulderShane', 'LegendLeo', 'MasterMike',
    'DiamondDan', 'GoldGary', 'SilverSam', 'BronzeBob', 'SteelSteve',
    'TitanTim', 'ColossusCat', 'HercHenry', 'AtlasAlex', 'ZeusZack'
  ];
  i INT;
  current_period_id UUID;
BEGIN
  -- Get or create current period
  SELECT id INTO current_period_id
  FROM league_periods
  WHERE status = 'active'
  ORDER BY start_date DESC
  LIMIT 1;
  
  IF current_period_id IS NULL THEN
    INSERT INTO league_periods (start_date, end_date, status)
    VALUES (
      date_trunc('week', CURRENT_DATE)::DATE,
      (date_trunc('week', CURRENT_DATE) + INTERVAL '6 days')::DATE,
      'active'
    )
    RETURNING id INTO current_period_id;
  END IF;

  -- Create 50 ghost users
  FOR i IN 1..50 LOOP
    ghost_id := gen_random_uuid();
    
    -- Distribute across tiers (weighted toward lower tiers)
    -- 1-15: Wood/Stone (tier 1-2)
    -- 16-30: Bronze/Silver (tier 3-4)
    -- 31-40: Gold/Crystal (tier 5-6)
    -- 41-48: Master (tier 7)
    -- 49-50: Legend (tier 8)
    IF i <= 15 THEN
      tier := 1 + (i % 2);
      xp_per_week := 200 + (tier * 50);
    ELSIF i <= 30 THEN
      tier := 3 + ((i - 15) % 2);
      xp_per_week := 350 + (tier * 50);
    ELSIF i <= 40 THEN
      tier := 5 + ((i - 30) % 2);
      xp_per_week := 600 + (tier * 100);
    ELSIF i <= 48 THEN
      tier := 7;
      xp_per_week := 1000 + (i * 10);
    ELSE
      tier := 8;
      xp_per_week := 1500 + (i * 20);
    END IF;
    
    -- Insert into profiles table (if exists) or create basic record
    -- Note: Actual user creation would need auth.users which requires admin API
    -- This creates league standings for ghost users
    
    INSERT INTO league_standings (
      period_id,
      tier_id,
      user_id,
      xp
    ) VALUES (
      current_period_id,
      tier,
      ghost_id,
      FLOOR(RANDOM() * xp_per_week * 0.5) -- Start with some XP
    )
    ON CONFLICT DO NOTHING;
    
  END LOOP;
  
  RAISE NOTICE 'Created 50 ghost user standings for period %', current_period_id;
END $$;

-- Create a helper function for the simulate-ghosts edge function
CREATE OR REPLACE FUNCTION get_ghost_standings()
RETURNS TABLE (
  standing_id UUID,
  tier_id INT,
  current_xp INT
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
  
  -- Return standings for ghost users (those without profiles)
  RETURN QUERY
  SELECT 
    ls.id as standing_id,
    ls.tier_id,
    ls.xp as current_xp
  FROM league_standings ls
  LEFT JOIN profiles p ON p.id = ls.user_id
  WHERE ls.period_id = v_period_id
    AND p.id IS NULL; -- Ghost users don't have profiles
END;
$$;

-- Function to increment ghost XP (used by simulate-ghosts edge function)
CREATE OR REPLACE FUNCTION increment_ghost_xp(
  p_standing_id UUID,
  p_xp INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE league_standings
  SET xp = xp + p_xp, updated_at = now()
  WHERE id = p_standing_id;
END;
$$;
