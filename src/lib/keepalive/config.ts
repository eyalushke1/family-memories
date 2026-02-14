// Ping every 6 hours (4x/day, well within the 7-day pause window)
export const PING_INTERVAL_MS = 6 * 60 * 60 * 1000

// Timeout for each individual ping request
export const PING_TIMEOUT_MS = 10_000
