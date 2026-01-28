# Foundation + Browse — Implementation Plan

Netflix-style family memories streaming app. This phase: project setup, DB schema, profile selection, and browse experience.

---

## Architecture Decisions

1. **Profile session:** Zustand store + `fm-profile-id` cookie. No URL params.
2. **Preview behavior:** Animated WebP thumbnails on hover (Phase 1). Video preview deferred to Phase 2.
3. **TV layout:** Single responsive layout with `tv:` breakpoint at 1920px. No separate route.
4. **Row scroll:** Custom horizontal scroll with arrow buttons + CSS scroll-snap.
5. **Schema:** `family_memories` (new Supabase schema).

---

## Database Schema

Tables in `family_memories` schema:

- **profiles** — id (UUID), name, avatar_path, is_admin, created_at, updated_at
- **categories** — id (UUID), name, slug (unique), sort_order, is_active, created_at
- **clips** — id (UUID), title, description, category_id (FK), video_path, thumbnail_path, animated_thumbnail_path, duration_seconds, sort_order, is_active, created_at, updated_at
- **media_items** — id (UUID), storage_path (unique), content_type, size_bytes, original_filename, created_at

---

## Tasks

### Task 1: Save Spec Documentation
### Task 2: Next.js Project Init
### Task 3: Supabase Client + Database Types
### Task 4: Storage Layer (Zadara)
### Task 5: API Response Types + Helpers
### Task 6: Media Proxy API Route
### Task 7: Profiles API Routes
### Task 8: Categories + Clips API Routes
### Task 9: Zustand Profile Store
### Task 10: Profile Selection Page (/)
### Task 11: Browse Page Layout (/browse)
### Task 12: Category Row + Scroll Controls
### Task 13: Clip Card with Hover Preview
### Task 14: Shared UI Components + Theme
### Task 15: Page Transitions + Animations
### Task 16: Watch Stub Page
### Task 17: Docker + Cloud Run Config
### Task 18: Seed Data Script

See full plan at `.claude/plans/hazy-juggling-cocke.md` for detailed task descriptions.

---

## Execution Order

```
T1 → T2 → T3+T4+T5 → T6+T7+T8 → T9+T14 → T10+T11 → T12+T13 → T15+T16 → T17+T18
```

## Standards Applied

- database/supabase-best-practices
- database/types-structure
- storage/zadara-ngos
- storage/media-paths
- storage/provider-pattern
- api/response-envelope
- api/supabase-check
- components/styling
