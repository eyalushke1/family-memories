import { supabase } from '@/lib/supabase/client'

const KEEPALIVE_RPC_SQL = `
CREATE OR REPLACE FUNCTION public.perform_keepalive_ping()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Enable RLS and grant access
  ALTER TABLE public._keepalive_temp ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Allow all access" ON public._keepalive_temp
    FOR ALL USING (true) WITH CHECK (true);
  GRANT ALL ON public._keepalive_temp TO service_role;
  GRANT ALL ON public._keepalive_temp TO anon;
  GRANT ALL ON public._keepalive_temp TO authenticated;

  -- Step 3: Insert a row
  INSERT INTO public._keepalive_temp (ping_value)
  VALUES ('ping_' || extract(epoch from now())::text || '_' || gen_random_uuid()::text);

  RETURN jsonb_build_object(
    'status', 'success',
    'pinged_at', now()::text
  );
END;
$$;
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
