import { supabase } from '@/lib/supabase/client'

// Keep this template in sync with scripts/create-keepalive-ping-function-public.sql
const KEEPALIVE_RPC_SQL = `
-- 1. Backing table (RLS-enabled from install time so Security Advisor stays clean
--    even before the first ping fires).
CREATE TABLE IF NOT EXISTS public._keepalive_temp (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ping_value text NOT NULL,
  pinged_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public._keepalive_temp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access" ON public._keepalive_temp;
CREATE POLICY "Allow all access" ON public._keepalive_temp
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public._keepalive_temp TO service_role;

-- 2. Ping function
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
`

/**
 * Extract the project ref from a Supabase URL.
 * e.g. "https://abcdefgh.supabase.co" → "abcdefgh"
 */
export function extractProjectRef(supabaseUrl: string): string | null {
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)
  return match ? match[1] : null
}

/**
 * Get the Supabase access token from the settings table.
 */
async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'supabase_access_token')
    .single()

  return data?.value || null
}

/**
 * Install the perform_keepalive_ping() RPC function on an external Supabase project
 * using the Supabase Management API.
 *
 * Requires a Supabase access token saved in settings.
 */
export async function installKeepAliveRpc(
  supabaseUrl: string
): Promise<{ success: boolean; error?: string }> {
  const projectRef = extractProjectRef(supabaseUrl)
  if (!projectRef) {
    return { success: false, error: 'Could not extract project ref from URL' }
  }

  const accessToken = await getAccessToken()
  if (!accessToken) {
    return {
      success: false,
      error: 'No Supabase access token configured. Add one in Settings to enable auto-setup.',
    }
  }

  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: KEEPALIVE_RPC_SQL }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[KeepAlive] Management API error (${res.status}):`, body)
      return {
        success: false,
        error: `Management API returned ${res.status}: ${body.slice(0, 200)}`,
      }
    }

    console.log(`[KeepAlive] Installed perform_keepalive_ping() on project ${projectRef}`)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[KeepAlive] Failed to install RPC:', msg)
    return { success: false, error: msg }
  }
}
