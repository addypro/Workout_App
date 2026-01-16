-- Feature Flags Remote Config
-- Stores feature flags that can be toggled without app release

CREATE TABLE IF NOT EXISTS app_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category, key)
);

-- Create index for category lookups
CREATE INDEX IF NOT EXISTS idx_app_config_category ON app_config(category);

-- Enable RLS
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Allow public read access (flags are not sensitive)
CREATE POLICY "Public read access" ON app_config
  FOR SELECT USING (true);

-- Only service role can modify
CREATE POLICY "Service role write" ON app_config
  FOR ALL USING (auth.role() = 'service_role');

-- Insert default feature flags
INSERT INTO app_config (category, key, value) VALUES
  ('feature_flag', 'challenges', '{"enabled": true, "rolloutPercent": 100}'::jsonb),
  ('feature_flag', 'leagues_v2', '{"enabled": true, "rolloutPercent": 100}'::jsonb),
  ('feature_flag', 'ghost_users', '{"enabled": false, "rolloutPercent": 0}'::jsonb),
  ('feature_flag', 'smart_screener', '{"enabled": true, "rolloutPercent": 100}'::jsonb),
  ('feature_flag', 'gym', '{"enabled": false, "rolloutPercent": 0}'::jsonb),
  ('feature_flag', 'voice_vad', '{"enabled": true, "rolloutPercent": 100}'::jsonb),
  ('feature_flag', 'voice_streaming', '{"enabled": false, "rolloutPercent": 0}'::jsonb)
ON CONFLICT (category, key) DO NOTHING;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_app_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_config_updated_at ON app_config;
CREATE TRIGGER app_config_updated_at
  BEFORE UPDATE ON app_config
  FOR EACH ROW
  EXECUTE FUNCTION update_app_config_timestamp();
