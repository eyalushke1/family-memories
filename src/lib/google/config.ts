/**
 * Google OAuth configuration
 */

export const GOOGLE_OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
  scopes: [
    // Picker API scope - replaces deprecated photoslibrary.readonly (removed April 2025)
    'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
  ],
}

export function validateGoogleConfig(): { valid: boolean; error?: string } {
  if (!GOOGLE_OAUTH_CONFIG.clientId) {
    return { valid: false, error: 'GOOGLE_CLIENT_ID environment variable is not set' }
  }
  if (!GOOGLE_OAUTH_CONFIG.clientSecret) {
    return { valid: false, error: 'GOOGLE_CLIENT_SECRET environment variable is not set' }
  }
  if (!GOOGLE_OAUTH_CONFIG.redirectUri) {
    return { valid: false, error: 'GOOGLE_REDIRECT_URI environment variable is not set' }
  }
  return { valid: true }
}

export function getTokenEncryptionKey(): string {
  const key = process.env.TOKEN_ENCRYPTION_KEY
  if (!key) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is not set')
  }
  return key
}
