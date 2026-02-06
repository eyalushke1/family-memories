/**
 * Google OAuth flow helpers
 */

import { google } from 'googleapis'
import { GOOGLE_OAUTH_CONFIG, getTokenEncryptionKey } from './config'
import { encrypt, decrypt } from '../crypto/encryption'
import { supabase } from '../supabase/client'

export interface GoogleTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  scope: string
}

/**
 * Create OAuth2 client
 */
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_OAUTH_CONFIG.clientId,
    GOOGLE_OAUTH_CONFIG.clientSecret,
    GOOGLE_OAUTH_CONFIG.redirectUri
  )
}

/**
 * Generate authorization URL
 */
export function getAuthorizationUrl(state: string): string {
  const oauth2Client = createOAuth2Client()

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_OAUTH_CONFIG.scopes,
    state,
    prompt: 'consent', // Force consent to get refresh token
  })
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const oauth2Client = createOAuth2Client()

  const { tokens } = await oauth2Client.getToken(code)

  console.log('Token exchange - received scope:', tokens.scope)
  console.log('Token exchange - has access_token:', !!tokens.access_token)
  console.log('Token exchange - has refresh_token:', !!tokens.refresh_token)

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Missing access_token or refresh_token in response')
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600 * 1000),
    scope: tokens.scope || GOOGLE_OAUTH_CONFIG.scopes.join(' '),
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const oauth2Client = createOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: refreshToken })

  const { credentials } = await oauth2Client.refreshAccessToken()

  if (!credentials.access_token) {
    throw new Error('Failed to refresh access token')
  }

  return {
    accessToken: credentials.access_token,
    refreshToken: credentials.refresh_token || refreshToken,
    expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + 3600 * 1000),
    scope: credentials.scope || GOOGLE_OAUTH_CONFIG.scopes.join(' '),
  }
}

/**
 * Store tokens in database (encrypted)
 */
export async function storeTokens(profileId: string, tokens: GoogleTokens): Promise<void> {
  const encryptionKey = getTokenEncryptionKey()

  const encryptedAccessToken = encrypt(tokens.accessToken, encryptionKey)
  const encryptedRefreshToken = encrypt(tokens.refreshToken, encryptionKey)

  const { error } = await supabase
    .from('google_oauth_tokens')
    .upsert({
      profile_id: profileId,
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      expires_at: tokens.expiresAt.toISOString(),
      scope: tokens.scope,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'profile_id',
    })

  if (error) {
    throw new Error(`Failed to store tokens: ${error.message}`)
  }
}

/**
 * Retrieve tokens from database (decrypted)
 */
export async function getStoredTokens(profileId: string): Promise<GoogleTokens | null> {
  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .select('*')
    .eq('profile_id', profileId)
    .single()

  if (error || !data) {
    return null
  }

  const encryptionKey = getTokenEncryptionKey()

  return {
    accessToken: decrypt(data.access_token, encryptionKey),
    refreshToken: decrypt(data.refresh_token, encryptionKey),
    expiresAt: new Date(data.expires_at),
    scope: data.scope,
  }
}

/**
 * Get valid access token (refresh if needed)
 */
export async function getValidAccessToken(profileId: string): Promise<string | null> {
  const tokens = await getStoredTokens(profileId)

  if (!tokens) {
    console.log('[OAuth Debug] No tokens found for profile:', profileId)
    return null
  }

  console.log('[OAuth Debug] Stored token scope:', tokens.scope)
  console.log('[OAuth Debug] Expected scope:', GOOGLE_OAUTH_CONFIG.scopes.join(' '))
  console.log('[OAuth Debug] Token expires at:', tokens.expiresAt)

  // Check if token is expired (with 5-minute buffer)
  const isExpired = tokens.expiresAt.getTime() < Date.now() + 5 * 60 * 1000

  if (isExpired) {
    console.log('[OAuth Debug] Token expired, refreshing...')
    try {
      const newTokens = await refreshAccessToken(tokens.refreshToken)
      console.log('[OAuth Debug] Refreshed token scope:', newTokens.scope)
      await storeTokens(profileId, newTokens)
      return newTokens.accessToken
    } catch (err) {
      // Refresh failed - token may be revoked or expired
      console.error('[OAuth Debug] Token refresh failed:', err)
      // Auto-delete stale tokens so status correctly shows "not connected"
      console.log('[OAuth Debug] Deleting stale tokens for profile:', profileId)
      await deleteTokens(profileId).catch(() => {})
      return null
    }
  }

  return tokens.accessToken
}

/**
 * Delete tokens from database
 */
export async function deleteTokens(profileId: string): Promise<void> {
  const { error } = await supabase
    .from('google_oauth_tokens')
    .delete()
    .eq('profile_id', profileId)

  if (error) {
    throw new Error(`Failed to delete tokens: ${error.message}`)
  }
}

/**
 * Check if profile has Google Photos connected
 */
export async function isGooglePhotosConnected(profileId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .select('id')
    .eq('profile_id', profileId)
    .single()

  return !error && !!data
}
