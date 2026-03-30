-- Creates the perform_keepalive_ping() function in the PUBLIC schema.
-- Run this ONCE in the Supabase SQL Editor of each external project you want to keep alive.
-- The app calls this function automatically to generate DDL + DML activity
-- that Supabase recognizes as real usage, preventing free-tier project pausing.

CREATE OR REPLACE FUNCTION public.perform_keepalive_ping()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Step 1: Drop the table
  DROP TABLE IF EXISTS public._keepalive_temp;

  -- Step 2: Create a fresh table
  CREATE TABLE public._keepalive_temp (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ping_value text NOT NULL,
    pinged_at timestamptz NOT NULL DEFAULT now()
  );

  -- Step 3: Insert a row
  INSERT INTO public._keepalive_temp (ping_value)
  VALUES ('ping_' || extract(epoch from now())::text || '_' || gen_random_uuid()::text);

  RETURN jsonb_build_object(
    'status', 'success',
    'pinged_at', now()::text
  );
END;
$$;
