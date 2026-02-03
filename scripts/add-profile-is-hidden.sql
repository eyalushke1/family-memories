-- Add is_hidden column to profiles table
-- Run this in Supabase SQL Editor

ALTER TABLE family_memories.profiles
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE NOT NULL;
