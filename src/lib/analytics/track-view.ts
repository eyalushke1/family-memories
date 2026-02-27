export async function trackViewStart(
  clipId: string,
  profileId: string | null,
  deviceType: string
): Promise<string | null> {
  try {
    const res = await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', clipId, profileId, deviceType }),
    })
    const json = await res.json()
    if (!json.success) {
      console.warn('[Analytics] Track start failed:', json.error)
      return null
    }
    console.log('[Analytics] View started:', json.data?.viewEventId)
    return json.data?.viewEventId ?? null
  } catch (err) {
    console.error('[Analytics] Failed to track view start:', err)
    return null
  }
}

/**
 * Periodic heartbeat — updates progress on the existing row without setting ended_at.
 * Called every ~15s while the video is playing so we never lose more than 15s of data
 * if the user force-closes the browser/tab.
 */
export function trackViewProgress(
  viewEventId: string | null,
  durationWatched: number,
  clipDuration: number,
  completionPercent: number
): void {
  if (!viewEventId) return

  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'progress',
      viewEventId,
      durationWatched: Math.round(durationWatched),
      clipDuration: Math.round(clipDuration),
      completionPercent: Math.round(Math.min(completionPercent, 100)),
    }),
  }).catch(() => {})
}

/**
 * Final end signal — uses sendBeacon for reliability during page unload.
 * Sets ended_at on the row to mark the view as complete.
 */
export function trackViewEnd(
  viewEventId: string | null,
  durationWatched: number,
  clipDuration: number,
  completionPercent: number
): void {
  if (!viewEventId) return

  const body = JSON.stringify({
    action: 'end',
    viewEventId,
    durationWatched: Math.round(durationWatched),
    clipDuration: Math.round(clipDuration),
    completionPercent: Math.round(Math.min(completionPercent, 100)),
  })

  // Use sendBeacon for reliability on page unload, fall back to fetch
  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon(
      '/api/analytics/track',
      new Blob([body], { type: 'application/json' })
    )
    if (sent) return
  }

  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {})
}
