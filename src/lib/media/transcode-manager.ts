/**
 * In-memory transcode job manager.
 * Tracks async transcoding jobs so the watch page can poll for status.
 * Jobs are cleaned up after 1 hour to prevent memory leaks.
 */

export type TranscodeStatus = 'downloading' | 'transcoding' | 'uploading' | 'updating' | 'complete' | 'error'

export interface TranscodeJob {
  status: TranscodeStatus
  message: string
  /** Signed URL for the transcoded video (set when complete) */
  url?: string
  /** New video_path in storage (set when complete) */
  newVideoPath?: string
  error?: string
  startedAt: number
}

class TranscodeManager {
  private jobs = new Map<string, TranscodeJob>()

  get(storagePath: string): TranscodeJob | undefined {
    this.cleanup()
    return this.jobs.get(storagePath)
  }

  set(storagePath: string, job: TranscodeJob) {
    this.jobs.set(storagePath, job)
  }

  update(storagePath: string, partial: Partial<TranscodeJob>) {
    const job = this.jobs.get(storagePath)
    if (job) {
      Object.assign(job, partial)
    }
  }

  remove(storagePath: string) {
    this.jobs.delete(storagePath)
  }

  /** Remove stale jobs older than 1 hour */
  private cleanup() {
    const cutoff = Date.now() - 3600_000
    for (const [key, job] of this.jobs) {
      if (job.startedAt < cutoff) {
        this.jobs.delete(key)
      }
    }
  }
}

// Singleton — survives across requests in the same Cloud Run instance
export const transcodeManager = new TranscodeManager()
