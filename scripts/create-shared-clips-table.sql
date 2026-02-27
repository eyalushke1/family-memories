-- Shared clips table for shareable links
-- Run this in Supabase SQL editor

CREATE TABLE IF NOT EXISTS family_memories.shared_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id UUID NOT NULL,
  share_token VARCHAR(32) NOT NULL UNIQUE,
  created_by_profile_id UUID,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_shared_clips_token ON family_memories.shared_clips(share_token);
CREATE INDEX IF NOT EXISTS idx_shared_clips_clip_id ON family_memories.shared_clips(clip_id);

-- Grant permissions
GRANT ALL ON family_memories.shared_clips TO service_role;
GRANT ALL ON family_memories.shared_clips TO anon;
GRANT ALL ON family_memories.shared_clips TO authenticated;

-- Enable RLS
ALTER TABLE family_memories.shared_clips ENABLE ROW LEVEL SECURITY;

-- Allow all access (app uses service_role key)
CREATE POLICY "Allow all access" ON family_memories.shared_clips
  FOR ALL USING (true) WITH CHECK (true);
