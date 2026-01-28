# Standards for Foundation + Browse

The following standards apply to this work.

---

## database/supabase-best-practices

@agent-os/standards/database/supabase-best-practices.md

**Key points for this spec:**
- Single client in `lib/supabase/client.ts` with custom schema `family_memories`
- `isSupabaseConfigured` check in every API route
- Server-side only — all queries in `app/api/`, React fetches via `/api/...`
- Select specific columns, always `.order()` with `.range()` for pagination
- Batch inserts at 100 rows
- Fatal errors return error response, non-fatal log and continue

---

## database/types-structure

@agent-os/standards/database/types-structure.md

**Key points for this spec:**
- Nested `Database` interface with `family_memories` schema
- Flat aliases: `ProfileRow`, `InsertProfile`, `ClipRow`, `InsertClip`, `CategoryRow`, `MediaItemRow`
- Omit Update for immutable tables (media_items)

---

## storage/zadara-ngos

@agent-os/standards/storage/zadara-ngos.md

**Key points for this spec:**
- S3 client with `forcePathStyle: true`
- Factory pattern via `getStorage()` singleton
- All media served through `/api/media/files/{storageKey}` — never expose Zadara URLs
- Upload flow: FormData → storage.upload → Supabase metadata → proxy URL
- MediaPaths helpers for file path consistency

---

## storage/media-paths

@agent-os/standards/storage/media-paths.md

**Key points for this spec:**
- Adapted paths: `avatars/{profileId}/`, `thumbnails/{clipId}.webp`, `videos/{clipId}/`
- Add `animatedThumbnails()` helper for hover previews

---

## storage/provider-pattern

@agent-os/standards/storage/provider-pattern.md

**Key points for this spec:**
- `StorageProvider` interface: upload, download, getSignedUrl, delete, exists, list, copy
- `getStorage()` factory based on `STORAGE_TYPE` env var
- Singleton pattern, never instantiate providers directly

---

## api/response-envelope

**Standard:** `{ success: boolean, data?: T, error?: string }`

All API routes must return this envelope structure.

---

## api/supabase-check

**Standard:** Every API route checks `isSupabaseConfigured` before querying Supabase.

---

## components/styling

**Standard:** Use `cn()` utility (clsx + tailwind-merge) for conditional class composition. Tailwind dark mode tokens throughout.
