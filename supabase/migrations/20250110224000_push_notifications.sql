-- ============================================
-- Push Notifications Schema
-- ============================================
-- Stores device push tokens for sending notifications

CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  push_token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one token per user-device combo
  CONSTRAINT unique_user_push_token UNIQUE (user_id, push_token)
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id
  ON public.user_push_tokens(user_id);

-- Enable RLS
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can view their own tokens
CREATE POLICY "Users can view own tokens"
  ON public.user_push_tokens FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own tokens
CREATE POLICY "Users can insert own tokens"
  ON public.user_push_tokens FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own tokens
CREATE POLICY "Users can update own tokens"
  ON public.user_push_tokens FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own tokens
CREATE POLICY "Users can delete own tokens"
  ON public.user_push_tokens FOR DELETE
  USING (user_id = auth.uid());

-- Service role can read all tokens (for sending notifications)
CREATE POLICY "Service role can read all tokens"
  ON public.user_push_tokens FOR SELECT
  TO service_role
  USING (true);

-- Update timestamp trigger
CREATE TRIGGER trigger_user_push_tokens_updated
  BEFORE UPDATE ON public.user_push_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
