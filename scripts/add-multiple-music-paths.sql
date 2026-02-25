-- Add support for multiple background music tracks per presentation.
-- Run this in Supabase SQL Editor.

-- Add new jsonb column for array of music paths
ALTER TABLE family_memories.presentations
ADD COLUMN IF NOT EXISTS background_music_paths jsonb DEFAULT '[]'::jsonb;

-- Migrate existing single-path data to the new array column
UPDATE family_memories.presentations
SET background_music_paths = jsonb_build_array(background_music_path)
WHERE background_music_path IS NOT NULL
  AND (background_music_paths IS NULL OR background_music_paths = '[]'::jsonb);
