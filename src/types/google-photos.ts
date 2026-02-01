/**
 * Google Photos API types
 */

export interface GooglePhotosAlbum {
  id: string
  title: string
  productUrl: string
  mediaItemsCount: string
  coverPhotoBaseUrl: string
  coverPhotoMediaItemId: string
}

export interface GooglePhotosMediaItem {
  id: string
  description?: string
  productUrl: string
  baseUrl: string
  mimeType: string
  filename: string
  mediaMetadata: {
    creationTime: string
    width: string
    height: string
    photo?: {
      cameraMake?: string
      cameraModel?: string
      focalLength?: number
      apertureFNumber?: number
      isoEquivalent?: number
    }
    video?: {
      cameraMake?: string
      cameraModel?: string
      fps?: number
      status?: string
    }
  }
}

export interface GooglePhotosListAlbumsResponse {
  albums?: GooglePhotosAlbum[]
  nextPageToken?: string
}

export interface GooglePhotosSearchMediaItemsResponse {
  mediaItems?: GooglePhotosMediaItem[]
  nextPageToken?: string
}

export interface GooglePhotosListMediaItemsResponse {
  mediaItems?: GooglePhotosMediaItem[]
  nextPageToken?: string
}
