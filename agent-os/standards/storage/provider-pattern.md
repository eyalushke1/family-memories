# Storage Provider Pattern

Abstract storage behind an interface to switch between providers.

**Interface:**
```ts
interface StorageProvider {
  upload(path: string, data: Buffer | Blob | ReadableStream, options?: UploadOptions): Promise<StorageFile>;
  download(path: string): Promise<Buffer>;
  getSignedUrl(path: string, expiresInSeconds?: number): Promise<string>;
  getPublicUrl(path: string): string;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  list(prefix: string): Promise<StorageFile[]>;
  copy(sourcePath: string, destPath: string): Promise<StorageFile>;
}
```

**Factory function:**
```ts
import { getStorage } from '@/lib/storage';

const storage = getStorage(); // Returns provider based on STORAGE_TYPE env var
await storage.upload('path/to/file.jpg', buffer, { contentType: 'image/jpeg' });
```

**Environment config:**
```bash
STORAGE_TYPE=zadara   # or 'r2', 'local', 'gcs'
```

**Implementations:**
- `ZadaraStorageProvider` — Zadara NGOS S3-compatible (current primary, see `zadara-ngos.md`)
- `R2StorageProvider` — Cloudflare R2 S3-compatible (alternative)
- `LocalStorageProvider` — Filesystem (dev fallback)
- `GCSStorageProvider` — Google Cloud Storage (stub, requires async init)

**Rules:**
- Never instantiate providers directly — use `getStorage()` factory
- Use `getStorageAsync()` only if GCS is needed (dynamic import)
- Provider is a singleton — created once, reused across requests
