export interface UploadOptions {
  contentType?: string
  metadata?: Record<string, string>
}

export interface StorageFile {
  path: string
  size?: number
  lastModified?: Date
  contentType?: string
}

export interface FileMetadata {
  size: number
  contentType?: string
  lastModified?: Date
}

export interface StorageProvider {
  upload(path: string, data: Buffer | Uint8Array, options?: UploadOptions): Promise<StorageFile>
  download(path: string): Promise<Buffer>
  // New methods for efficient streaming of large files
  getMetadata(path: string): Promise<FileMetadata>
  downloadRange(path: string, start: number, end: number): Promise<Buffer>
  getSignedUrl(path: string, expiresInSeconds?: number): Promise<string>
  getUploadUrl(path: string, contentType: string, expiresInSeconds?: number): Promise<string>
  getPublicUrl(path: string): string
  delete(path: string): Promise<void>
  exists(path: string): Promise<boolean>
  list(prefix: string): Promise<StorageFile[]>
  copy(sourcePath: string, destPath: string): Promise<StorageFile>
}
