-- Creates the perform_keepalive_ping() function in the PUBLIC schema and its
-- backing _keepalive_temp table.
--
-- Run this ONCE in the Supabase SQL Editor of each external project you want to keep alive.
-- The app calls this function automatically to generate DDL + DML activity
-- that Supabase recognizes as real usage, preventing free-tier project pausing.
--
-- Why pre-create the table at install time:
--   The function drops and recreates public._keepalive_temp each ping (for DDL
--   activity), and enables RLS on the fresh table inside the function body.
--   But until the first ping fires, the table wouldn't exist — and if an older
--   version of the function created the table WITHOUT RLS, that pre-existing
--   table would trip the Supabase Security Advisor ("RLS Disabled in Public").
--   Creating the table here with RLS enabled means it is always in a safe state
--   from the moment the install script finishes.

-- ---------------------------------------------------------------------------
-- 1. Backing table (RLS-enabled from the start)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public._keepalive_temp (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ping_value text NOT NULL,
  pinged_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotent: enabling RLS on a table that already has it is a no-op.
ALTER TABLE public._keepalive_temp ENABLE ROW LEVEL SECURITY;

-- Recreate the policy so re-running this script always lands in a known state.
DROP POLICY IF EXISTS "Allow all access" ON public._keepalive_temp;
CREATE POLICY "Allow all access" ON public._keepalive_temp
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public._keepalive_temp TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Ping function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.perform_keepalive_ping()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Step 1: Drop the table (DDL activity)
  DROP TABLE IF EXISTS public._keepalive_temp;

  -- Step 2: Create a fresh table (DDL activity)
  CREATE TABLE public._keepalive_temp (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ping_value text NOT NULL,
    pinged_at timestamptz NOT NULL DEFAULT now()
  );

  -- Step 3: Enable RLS and policy on the fresh table BEFORE returning,
  -- so the table is never observable in public without RLS.
  ALTER TABLE public._keepalive_temp ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Allow all access" ON public._keepalive_temp
    FOR ALL USING (true) WITH CHECK (true);
  GRANT ALL ON public._keepalive_temp TO service_role;

  -- Step 4: Insert a row (DML activity)
  INSERT INTO public._keepalive_temp (ping_value)
  VALUES ('ping_' || extract(epoch from now())::text || '_' || gen_random_uuid()::text);

  RETURN jsonb_build_object(
    'status', 'success',
    'pinged_at', now()::text
  );
END;
$$;

-- Only service_role can call this function
REVOKE ALL ON FUNCTION public.perform_keepalive_ping() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.perform_keepalive_ping() FROM anon;
REVOKE ALL ON FUNCTION public.perform_keepalive_ping() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.perform_keepalive_ping() TO service_role;
