/**
 * Playback buffer helpers.
 *
 * The players used to start as soon as readyState >= 2 (HAVE_CURRENT_DATA),
 * which only guarantees the current frame — playback would begin with an empty
 * buffer and stall almost immediately. These helpers let a player wait until a
 * real amount of media is buffered ahead before starting.
 */

/** Seconds of media to have buffered ahead of the playhead before starting. */
export const MIN_BUFFER_AHEAD_SECONDS = 2

/** How long to wait for that buffer before starting anyway. */
export const BUFFER_WAIT_TIMEOUT_MS = 8000

/**
 * Seconds of contiguous buffered media ahead of the current playhead.
 * Returns 0 when the playhead is not inside a buffered range.
 */
export function bufferedAhead(video: HTMLVideoElement): number {
  const t = video.currentTime
  for (let i = 0; i < video.buffered.length; i++) {
    if (video.buffered.start(i) <= t && t <= video.buffered.end(i)) {
      return video.buffered.end(i) - t
    }
  }
  return 0
}

/**
 * Resolve once `seconds` of media are buffered ahead of the playhead.
 *
 * Resolves early if the browser reports it can play through, or if the
 * remaining clip is shorter than the requested buffer. Always resolves by
 * `timeoutMs` so a slow network delays playback rather than blocking it
 * forever. Returns true when the buffer target was actually met.
 */
export function waitForBufferedAhead(
  video: HTMLVideoElement,
  seconds: number = MIN_BUFFER_AHEAD_SECONDS,
  timeoutMs: number = BUFFER_WAIT_TIMEOUT_MS
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false

    const finish = (reached: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      clearInterval(poll)
      video.removeEventListener('progress', check)
      video.removeEventListener('canplaythrough', onCanPlayThrough)
      resolve(reached)
    }

    const check = () => {
      // A clip shorter than the target buffer can never reach it.
      const remaining = isFinite(video.duration)
        ? video.duration - video.currentTime
        : Infinity
      const target = Math.min(seconds, Math.max(0, remaining - 0.25))

      if (target <= 0 || bufferedAhead(video) >= target) finish(true)
    }

    const onCanPlayThrough = () => finish(true)

    const timer = setTimeout(() => finish(false), timeoutMs)
    // 'progress' can be sparse on some browsers/TVs, so poll as well.
    const poll = setInterval(check, 150)

    video.addEventListener('progress', check)
    video.addEventListener('canplaythrough', onCanPlayThrough)

    check()
  })
}
