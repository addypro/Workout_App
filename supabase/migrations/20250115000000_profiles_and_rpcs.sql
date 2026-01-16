-- Profiles + Missing RPCs
-- Adds a minimal public.profiles table used by edge functions
-- and implements missing RPC helpers used by app services.

-- ============================================
-- 1. Profiles Table (public)
-- ============================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  raw_user_meta_data JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles: users can view own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Profiles: users can insert own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Profiles: users can update own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Backfill existing users
INSERT INTO public.profiles (id, display_name, raw_user_meta_data)
SELECT
  u.id,
  COALESCE(
    u.raw_user_meta_data->>'display_name',
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    u.email
  ),
  u.raw_user_meta_data
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
  updated_at = NOW();

-- Keep profiles in sync with auth.users
CREATE OR REPLACE FUNCTION public.handle_auth_user_upsert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, raw_user_meta_data)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.email
    ),
    NEW.raw_user_meta_data
  )
  ON CONFLICT (id) DO UPDATE SET
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_upsert();

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF raw_user_meta_data, email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_upsert();

-- Update timestamps
DROP TRIGGER IF EXISTS trigger_profiles_updated ON public.profiles;
CREATE TRIGGER trigger_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 2. RPC: increment_visits
-- ============================================

CREATE OR REPLACE FUNCTION public.increment_visits(p_gym_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_total INTEGER;
BEGIN
  UPDATE public.gym_members
  SET
    total_visits = COALESCE(total_visits, 0) + 1,
    last_check_in = NOW(),
    updated_at = NOW()
  WHERE gym_id = p_gym_id
    AND user_id = auth.uid()
    AND status = 'active'
  RETURNING total_visits INTO v_total;

  RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.increment_visits(UUID) TO authenticated;

-- ============================================
-- 3. RPC: increment_coach_exercise_usage
-- ============================================

CREATE OR REPLACE FUNCTION public.increment_coach_exercise_usage(exercise_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_coach_id UUID;
  v_owner_id UUID;
  v_total INTEGER;
BEGIN
  SELECT coach_id INTO v_coach_id
  FROM public.coach_exercises
  WHERE id = exercise_id;

  IF v_coach_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_owner_id
  FROM public.coach_profiles
  WHERE user_id = auth.uid();

  IF v_owner_id IS NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.coach_athletes
      WHERE coach_id = v_coach_id
        AND athlete_user_id = auth.uid()
        AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'Not authorized to increment usage';
    END IF;
  ELSIF v_owner_id <> v_coach_id THEN
    RAISE EXCEPTION 'Not authorized to increment usage';
  END IF;

  UPDATE public.coach_exercises
  SET
    usage_count = COALESCE(usage_count, 0) + 1,
    updated_at = NOW()
  WHERE id = exercise_id
  RETURNING usage_count INTO v_total;

  RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.increment_coach_exercise_usage(UUID) TO authenticated;

-- ============================================
-- 4. RPC: increment_quick_workout_assigned
-- ============================================

CREATE OR REPLACE FUNCTION public.increment_quick_workout_assigned(
  workout_id UUID,
  increment_by INTEGER DEFAULT 1
)
RETURNS INTEGER AS $$
DECLARE
  v_coach_id UUID;
  v_owner_id UUID;
  v_increment INTEGER;
  v_total INTEGER;
BEGIN
  v_increment := COALESCE(increment_by, 1);
  IF v_increment < 0 THEN
    RAISE EXCEPTION 'increment_by must be positive';
  END IF;

  SELECT coach_id INTO v_coach_id
  FROM public.coach_quick_workouts
  WHERE id = workout_id;

  IF v_coach_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_owner_id
  FROM public.coach_profiles
  WHERE user_id = auth.uid();

  IF v_owner_id IS NULL OR v_owner_id <> v_coach_id THEN
    RAISE EXCEPTION 'Not authorized to increment assignments';
  END IF;

  UPDATE public.coach_quick_workouts
  SET
    times_assigned = COALESCE(times_assigned, 0) + v_increment,
    updated_at = NOW()
  WHERE id = workout_id
  RETURNING times_assigned INTO v_total;

  RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.increment_quick_workout_assigned(UUID, INTEGER) TO authenticated;
