import { createHmac } from 'crypto'

const COOKIE_NAME = 'fm-profile-id'
const SIGNATURE_COOKIE = 'fm-profile-sig'

function getSecret(): string {
  return process.env.COOKIE_SECRET || process.env.SUPABASE_KEY || 'dev-fallback-secret'
}

/**
 * Create an HMAC signature for a profile ID.
 */
export function signProfileId(profileId: string): string {
  return createHmac('sha256', getSecret()).update(profileId).digest('hex')
}

/**
 * Verify that a profile ID cookie has a valid signature.
 * Returns the profile ID if valid, null otherwise.
 */
export function verifyProfileCookie(cookies: { get(name: string): { value: string } | undefined }): string | null {
  const profileId = cookies.get(COOKIE_NAME)?.value
  const signature = cookies.get(SIGNATURE_COOKIE)?.value

  if (!profileId || !signature) {
    return null
  }

  // Validate UUID format
  if (!isValidUUID(profileId)) {
    return null
  }

  const expectedSig = signProfileId(profileId)

  // Timing-safe comparison
  if (signature.length !== expectedSig.length) {
    return null
  }

  const a = Buffer.from(signature, 'hex')
  const b = Buffer.from(expectedSig, 'hex')

  if (a.length !== b.length) {
    return null
  }

  // Use constant-time comparison
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a[i] ^ b[i]
  }

  return mismatch === 0 ? profileId : null
}

/**
 * Validate UUID v4 format.
 */
export function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export { COOKIE_NAME, SIGNATURE_COOKIE }
