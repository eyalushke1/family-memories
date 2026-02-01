/**
 * Google Photos Picker API client
 *
 * The Picker API replaced the deprecated Library API scopes (April 2025).
 * Flow:
 * 1. Create a session - returns pickerUri for user to select photos
 * 2. Poll session until mediaItemsSet is true
 * 3. Fetch selected media items
 * 4. Delete session when done
 */

import { getValidAccessToken } from './oauth'

const PICKER_API_BASE = 'https://photospicker.googleapis.com/v1'

export interface PickerSession {
  id: string
  pickerUri: string
  expireTime: string
  mediaItemsSet: boolean
  pollingConfig?: {
    pollInterval: string
    timeoutIn: string
  }
}

// Raw response structure from Picker API
export interface PickerMediaItemRaw {
  id: string
  createTime: string
  type: 'PHOTO' | 'VIDEO'
  mediaFile: {
    baseUrl: string
    mimeType: string
    filename: string
    mediaFileMetadata?: {
      width: number
      height: number
      cameraMake?: string
      cameraModel?: string
      videoMetadata?: {
        fps: number
        processingStatus: string
      }
    }
  }
}

// Normalized structure for our use
export interface PickedMediaItem {
  id: string
  baseUrl: string
  mimeType: string
  filename: string
  type: 'PHOTO' | 'VIDEO'
  createTime: string
  width?: number
  height?: number
}

export interface PickerMediaItemsResponse {
  mediaItems: PickerMediaItemRaw[]
  nextPageToken?: string
}

/**
 * Factory function that creates a profile-scoped Picker client
 */
export function createPickerClient(profileId: string) {
  /**
   * Internal helper for API requests
   */
  async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const accessToken = await getValidAccessToken(profileId)

    if (!accessToken) {
      throw new Error('Google Photos not connected or token expired')
    }

    const url = `${PICKER_API_BASE}${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(`Picker API error: ${response.status}`, error)
      throw new Error(`Picker API error: ${response.status} ${error}`)
    }

    // Handle empty responses (like DELETE)
    const text = await response.text()
    if (!text) {
      return {} as T
    }
    return JSON.parse(text)
  }

  return {
    /**
     * Create a new picker session
     * Returns a pickerUri that the user opens to select photos
     */
    async createSession(): Promise<PickerSession> {
      const response = await apiRequest<PickerSession>('/sessions', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      console.log('[Picker] Created session:', response.id)
      return response
    },

    /**
     * Get session status
     * Poll this until mediaItemsSet is true
     */
    async getSession(sessionId: string): Promise<PickerSession> {
      return apiRequest<PickerSession>(`/sessions/${sessionId}`)
    },

    /**
     * Delete a session (cleanup)
     * Should be called after fetching media items
     * Ignores 404 errors (session already deleted)
     */
    async deleteSession(sessionId: string): Promise<void> {
      try {
        await apiRequest(`/sessions/${sessionId}`, {
          method: 'DELETE',
        })
        console.log('[Picker] Deleted session:', sessionId)
      } catch (err) {
        // Ignore 404 - session already deleted
        if (err instanceof Error && err.message.includes('404')) {
          console.log('[Picker] Session already deleted:', sessionId)
          return
        }
        throw err
      }
    },

    /**
     * List media items selected by user in a session
     * Only call after mediaItemsSet is true
     */
    async listMediaItems(
      sessionId: string,
      pageToken?: string
    ): Promise<PickerMediaItemsResponse> {
      const params = new URLSearchParams({
        sessionId,
        pageSize: '100',
      })
      if (pageToken) {
        params.set('pageToken', pageToken)
      }

      const response = await apiRequest<PickerMediaItemsResponse>(
        `/mediaItems?${params.toString()}`
      )

      return {
        mediaItems: response.mediaItems ?? [],
        nextPageToken: response.nextPageToken,
      }
    },

    /**
     * Normalize raw item to our internal format
     */
    normalizeMediaItem(raw: PickerMediaItemRaw): PickedMediaItem {
      return {
        id: raw.id,
        baseUrl: raw.mediaFile.baseUrl,
        mimeType: raw.mediaFile.mimeType,
        filename: raw.mediaFile.filename,
        type: raw.type,
        createTime: raw.createTime,
        width: raw.mediaFile.mediaFileMetadata?.width,
        height: raw.mediaFile.mediaFileMetadata?.height,
      }
    },

    /**
     * Get all media items from a session (handles pagination)
     * Returns normalized items
     */
    async getAllMediaItems(sessionId: string): Promise<PickedMediaItem[]> {
      const allItems: PickedMediaItem[] = []
      let pageToken: string | undefined

      do {
        const page = await this.listMediaItems(sessionId, pageToken)
        const normalized = page.mediaItems.map((item) => this.normalizeMediaItem(item))
        allItems.push(...normalized)
        pageToken = page.nextPageToken
      } while (pageToken)

      return allItems
    },

    /**
     * Build display URL with dimensions
     * baseUrl is valid for 60 minutes
     */
    getDisplayUrl(
      baseUrl: string,
      maxWidth = 2048,
      maxHeight = 2048
    ): string {
      return `${baseUrl}=w${maxWidth}-h${maxHeight}`
    },

    /**
     * Build thumbnail URL
     */
    getThumbnailUrl(baseUrl: string, size = 256): string {
      return `${baseUrl}=w${size}-h${size}-c`
    },

    /**
     * Build download URL for original
     * Append -d for images, -dv for videos
     */
    getDownloadUrl(baseUrl: string, mimeType?: string): string {
      const isVideo = mimeType?.startsWith('video/') ?? false
      return isVideo ? `${baseUrl}=dv` : `${baseUrl}=d`
    },
  }
}

export type PickerClient = ReturnType<typeof createPickerClient>
