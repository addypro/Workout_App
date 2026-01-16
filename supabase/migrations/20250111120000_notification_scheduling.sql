-- Coach Workflow Notifications Scheduling
-- Adds pg_cron jobs to trigger notification edge functions

-- ============================================
-- ENABLE PG_CRON EXTENSION (if not already)
-- ============================================
-- Note: pg_cron must be enabled in Supabase project settings first
-- This migration assumes it's already enabled

-- ============================================
-- SCHEDULE WORKOUT REMINDERS
-- Runs daily at 8:00 AM UTC
-- ============================================

SELECT cron.schedule(
  'send-workout-reminders',           -- Job name
  '0 8 * * *',                        -- 8:00 AM UTC daily
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/send-workout-reminders',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- ============================================
-- SCHEDULE INCOMPLETE WORKOUT CHECK
-- Runs daily at 9:00 PM UTC
-- ============================================

SELECT cron.schedule(
  'check-incomplete-workouts',        -- Job name
  '0 21 * * *',                       -- 9:00 PM UTC daily
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/check-incomplete-workouts',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- ============================================
-- VIEW SCHEDULED JOBS
-- ============================================
-- Run this to verify jobs are scheduled:
-- SELECT * FROM cron.job;

-- ============================================
-- TO UNSCHEDULE (if needed)
-- ============================================
-- SELECT cron.unschedule('send-workout-reminders');
-- SELECT cron.unschedule('check-incomplete-workouts');

-- ============================================
-- ALTERNATIVE: Supabase Edge Function Scheduler
-- ============================================
-- If pg_cron is not available, use Supabase's built-in
-- function scheduler via the Dashboard:
--
-- 1. Go to Database > Extensions > Enable pg_cron
-- 2. Go to Edge Functions > Your Function > Schedules
-- 3. Add schedule: "0 8 * * *" for reminders
-- 4. Add schedule: "0 21 * * *" for incomplete check
