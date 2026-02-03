import { promises as fs } from 'fs'
import path from 'path'
import type { StorageProvider, StorageFile, UploadOptions } from './types'

const LOCAL_STORAGE_DIR = path.join(process.cwd(), '.local-storage')

export class LocalStorageProvider implements StorageProvider {
  private async ensureDir(filePath: string) {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
  }

  private resolvePath(storagePath: string): string {
    return path.join(LOCAL_STORAGE_DIR, storagePath)
  }

  async upload(storagePath: string, data: Buffer | Uint8Array, options?: UploadOptions): Promise<StorageFile> {
    const fullPath = this.resolvePath(storagePath)
    await this.ensureDir(fullPath)
    await fs.writeFile(fullPath, data)
    return { path: storagePath, size: data.length, contentType: options?.contentType }
  }

  async download(storagePath: string): Promise<Buffer> {
    return fs.readFile(this.resolvePath(storagePath))
  }

  async getSignedUrl(storagePath: string): Promise<string> {
    return `/api/media/files/${storagePath}`
  }

  async getUploadUrl(): Promise<string> {
    // Local storage doesn't support presigned uploads
    // Return empty string to indicate client should use regular upload
    return ''
  }

  getPublicUrl(storagePath: string): string {
    return `/api/media/files/${storagePath}`
  }

  async delete(storagePath: string): Promise<void> {
    await fs.unlink(this.resolvePath(storagePath)).catch(() => {})
  }

  async exists(storagePath: string): Promise<boolean> {
    try {
      await fs.access(this.resolvePath(storagePath))
      return true
    } catch {
      return false
    }
  }

  async list(prefix: string): Promise<StorageFile[]> {
    const dir = this.resolvePath(prefix)
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      return entries
        .filter((e) => e.isFile())
        .map((e) => ({ path: `${prefix}${e.name}` }))
    } catch {
      return []
    }
  }

  async copy(sourcePath: string, destPath: string): Promise<StorageFile> {
    const src = this.resolvePath(sourcePath)
    const dest = this.resolvePath(destPath)
    await this.ensureDir(dest)
    await fs.copyFile(src, dest)
    return { path: destPath }
  }
}
