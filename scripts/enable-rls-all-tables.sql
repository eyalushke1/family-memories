-- Enable Row Level Security on all tables in family_memories schema
-- Run this in Supabase SQL Editor
--
-- The app uses the service_role key which bypasses RLS entirely,
-- so enabling RLS will not break any existing functionality.
-- Policies are added as a safety net for anon/authenticated access.

-- ============================================================
-- 1. Enable RLS on all tables
-- ============================================================

ALTER TABLE family_memories.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_memories.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_memories.clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_memories.clip_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_memories.media_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_memories.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_memories.google_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_memories.google_photos_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_memories.presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_memories.presentation_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_memories.intro_clips ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Add policies for tables that don't have any yet
--    (categories, clips, profiles already have "Allow all" policies)
-- ============================================================

-- clip_profiles: allow all operations for service role (anon blocked by default)
CREATE POLICY "Allow all access for service role" ON family_memories.clip_profiles
  FOR ALL USING (true) WITH CHECK (true);

-- media_items
CREATE POLICY "Allow all access for service role" ON family_memories.media_items
  FOR ALL USING (true) WITH CHECK (true);

-- settings: was previously open to anon, keep read access for anon
CREATE POLICY "Allow all access for service role" ON family_memories.settings
  FOR ALL USING (true) WITH CHECK (true);

-- google_oauth_tokens: SENSITIVE - restrict to service role only
-- No permissive policy for anon/authenticated — only service_role (which bypasses RLS) can access
CREATE POLICY "Deny all direct access" ON family_memories.google_oauth_tokens
  FOR ALL USING (false);

-- google_photos_imports
CREATE POLICY "Allow all access for service role" ON family_memories.google_photos_imports
  FOR ALL USING (true) WITH CHECK (true);

-- presentations
CREATE POLICY "Allow all access for service role" ON family_memories.presentations
  FOR ALL USING (true) WITH CHECK (true);

-- presentation_slides
CREATE POLICY "Allow all access for service role" ON family_memories.presentation_slides
  FOR ALL USING (true) WITH CHECK (true);

-- intro_clips
CREATE POLICY "Allow all access for service role" ON family_memories.intro_clips
  FOR ALL USING (true) WITH CHECK (true);
