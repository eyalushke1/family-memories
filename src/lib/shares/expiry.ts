// How long a share link stays valid. Shared by the share dialog (UI chips) and
// the shares API (validation), so the two can never drift apart.
export const SHARE_EXPIRY_DAY_OPTIONS = [1, 7, 30]

// Pre-selected when the share dialog opens.
export const DEFAULT_SHARE_EXPIRY_DAYS = 7

/**
 * Parse a client-supplied expiryDays value. Accepts a number or a numeric string
 * (booleans, arrays and other loose types are rejected rather than coerced).
 * Returns null when the value is not one of the allowed durations.
 */
export function parseExpiryDays(raw: unknown): number | null {
  if (typeof raw !== 'number' && typeof raw !== 'string') return null
  const days = Number(raw)
  return SHARE_EXPIRY_DAY_OPTIONS.includes(days) ? days : null
}
