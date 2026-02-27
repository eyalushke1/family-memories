-- View events table for analytics tracking
-- Run this in Supabase SQL editor

CREATE TABLE IF NOT EXISTS family_memories.view_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id UUID NOT NULL,
  profile_id UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_watched_seconds INTEGER DEFAULT 0,
  clip_duration_seconds INTEGER,
  completion_percent SMALLINT DEFAULT 0,
  device_type VARCHAR(20) DEFAULT 'web',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_view_events_clip_id ON family_memories.view_events(clip_id);
CREATE INDEX IF NOT EXISTS idx_view_events_profile_id ON family_memories.view_events(profile_id);
CREATE INDEX IF NOT EXISTS idx_view_events_started_at ON family_memories.view_events(started_at);

-- Grant permissions
GRANT ALL ON family_memories.view_events TO service_role;
GRANT ALL ON family_memories.view_events TO anon;
GRANT ALL ON family_memories.view_events TO authenticated;

-- Enable RLS
ALTER TABLE family_memories.view_events ENABLE ROW LEVEL SECURITY;

-- Allow all access (app uses service_role key)
CREATE POLICY "Allow all access" ON family_memories.view_events
  FOR ALL USING (true) WITH CHECK (true);
