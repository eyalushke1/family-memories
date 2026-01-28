-- Family Memories — Database Schema
-- Run in Supabase SQL Editor

-- Create schema
CREATE SCHEMA IF NOT EXISTS family_memories;

-- Profiles table
CREATE TABLE family_memories.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  avatar_path VARCHAR(500),
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Categories table
CREATE TABLE family_memories.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_sort ON family_memories.categories (sort_order ASC);

-- Clips table
CREATE TABLE family_memories.clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(300) NOT NULL,
  description TEXT,
  category_id UUID NOT NULL REFERENCES family_memories.categories(id),
  video_path VARCHAR(500) NOT NULL,
  thumbnail_path VARCHAR(500),
  animated_thumbnail_path VARCHAR(500),
  duration_seconds INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clips_category ON family_memories.clips (category_id);
CREATE INDEX idx_clips_active_sort ON family_memories.clips (is_active, sort_order ASC);

-- Media items table (tracks all files in Zadara)
CREATE TABLE family_memories.media_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path VARCHAR(500) NOT NULL UNIQUE,
  content_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL,
  original_filename VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_items_path ON family_memories.media_items (storage_path);
