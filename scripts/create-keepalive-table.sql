-- Create supabase_keepalive_projects table for tracking Supabase projects to keep alive
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS family_memories.supabase_keepalive_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  supabase_url TEXT NOT NULL,
  service_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_ping_at TIMESTAMP WITH TIME ZONE,
  last_ping_status VARCHAR(20) DEFAULT 'never',
  last_ping_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grant table-level permissions to all PostgREST roles
GRANT ALL ON family_memories.supabase_keepalive_projects TO service_role;
GRANT ALL ON family_memories.supabase_keepalive_projects TO anon;
GRANT ALL ON family_memories.supabase_keepalive_projects TO authenticated;

-- Enable RLS
ALTER TABLE family_memories.supabase_keepalive_projects ENABLE ROW LEVEL SECURITY;

-- Allow all access (admin routes are PIN-protected at the API layer)
CREATE POLICY "Allow all access" ON family_memories.supabase_keepalive_projects
  FOR ALL USING (true) WITH CHECK (true);
