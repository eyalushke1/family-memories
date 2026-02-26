-- Add theme preference column to profiles table
-- Run this in Supabase SQL Editor
-- Values: 'dark' (default) or 'light'

ALTER TABLE family_memories.profiles
  ADD COLUMN IF NOT EXISTS theme varchar DEFAULT 'dark';
