-- Create settings table for storing app configuration
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS family_memories.settings (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grant permissions
GRANT ALL ON family_memories.settings TO anon;

-- Disable RLS for settings table
ALTER TABLE family_memories.settings DISABLE ROW LEVEL SECURITY;

-- Insert default admin PIN
INSERT INTO family_memories.settings (key, value)
VALUES ('admin_pin', '2312')
ON CONFLICT (key) DO NOTHING;
