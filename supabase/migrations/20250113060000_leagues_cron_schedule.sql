-- CRON Job Setup for League Processing
-- Runs every Sunday at 23:59 UTC to process weekly rankings

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the weekly league processing
-- Cron expression: 59 23 * * 0 = 23:59 UTC every Sunday
DO $$
BEGIN
  -- Remove existing schedule if it exists
  PERFORM cron.unschedule('process-leagues-weekly');
EXCEPTION
  WHEN OTHERS THEN
    -- Job doesn't exist, continue
    NULL;
END $$;

SELECT cron.schedule(
  'process-leagues-weekly',
  '59 23 * * 0',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/process-leagues',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Add a comment for documentation
COMMENT ON EXTENSION pg_cron IS 'Schedules process-leagues edge function every Sunday 23:59 UTC';
