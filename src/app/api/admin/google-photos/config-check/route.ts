import { NextRequest } from 'next/server'
import { validateGoogleConfig, GOOGLE_OAUTH_CONFIG } from '@/lib/google/config'
import { successResponse, errorResponse } from '@/lib/api/response'

/**
 * GET /api/admin/google-photos/config-check
 * Diagnostic endpoint to verify Google OAuth configuration on Cloud Run
 */
export async function GET(request: NextRequest) {

  try {
    const validation = validateGoogleConfig()

    // Check TOKEN_ENCRYPTION_KEY separately
    const hasEncryptionKey = !!process.env.TOKEN_ENCRYPTION_KEY

    // Build configuration status report
    const config = {
      clientIdSet: !!GOOGLE_OAUTH_CONFIG.clientId,
      clientIdPreview: GOOGLE_OAUTH_CONFIG.clientId
        ? `${GOOGLE_OAUTH_CONFIG.clientId.substring(0, 20)}...`
        : null,
      clientSecretSet: !!GOOGLE_OAUTH_CONFIG.clientSecret,
      redirectUri: GOOGLE_OAUTH_CONFIG.redirectUri || null,
      tokenEncryptionKeySet: hasEncryptionKey,
      scopes: GOOGLE_OAUTH_CONFIG.scopes,
      isValid: validation.valid,
      validationError: validation.error || null,
    }

    // Provide helpful suggestions if not valid
    const suggestions: string[] = []
    if (!config.clientIdSet) {
      suggestions.push('Set GOOGLE_CLIENT_ID environment variable')
    }
    if (!config.clientSecretSet) {
      suggestions.push('Set GOOGLE_CLIENT_SECRET environment variable')
    }
    if (!config.redirectUri) {
      suggestions.push('Set GOOGLE_REDIRECT_URI environment variable')
    } else if (!config.redirectUri.includes('/api/auth/google/callback')) {
      suggestions.push(`GOOGLE_REDIRECT_URI should end with /api/auth/google/callback. Current: ${config.redirectUri}`)
    }
    if (!config.tokenEncryptionKeySet) {
      suggestions.push('Set TOKEN_ENCRYPTION_KEY environment variable (32+ character random string)')
    }

    return successResponse({
      config,
      suggestions,
      requestUrl: request.url,
      expectedCallbackPath: '/api/auth/google/callback',
    })
  } catch (err) {
    console.error('[Config Check] Error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse(`Config check failed: ${message}`)
  }
}
