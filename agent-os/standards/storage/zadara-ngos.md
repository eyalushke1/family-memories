# Zadara NGOS Object Storage

Primary storage provider. On-prem/hybrid S3-compatible object storage via Zadara NextGen.

## Connection Setup

**Required env vars:**
```bash
STORAGE_TYPE=zadara
ZADARA_ENDPOINT=https://vsa-XXXXX-public-REGION.zadarazios.com
ZADARA_REGION=us-east-1
ZADARA_ACCESS_KEY_ID=<key>
ZADARA_SECRET_ACCESS_KEY=<secret>
ZADARA_BUCKET_NAME=family-memories
ZADARA_PUBLIC_URL=https://vsa-XXXXX-public-REGION.zadarazios.com/family-memories
```

**Endpoint format gotcha:** The endpoint is the VSA public URL from the Zadara portal. Format: `https://vsa-{id}-public-{location}.zadarazios.com`. Do NOT include the bucket name in the endpoint — only in `ZADARA_PUBLIC_URL`.

## S3 Compatibility

Uses `@aws-sdk/client-s3`. Two critical settings:

```ts
new S3Client({
  endpoint: config.endpoint,
  forcePathStyle: true,  // REQUIRED — Zadara uses path-style, not virtual-hosted
  region: config.region,  // Set to us-east-1 even for non-US instances
  credentials: { accessKeyId, secretAccessKey },
});
```

- `forcePathStyle: true` — Always required. Zadara does not support virtual-hosted style URLs.
- `region` — Use `us-east-1` as default. Zadara ignores region for routing but the SDK requires it.

## Usage

Always use the factory — never instantiate `ZadaraStorageProvider` directly:

```ts
import { getStorage } from '@/lib/storage';

const storage = getStorage(); // Returns ZadaraStorageProvider when STORAGE_TYPE=zadara

// Upload
await storage.upload('uploads/photo.jpg', buffer, { contentType: 'image/jpeg' });

// Download
const data = await storage.download('uploads/photo.jpg');

// Signed URL (default 1 hour expiry)
const url = await storage.getSignedUrl('uploads/photo.jpg', 3600);

// Check existence
const exists = await storage.exists('uploads/photo.jpg');

// List files by prefix
const files = await storage.list('uploads/');

// Copy
await storage.copy('uploads/photo.jpg', 'backups/photo.jpg');

// Delete
await storage.delete('uploads/photo.jpg');
```

## URL Patterns

- **Public URL:** `{ZADARA_PUBLIC_URL}/{path}` (path-style)
- **Signed URL:** Generated via `@aws-sdk/s3-request-presigner`, expires in 1 hour default
- **API proxy:** Always serve files through `/api/media/files/{storageKey}` — never expose direct Zadara URLs to the client

**Why API proxy:** Decouples client URLs from storage provider. Enables auth, caching, and seamless provider migration.

## Upload Flow

```
Client → POST /api/upload (FormData with file + folder)
  → getStorage().upload(path, buffer, { contentType, metadata })
  → Store metadata in Supabase media_items table
  → Return API proxy URL: /api/media/files/{storagePath}
```

## Download Flow

```
Client → GET /api/media/files/{...path}
  → getStorage().download(storagePath)
  → Return with Cache-Control: public, max-age=86400
```

## Metadata

S3 metadata keys must be lowercase alphanumeric + hyphens. The provider sanitizes automatically:
```ts
// Input:  { 'Original Name': 'photo.jpg' }
// Stored: { 'original-name': 'photo.jpg' }
```

## File Size Limits

- Videos: 500MB max
- Images/Audio: 150MB max
- Validated server-side in `/api/upload`

## File Path Convention

Use `MediaPaths` helpers — see `storage/media-paths.md`.

## Testing Connection

```bash
npx tsx scripts/test-zadara.ts
```

Tests: config validation → upload → exists → download → list → signed URL → delete.

## Singleton Pattern

`getStorage()` returns a cached singleton. The S3Client is created once and reused across all requests. Use `resetStorageInstance()` only in tests.

# =============================================================================
# =============================================================================
# Zadara NextGen Object Storage (S3-compatible)
# =============================================================================
# Step 1: Get Endpoint URL from Zadara Management UI → Object Storage → Settings
# Format: https://vsa-XXXXX-public-REGION.zadarazios.com
# ZADARA_ENDPOINT=https://vsa-00000029-public-il-interoplab-01.zadarazios.com

# Step 2: Get Region from Zadara Management UI → Object Storage → Settings
# Default is usually: us-east-1
# ZADARA_REGION=us-east-1

# Step 3: Get S3 Access Key from Zadara Management UI → Object Storage → Account → S3 Keys
# Click "Create Key" if you don't have one
# ZADARA_ACCESS_KEY_ID=14bba297ebed4cc190bb416fa0506979

# Step 4: Get S3 Secret Key (shown only once when creating the key)
# ZADARA_SECRET_ACCESS_KEY=2f9d505979ae405ea4ff10bc5c08d6a2

# Step 5: Your bucket name (create in Zadara Management UI → Object Storage → Buckets)
# ZADARA_BUCKET_NAME=family-memories

# Step 6: Public URL for accessing files (if bucket has public read enabled)
# Format: https://ENDPOINT/BUCKET_NAME or custom domain
# ZADARA_PUBLIC_URL=https://vsa-00000029-public-il-interoplab-01.zadarazios.com/family-memories
