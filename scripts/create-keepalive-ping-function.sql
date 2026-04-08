-- Creates the perform_keepalive_ping() function for maximum database activity.
-- This generates DDL + DML operations that Supabase counts as real activity,
-- preventing free-tier project pausing.
-- Run this in Supabase SQL Editor (once per project).

CREATE OR REPLACE FUNCTION family_memories.perform_keepalive_ping()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = family_memories
AS $$
DECLARE
  rows_updated int;
BEGIN
  -- Step 1: Drop temp table if it exists from a previous run
  DROP TABLE IF EXISTS family_memories._keepalive_temp;

  -- Step 2: Create fresh temp table
  CREATE TABLE family_memories._keepalive_temp (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ping_value text NOT NULL,
    pinged_at timestamptz NOT NULL DEFAULT now()
  );

  -- Step 3: Enable RLS on temp table
  ALTER TABLE family_memories._keepalive_temp ENABLE ROW LEVEL SECURITY;

  -- Step 4: Create RLS policy
  CREATE POLICY "Allow all access" ON family_memories._keepalive_temp
    FOR ALL USING (true) WITH CHECK (true);

  -- Step 5: Grant permissions
  GRANT ALL ON family_memories._keepalive_temp TO service_role;
  GRANT ALL ON family_memories._keepalive_temp TO anon;
  GRANT ALL ON family_memories._keepalive_temp TO authenticated;

  -- Step 6: Insert a random row (write activity)
  INSERT INTO family_memories._keepalive_temp (ping_value)
  VALUES ('ping_' || extract(epoch from now())::text || '_' || gen_random_uuid()::text);

  -- Step 7: Delete the row (write activity)
  DELETE FROM family_memories._keepalive_temp;

  -- Step 8: Drop the temp table (cleanup)
  DROP TABLE IF EXISTS family_memories._keepalive_temp;

  -- Step 9: Update all active keepalive projects with current ping time
  UPDATE family_memories.supabase_keepalive_projects
  SET
    last_ping_at = now(),
    last_ping_status = 'success',
    last_ping_error = NULL,
    updated_at = now()
  WHERE is_active = true;

  GET DIAGNOSTICS rows_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'status', 'success',
    'pinged_at', now()::text,
    'projects_updated', rows_updated,
    'operations', jsonb_build_array(
      'drop_table', 'create_table', 'enable_rls', 'create_policy',
      'grant_permissions', 'insert', 'delete', 'drop_table', 'update_projects'
    )
  );
END;
$$;
