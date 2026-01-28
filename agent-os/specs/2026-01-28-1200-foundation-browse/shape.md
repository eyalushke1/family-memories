# Foundation + Browse — Shaping Notes

## Scope

Build the foundation and browse experience for a private Netflix-style family memories streaming app:
- Next.js project setup with Tailwind, Framer Motion, shadcn/ui
- Supabase integration (family_memories schema) for metadata
- Zadara NGOS storage layer with API proxy pattern
- Profile selection screen (Netflix "Who's watching?")
- Category-based browse page with horizontal scroll rows
- Clip cards with animated WebP hover previews
- Watch stub page with basic HTML5 video player
- Docker containerization for Google Cloud Run deployment

## Decisions

- **Profile session**: Zustand store + cookie (`fm-profile-id`). No URL params to avoid leaking profile info.
- **Preview on hover**: Animated WebP thumbnails (not video) for Phase 1. Simpler, no streaming overhead.
- **TV support**: Same responsive layout with larger breakpoint (`tv: 1920px`). No separate route.
- **Row scrolling**: Custom scroll with arrow buttons + CSS scroll-snap. Matches Netflix pattern.
- **DB schema**: New `family_memories` schema in Supabase (not `finance_eom` from other projects).
- **No auth for MVP**: Profile-based access via cookie. Real auth can be layered later.
- **Media always proxied**: All files served through `/api/media/files/` — never expose Zadara URLs.

## Context

- **Visuals:** None provided. Netflix.com is the primary UX reference.
- **References:** No existing code (fresh project, initial commit only).
- **Product alignment:** Directly implements Phase 1 MVP from `agent-os/product/roadmap.md` (Profile Selection + Browse Experience + Media Storage sections). Video Player and Admin Panel are deferred to later specs.

## Standards Applied

- `database/supabase-best-practices` — Client singleton, isSupabaseConfigured checks, server-side only queries, pagination with ORDER BY
- `database/types-structure` — Database interface with Row/Insert/Update per table, flat type aliases
- `storage/zadara-ngos` — S3 client with forcePathStyle, API proxy for all media, upload/download flows
- `storage/media-paths` — MediaPaths helpers for avatars, thumbnails, videos
- `storage/provider-pattern` — StorageProvider interface, getStorage() factory singleton
- `api/response-envelope` — { success, data, error } response structure
- `api/supabase-check` — Database configuration check at route level
- `components/styling` — cn() utility, Tailwind dark mode tokens
