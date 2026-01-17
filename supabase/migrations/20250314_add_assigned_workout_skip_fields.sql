-- Add scheduled_at and skip metadata to assigned_workouts

ALTER TABLE public.assigned_workouts
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS skipped_reason_code TEXT,
  ADD COLUMN IF NOT EXISTS skipped_reason_text TEXT,
  ADD COLUMN IF NOT EXISTS skipped_at TIMESTAMPTZ;

COMMENT ON COLUMN public.assigned_workouts.skipped_reason_code IS 'Reason code: unwell, alternative, no_time, gym_closed, other';
