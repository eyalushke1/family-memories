// Ping interval in hours (default: 6 hours, 4x/day, well within the 7-day pause window)
// Set KEEPALIVE_INTERVAL_HOURS env var to override (e.g. "12" for every 12 hours)
const intervalHours = Number(process.env.KEEPALIVE_INTERVAL_HOURS) || 6
export const PING_INTERVAL_MS = intervalHours * 60 * 60 * 1000

// Timeout for each individual ping request
export const PING_TIMEOUT_MS = 10_000
