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

-- Grant table-level permissions to service_role
GRANT ALL ON family_memories.supabase_keepalive_projects TO service_role;

-- Enable RLS (service_role key bypasses it, blocks anon/authenticated direct access)
ALTER TABLE family_memories.supabase_keepalive_projects ENABLE ROW LEVEL SECURITY;

-- Deny all direct access — only service_role can access (same pattern as google_oauth_tokens)
CREATE POLICY "Deny all direct access" ON family_memories.supabase_keepalive_projects
  FOR ALL USING (false);
