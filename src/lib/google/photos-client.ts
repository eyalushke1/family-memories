/**
 * Google Photos Library API client
 *
 * Uses factory pattern per standards: Factory returns profile-scoped client
 * that handles token management internally.
 */

import type {
  GooglePhotosAlbum,
  GooglePhotosMediaItem,
  GooglePhotosListAlbumsResponse,
  GooglePhotosSearchMediaItemsResponse,
  GooglePhotosListMediaItemsResponse,
} from '@/types/google-photos'
import { getValidAccessToken } from './oauth'

const PHOTOS_API_BASE = 'https://photoslibrary.googleapis.com/v1'

// Pagination defaults per standards
const DEFAULT_ALBUM_PAGE_SIZE = 50
const DEFAULT_MEDIA_PAGE_SIZE = 100

/**
 * Factory function that creates a profile-scoped Google Photos client
 * Per standards: Factory returns API client bound to a profile
 */
export function createPhotosClient(profileId: string) {
  /**
   * Internal helper that handles token injection per request
   * Fetches fresh token before each request to handle refresh
   */
  async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const accessToken = await getValidAccessToken(profileId)

    if (!accessToken) {
      throw new Error('Google Photos not connected or token expired')
    }

    const url = `${PHOTOS_API_BASE}${endpoint}`
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
      console.error(`Google Photos API error: ${response.status}`, error)
      throw new Error(`Google Photos API error: ${response.status} ${error}`)
    }

    return response.json()
  }

  return {
    /**
     * List albums with pagination
     * Per standards: Default pageSize 50 for albums
     */
    async listAlbums(pageToken?: string): Promise<{ albums: GooglePhotosAlbum[]; nextPageToken?: string }> {
      const params = new URLSearchParams({ pageSize: String(DEFAULT_ALBUM_PAGE_SIZE) })
      if (pageToken) {
        params.set('pageToken', pageToken)
      }

      const response = await apiRequest<GooglePhotosListAlbumsResponse>(
        `/albums?${params.toString()}`
      )

      // Per standards: Always handle empty arrays
      return {
        albums: response.albums ?? [],
        nextPageToken: response.nextPageToken,
      }
    },

    /**
     * List shared albums with pagination
     */
    async listSharedAlbums(pageToken?: string): Promise<{ sharedAlbums: GooglePhotosAlbum[]; nextPageToken?: string }> {
      const params = new URLSearchParams({ pageSize: String(DEFAULT_ALBUM_PAGE_SIZE) })
      if (pageToken) {
        params.set('pageToken', pageToken)
      }

      const response = await apiRequest<{ sharedAlbums?: GooglePhotosAlbum[]; nextPageToken?: string }>(
        `/sharedAlbums?${params.toString()}`
      )

      return {
        sharedAlbums: response.sharedAlbums ?? [],
        nextPageToken: response.nextPageToken,
      }
    },

    /**
     * Get all albums (handles pagination)
     * Per standards: do/while with pageToken
     */
    async getAllAlbums(): Promise<GooglePhotosAlbum[]> {
      const allAlbums: GooglePhotosAlbum[] = []
      let pageToken: string | undefined

      // Fetch regular albums
      do {
        const page = await this.listAlbums(pageToken)
        allAlbums.push(...page.albums)
        pageToken = page.nextPageToken
      } while (pageToken)

      // Fetch shared albums
      pageToken = undefined
      do {
        const page = await this.listSharedAlbums(pageToken)
        allAlbums.push(...page.sharedAlbums)
        pageToken = page.nextPageToken
      } while (pageToken)

      console.log(`Fetched ${allAlbums.length} total albums (regular + shared)`)
      return allAlbums
    },

    /**
     * Get media items in an album with pagination
     * Per standards: Default pageSize 100 for media items
     */
    async getAlbumMedia(
      albumId: string,
      pageToken?: string
    ): Promise<{ mediaItems: GooglePhotosMediaItem[]; nextPageToken?: string }> {
      const body: { albumId: string; pageSize: number; pageToken?: string } = {
        albumId,
        pageSize: DEFAULT_MEDIA_PAGE_SIZE,
      }
      if (pageToken) {
        body.pageToken = pageToken
      }

      const response = await apiRequest<GooglePhotosSearchMediaItemsResponse>(
        '/mediaItems:search',
        {
          method: 'POST',
          body: JSON.stringify(body),
        }
      )

      return {
        mediaItems: response.mediaItems ?? [],
        nextPageToken: response.nextPageToken,
      }
    },

    /**
     * Get all media items in an album (handles pagination)
     */
    async getAllAlbumMedia(albumId: string): Promise<GooglePhotosMediaItem[]> {
      const allItems: GooglePhotosMediaItem[] = []
      let pageToken: string | undefined

      do {
        const page = await this.getAlbumMedia(albumId, pageToken)
        allItems.push(...page.mediaItems)
        pageToken = page.nextPageToken
      } while (pageToken)

      return allItems
    },

    /**
     * List all media items (not album-specific)
     */
    async listMediaItems(pageToken?: string): Promise<{ mediaItems: GooglePhotosMediaItem[]; nextPageToken?: string }> {
      const params = new URLSearchParams({ pageSize: String(DEFAULT_MEDIA_PAGE_SIZE) })
      if (pageToken) {
        params.set('pageToken', pageToken)
      }

      const response = await apiRequest<GooglePhotosListMediaItemsResponse>(
        `/mediaItems?${params.toString()}`
      )

      return {
        mediaItems: response.mediaItems ?? [],
        nextPageToken: response.nextPageToken,
      }
    },

    /**
     * Get a specific media item by ID
     * Per standards: Always fetch fresh URL before download (baseUrl expires)
     */
    async getMediaItem(mediaItemId: string): Promise<GooglePhotosMediaItem> {
      return apiRequest<GooglePhotosMediaItem>(`/mediaItems/${mediaItemId}`)
    },

    /**
     * Get multiple media items by IDs
     * Per standards: API max 50 items per batchGet
     */
    async batchGetMediaItems(mediaItemIds: string[]): Promise<GooglePhotosMediaItem[]> {
      // Chunk into batches of 50 per standards
      const BATCH_SIZE = 50
      const allItems: GooglePhotosMediaItem[] = []

      for (let i = 0; i < mediaItemIds.length; i += BATCH_SIZE) {
        const chunk = mediaItemIds.slice(i, i + BATCH_SIZE)
        const params = new URLSearchParams()
        chunk.forEach((id) => params.append('mediaItemIds', id))

        const response = await apiRequest<{ mediaItemResults: { mediaItem?: GooglePhotosMediaItem; status?: { message: string } }[] }>(
          `/mediaItems:batchGet?${params.toString()}`
        )

        const items = response.mediaItemResults
          .filter((result) => result.mediaItem)
          .map((result) => result.mediaItem!)

        allItems.push(...items)
      }

      return allItems
    },

    /**
     * Get download URL for a media item
     * Per standards: baseUrl expires after ~60 minutes
     *
     * URL suffixes:
     * - =d — Download original image
     * - =dv — Download original video
     * - =w{width}-h{height} — Thumbnail at specified dimensions
     */
    getDownloadUrl(mediaItem: GooglePhotosMediaItem, maxWidth = 2048, maxHeight = 2048): string {
      const isVideo = mediaItem.mimeType.startsWith('video/')
      if (isVideo) {
        return `${mediaItem.baseUrl}=dv`
      }
      return `${mediaItem.baseUrl}=w${maxWidth}-h${maxHeight}`
    },

    /**
     * Get fresh download URL by fetching media item first
     * Per standards: Always fetch fresh URL before download
     */
    async getFreshDownloadUrl(mediaItemId: string, maxWidth = 2048, maxHeight = 2048): Promise<string> {
      const item = await this.getMediaItem(mediaItemId)
      return this.getDownloadUrl(item, maxWidth, maxHeight)
    },
  }
}

// Export type for the client
export type PhotosClient = ReturnType<typeof createPhotosClient>

// Legacy class for backward compatibility (deprecated)
export class GooglePhotosClient {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
    console.warn('GooglePhotosClient class is deprecated. Use createPhotosClient(profileId) factory instead.')
  }

  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${PHOTOS_API_BASE}${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Google Photos API error: ${response.status} ${error}`)
    }

    return response.json()
  }

  async listAlbums(pageToken?: string) {
    const params = new URLSearchParams({ pageSize: '50' })
    if (pageToken) params.set('pageToken', pageToken)
    const response = await this.fetch<GooglePhotosListAlbumsResponse>(`/albums?${params.toString()}`)
    return { albums: response.albums ?? [], nextPageToken: response.nextPageToken }
  }

  async listSharedAlbums(pageToken?: string) {
    const params = new URLSearchParams({ pageSize: '50' })
    if (pageToken) params.set('pageToken', pageToken)
    const response = await this.fetch<{ sharedAlbums?: GooglePhotosAlbum[]; nextPageToken?: string }>(`/sharedAlbums?${params.toString()}`)
    return { sharedAlbums: response.sharedAlbums ?? [], nextPageToken: response.nextPageToken }
  }

  async getAllAlbums(): Promise<GooglePhotosAlbum[]> {
    const albums: GooglePhotosAlbum[] = []
    let pageToken: string | undefined
    do {
      const response = await this.listAlbums(pageToken)
      albums.push(...response.albums)
      pageToken = response.nextPageToken
    } while (pageToken)
    pageToken = undefined
    do {
      const response = await this.listSharedAlbums(pageToken)
      albums.push(...response.sharedAlbums)
      pageToken = response.nextPageToken
    } while (pageToken)
    return albums
  }

  async getAlbumMedia(albumId: string, pageToken?: string) {
    const body: { albumId: string; pageSize: number; pageToken?: string } = { albumId, pageSize: 100 }
    if (pageToken) body.pageToken = pageToken
    const response = await this.fetch<GooglePhotosSearchMediaItemsResponse>('/mediaItems:search', { method: 'POST', body: JSON.stringify(body) })
    return { mediaItems: response.mediaItems ?? [], nextPageToken: response.nextPageToken }
  }

  async getAllAlbumMedia(albumId: string): Promise<GooglePhotosMediaItem[]> {
    const items: GooglePhotosMediaItem[] = []
    let pageToken: string | undefined
    do {
      const response = await this.getAlbumMedia(albumId, pageToken)
      items.push(...response.mediaItems)
      pageToken = response.nextPageToken
    } while (pageToken)
    return items
  }

  async listMediaItems(pageToken?: string) {
    const params = new URLSearchParams({ pageSize: '100' })
    if (pageToken) params.set('pageToken', pageToken)
    const response = await this.fetch<GooglePhotosListMediaItemsResponse>(`/mediaItems?${params.toString()}`)
    return { mediaItems: response.mediaItems ?? [], nextPageToken: response.nextPageToken }
  }

  async getMediaItem(mediaItemId: string): Promise<GooglePhotosMediaItem> {
    return this.fetch<GooglePhotosMediaItem>(`/mediaItems/${mediaItemId}`)
  }

  async getMediaItems(mediaItemIds: string[]): Promise<GooglePhotosMediaItem[]> {
    const params = new URLSearchParams()
    mediaItemIds.forEach((id) => params.append('mediaItemIds', id))
    const response = await this.fetch<{ mediaItemResults: { mediaItem?: GooglePhotosMediaItem }[] }>(`/mediaItems:batchGet?${params.toString()}`)
    return response.mediaItemResults.filter((r) => r.mediaItem).map((r) => r.mediaItem!)
  }

  getDownloadUrl(mediaItem: GooglePhotosMediaItem, maxWidth = 2048, maxHeight = 2048): string {
    const isVideo = mediaItem.mimeType.startsWith('video/')
    return isVideo ? `${mediaItem.baseUrl}=dv` : `${mediaItem.baseUrl}=w${maxWidth}-h${maxHeight}`
  }
}
