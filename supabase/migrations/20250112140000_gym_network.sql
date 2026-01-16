-- ============================================
-- Gym Network Schema Migration
-- ============================================
-- Introduces real `gyms` entity with M:N relationships
-- for Staff Coaches and "Transitive" access for Online Coaches.
--
-- Tables:
-- 1. gyms - Physical gym locations with PostGIS geography
-- 2. gym_members - User membership in gyms
-- 3. gym_coaches - Coach assignments to gyms (staff/owner/freelance)
-- 4. gym_traffic - Aggregated traffic data per gym (for heatmaps)
--
-- RLS Policies:
-- - Public: Read basic gym info (name, location)
-- - Staff: gym_coaches can read detailed gym_traffic
-- - Mercenary (Transitive): Online coaches can read gym_traffic
--   if they have an athlete currently at that gym

-- ============================================
-- Enable PostGIS Extension (if not already enabled)
-- ============================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================
-- 1. Gyms Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.gyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info
  name TEXT NOT NULL,
  slug TEXT UNIQUE, -- URL-friendly name (e.g., "planet-fitness-downtown")
  description TEXT,
  
  -- Location (PostGIS geography for accurate distance calculations)
  location GEOGRAPHY(POINT, 4326), -- SRID 4326 = WGS84 (GPS coordinates)
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'US',
  postal_code TEXT,
  
  -- External IDs for standardization
  osm_id TEXT UNIQUE, -- OpenStreetMap ID
  google_place_id TEXT UNIQUE,
  
  -- Ownership
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Business info
  phone TEXT,
  email TEXT,
  website TEXT,
  
  -- Operating hours (JSON object with day keys)
  operating_hours JSONB DEFAULT '{}'::JSONB,
  
  -- Subscription/Partnership status
  subscription_status TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_status IN ('free', 'basic', 'premium', 'enterprise')),
  partnership_tier TEXT DEFAULT NULL
    CHECK (partnership_tier IS NULL OR partnership_tier IN ('bronze', 'silver', 'gold', 'platinum')),
  
  -- Amenities and equipment (for filtering)
  equipment_types TEXT[] DEFAULT '{}',
  amenities TEXT[] DEFAULT '{}',
  
  -- Stats (aggregated, updated periodically)
  member_count INTEGER DEFAULT 0,
  avg_rating NUMERIC(2,1) DEFAULT NULL,
  review_count INTEGER DEFAULT 0,
  
  -- Verification
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  
  -- Source tracking
  created_by UUID REFERENCES auth.users(id),
  source TEXT DEFAULT 'user' CHECK (source IN ('user', 'osm', 'google', 'partner', 'admin')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spatial index for location queries
CREATE INDEX IF NOT EXISTS idx_gyms_location 
  ON public.gyms USING GIST(location);

-- Index for OSM ID lookups
CREATE INDEX IF NOT EXISTS idx_gyms_osm_id 
  ON public.gyms(osm_id) WHERE osm_id IS NOT NULL;

-- Index for Google Place ID lookups
CREATE INDEX IF NOT EXISTS idx_gyms_google_place_id 
  ON public.gyms(google_place_id) WHERE google_place_id IS NOT NULL;

-- Index for owner lookups
CREATE INDEX IF NOT EXISTS idx_gyms_owner_id 
  ON public.gyms(owner_id) WHERE owner_id IS NOT NULL;

-- Index for slug lookups
CREATE INDEX IF NOT EXISTS idx_gyms_slug 
  ON public.gyms(slug) WHERE slug IS NOT NULL;

-- Index for city filtering
CREATE INDEX IF NOT EXISTS idx_gyms_city 
  ON public.gyms(city, state);

-- ============================================
-- 2. Gym Members Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.gym_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Membership status
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'banned', 'pending')),
  
  -- Role at this gym
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('member', 'vip', 'staff', 'manager')),
  
  -- Membership tracking
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  
  -- Last activity (for active member tracking)
  last_check_in TIMESTAMPTZ,
  total_visits INTEGER DEFAULT 0,
  
  -- Privacy settings
  visible_in_leaderboard BOOLEAN DEFAULT true,
  visible_to_other_members BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one membership per gym per user
  CONSTRAINT unique_gym_member UNIQUE (gym_id, user_id)
);

-- Index for gym lookups
CREATE INDEX IF NOT EXISTS idx_gym_members_gym_id 
  ON public.gym_members(gym_id);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_gym_members_user_id 
  ON public.gym_members(user_id);

-- Index for active members
CREATE INDEX IF NOT EXISTS idx_gym_members_active 
  ON public.gym_members(gym_id, status) WHERE status = 'active';

-- ============================================
-- 3. Gym Coaches Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.gym_coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
  
  -- Coach role at this gym
  role TEXT NOT NULL DEFAULT 'freelance'
    CHECK (role IN ('staff', 'owner', 'freelance', 'partner')),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'pending', 'terminated')),
  
  -- Permissions
  can_view_member_list BOOLEAN DEFAULT false,
  can_view_traffic_data BOOLEAN DEFAULT true,
  can_post_announcements BOOLEAN DEFAULT false,
  can_manage_equipment BOOLEAN DEFAULT false,
  
  -- Revenue sharing (for freelance coaches)
  revenue_share_percent NUMERIC(5,2) DEFAULT NULL,
  
  -- Employment tracking
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one role per coach per gym
  CONSTRAINT unique_gym_coach UNIQUE (gym_id, coach_id)
);

-- Index for gym lookups
CREATE INDEX IF NOT EXISTS idx_gym_coaches_gym_id 
  ON public.gym_coaches(gym_id);

-- Index for coach lookups
CREATE INDEX IF NOT EXISTS idx_gym_coaches_coach_id 
  ON public.gym_coaches(coach_id);

-- Index for active coaches
CREATE INDEX IF NOT EXISTS idx_gym_coaches_active 
  ON public.gym_coaches(gym_id, status) WHERE status = 'active';

-- ============================================
-- 4. Gym Traffic Table (Aggregated Analytics)
-- ============================================

CREATE TABLE IF NOT EXISTS public.gym_traffic (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  
  -- Time bucket
  hour_bucket TIMESTAMPTZ NOT NULL, -- Truncated to hour
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  
  -- Traffic metrics (aggregated, anonymized)
  active_users INTEGER DEFAULT 0,
  workouts_started INTEGER DEFAULT 0,
  workouts_completed INTEGER DEFAULT 0,
  
  -- Equipment usage (JSON object: equipment_type -> count)
  equipment_usage JSONB DEFAULT '{}'::JSONB,
  
  -- Popular exercises (JSON array: [{name, count}])
  popular_exercises JSONB DEFAULT '[]'::JSONB,
  
  -- Average session duration (minutes)
  avg_session_duration INTEGER DEFAULT NULL,
  
  -- Busyness score (0-100, computed)
  busyness_score INTEGER DEFAULT 0 CHECK (busyness_score BETWEEN 0 AND 100),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one record per gym per hour
  CONSTRAINT unique_gym_traffic_hour UNIQUE (gym_id, hour_bucket)
);

-- Index for gym + time range queries
CREATE INDEX IF NOT EXISTS idx_gym_traffic_gym_time 
  ON public.gym_traffic(gym_id, hour_bucket DESC);

-- Index for day of week analysis
CREATE INDEX IF NOT EXISTS idx_gym_traffic_day 
  ON public.gym_traffic(gym_id, day_of_week);

-- ============================================
-- 5. Enable Row Level Security
-- ============================================

ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_traffic ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. RLS Policies - Gyms Table
-- ============================================

-- PUBLIC: Anyone can read basic gym info
CREATE POLICY "Public can read basic gym info"
  ON public.gyms FOR SELECT
  USING (true); -- All gym basic info is public

-- Gym owners can update their gym
CREATE POLICY "Owners can update their gym"
  ON public.gyms FOR UPDATE
  USING (owner_id = auth.uid());

-- Gym owners can delete their gym
CREATE POLICY "Owners can delete their gym"
  ON public.gyms FOR DELETE
  USING (owner_id = auth.uid());

-- Authenticated users can create gyms (crowdsourced)
CREATE POLICY "Authenticated users can create gyms"
  ON public.gyms FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- 7. RLS Policies - Gym Members Table
-- ============================================

-- Users can view their own memberships
CREATE POLICY "Users can view own memberships"
  ON public.gym_members FOR SELECT
  USING (user_id = auth.uid());

-- Gym owners/staff can view member list
CREATE POLICY "Gym staff can view members"
  ON public.gym_members FOR SELECT
  USING (
    gym_id IN (
      SELECT gc.gym_id FROM public.gym_coaches gc
      JOIN public.coach_profiles cp ON gc.coach_id = cp.id
      WHERE cp.user_id = auth.uid()
        AND gc.status = 'active'
        AND gc.can_view_member_list = true
    )
    OR
    gym_id IN (
      SELECT id FROM public.gyms WHERE owner_id = auth.uid()
    )
  );

-- Users can join gyms (create membership)
CREATE POLICY "Users can join gyms"
  ON public.gym_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own membership preferences
CREATE POLICY "Users can update own membership"
  ON public.gym_members FOR UPDATE
  USING (user_id = auth.uid());

-- Users can leave gyms (delete membership)
CREATE POLICY "Users can leave gyms"
  ON public.gym_members FOR DELETE
  USING (user_id = auth.uid());

-- Gym owners can manage memberships
CREATE POLICY "Gym owners can manage memberships"
  ON public.gym_members FOR ALL
  USING (
    gym_id IN (
      SELECT id FROM public.gyms WHERE owner_id = auth.uid()
    )
  );

-- ============================================
-- 8. RLS Policies - Gym Coaches Table
-- ============================================

-- Coaches can view their own gym assignments
CREATE POLICY "Coaches can view own gym assignments"
  ON public.gym_coaches FOR SELECT
  USING (
    coach_id IN (
      SELECT id FROM public.coach_profiles WHERE user_id = auth.uid()
    )
  );

-- Gym owners can view all coaches at their gym
CREATE POLICY "Gym owners can view gym coaches"
  ON public.gym_coaches FOR SELECT
  USING (
    gym_id IN (
      SELECT id FROM public.gyms WHERE owner_id = auth.uid()
    )
  );

-- Gym owners can add/manage coaches
CREATE POLICY "Gym owners can manage coaches"
  ON public.gym_coaches FOR ALL
  USING (
    gym_id IN (
      SELECT id FROM public.gyms WHERE owner_id = auth.uid()
    )
  );

-- Staff coaches can view other coaches at their gym
CREATE POLICY "Staff coaches can view fellow coaches"
  ON public.gym_coaches FOR SELECT
  USING (
    gym_id IN (
      SELECT gc.gym_id FROM public.gym_coaches gc
      JOIN public.coach_profiles cp ON gc.coach_id = cp.id
      WHERE cp.user_id = auth.uid()
        AND gc.status = 'active'
        AND gc.role IN ('staff', 'owner')
    )
  );

-- ============================================
-- 9. RLS Policies - Gym Traffic (CRUCIAL)
-- ============================================

-- STAFF: Gym coaches can read their gym's traffic data
CREATE POLICY "Gym coaches can read gym traffic"
  ON public.gym_traffic FOR SELECT
  USING (
    gym_id IN (
      SELECT gc.gym_id FROM public.gym_coaches gc
      JOIN public.coach_profiles cp ON gc.coach_id = cp.id
      WHERE cp.user_id = auth.uid()
        AND gc.status = 'active'
        AND gc.can_view_traffic_data = true
    )
  );

-- GYM OWNERS: Can always read their gym's traffic
CREATE POLICY "Gym owners can read gym traffic"
  ON public.gym_traffic FOR SELECT
  USING (
    gym_id IN (
      SELECT id FROM public.gyms WHERE owner_id = auth.uid()
    )
  );

-- MERCENARY (TRANSITIVE ACCESS):
-- Online coaches can read gym_traffic IF they have an athlete at that gym
-- This is the key policy that enables "see the pulse of your athlete's gym"
CREATE POLICY "Transitive coach access via athlete membership"
  ON public.gym_traffic FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM public.gym_members gm
      JOIN public.coach_athletes ca ON gm.user_id = ca.athlete_user_id
      JOIN public.coach_profiles cp ON ca.coach_id = cp.id
      WHERE gm.gym_id = gym_traffic.gym_id
        AND gm.status = 'active'
        AND ca.status = 'active'
        AND cp.user_id = auth.uid()
    )
  );

-- GYM MEMBERS: Members can see basic traffic data for their gym
CREATE POLICY "Members can read basic gym traffic"
  ON public.gym_traffic FOR SELECT
  USING (
    gym_id IN (
      SELECT gym_id FROM public.gym_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Only system can insert/update traffic data (via service role)
CREATE POLICY "System can manage traffic data"
  ON public.gym_traffic FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- 10. Helper Functions
-- ============================================

-- Function to find nearby gyms
CREATE OR REPLACE FUNCTION find_nearby_gyms(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 5000,
  limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  address TEXT,
  distance_meters DOUBLE PRECISION,
  member_count INTEGER,
  avg_rating NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.name,
    g.address,
    ST_Distance(
      g.location,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) as distance_meters,
    g.member_count,
    g.avg_rating
  FROM public.gyms g
  WHERE g.location IS NOT NULL
    AND ST_DWithin(
      g.location,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_meters
    )
  ORDER BY distance_meters
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current busyness for a gym
CREATE OR REPLACE FUNCTION get_gym_busyness(gym_uuid UUID)
RETURNS TABLE (
  current_busyness INTEGER,
  typical_busyness INTEGER,
  trend TEXT
) AS $$
DECLARE
  current_hour TIMESTAMPTZ;
  current_dow INTEGER;
BEGIN
  current_hour := date_trunc('hour', NOW());
  current_dow := EXTRACT(DOW FROM NOW())::INTEGER;
  
  RETURN QUERY
  WITH current_data AS (
    SELECT busyness_score
    FROM public.gym_traffic
    WHERE gym_id = gym_uuid
      AND hour_bucket = current_hour
    LIMIT 1
  ),
  typical_data AS (
    SELECT AVG(busyness_score)::INTEGER as avg_score
    FROM public.gym_traffic
    WHERE gym_id = gym_uuid
      AND day_of_week = current_dow
      AND EXTRACT(HOUR FROM hour_bucket) = EXTRACT(HOUR FROM current_hour)
  )
  SELECT 
    COALESCE((SELECT busyness_score FROM current_data), 0) as current_busyness,
    COALESCE((SELECT avg_score FROM typical_data), 0) as typical_busyness,
    CASE 
      WHEN COALESCE((SELECT busyness_score FROM current_data), 0) > 
           COALESCE((SELECT avg_score FROM typical_data), 0) + 10 THEN 'busier'
      WHEN COALESCE((SELECT busyness_score FROM current_data), 0) < 
           COALESCE((SELECT avg_score FROM typical_data), 0) - 10 THEN 'quieter'
      ELSE 'typical'
    END as trend;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 11. Triggers
-- ============================================

-- Update timestamps
CREATE TRIGGER trigger_gyms_updated
  BEFORE UPDATE ON public.gyms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_gym_members_updated
  BEFORE UPDATE ON public.gym_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_gym_coaches_updated
  BEFORE UPDATE ON public.gym_coaches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_gym_traffic_updated
  BEFORE UPDATE ON public.gym_traffic
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Update gym member count when members join/leave
CREATE OR REPLACE FUNCTION update_gym_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.gyms
    SET member_count = (
      SELECT COUNT(*) FROM public.gym_members
      WHERE gym_id = NEW.gym_id AND status = 'active'
    )
    WHERE id = NEW.gym_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE public.gyms
    SET member_count = (
      SELECT COUNT(*) FROM public.gym_members
      WHERE gym_id = OLD.gym_id AND status = 'active'
    )
    WHERE id = OLD.gym_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_gym_member_count
  AFTER INSERT OR UPDATE OR DELETE ON public.gym_members
  FOR EACH ROW EXECUTE FUNCTION update_gym_member_count();

-- ============================================
-- 12. Grant Permissions
-- ============================================

-- Grant access to authenticated users
GRANT SELECT ON public.gyms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gym_members TO authenticated;
GRANT SELECT ON public.gym_coaches TO authenticated;
GRANT SELECT ON public.gym_traffic TO authenticated;

-- Grant access to service role (for aggregation jobs)
GRANT ALL ON public.gyms TO service_role;
GRANT ALL ON public.gym_members TO service_role;
GRANT ALL ON public.gym_coaches TO service_role;
GRANT ALL ON public.gym_traffic TO service_role;

-- Grant function execution
GRANT EXECUTE ON FUNCTION find_nearby_gyms TO authenticated;
GRANT EXECUTE ON FUNCTION get_gym_busyness TO authenticated;
