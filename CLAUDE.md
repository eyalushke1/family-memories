# CLAUDE.md

Project-specific instructions for Claude Code.

## Project Overview

Family Memories — a private Netflix-style streaming platform for families. Next.js 16 App Router with TypeScript, Supabase (PostgreSQL), Zadara NGOS storage, and Tailwind CSS 4.

## Key Architecture

- **Database schema**: All tables are under the `family_memories` Supabase schema
- **Supabase client**: `src/lib/supabase/client.ts` — singleton with `{ db: { schema: 'family_memories' } }`
- **API pattern**: All API routes use `checkSupabase()` guard + `successResponse()`/`errorResponse()` helpers from `src/lib/api/`
- **Types**: `src/types/database.ts` has the full `Database` interface with `Row`, `Insert`, `Update` per table, plus flat aliases like `ClipRow`, `InsertClip`
- **Admin auth**: PIN-based via `AdminAuthGuard` component + sessionStorage. No server-side auth middleware for admin routes.
- **Profile identity**: `fm-profile-id` cookie (UUID), read via `document.cookie.match(/fm-profile-id=([^;]+)/)`
- **State**: Zustand stores in `src/stores/`
- **Styling**: Tailwind CSS with custom CSS variables (`bg-bg-card`, `text-text-primary`, `border-border`, etc.)

## Analytics Tracking

View events flow: client `trackViewStart/trackViewProgress/trackViewEnd` (in `src/lib/analytics/track-view.ts`) → POST `/api/analytics/track` → `view_events` Supabase table. Four reliability layers: heartbeat (15s interval), visibilitychange, beforeunload (sendBeacon), React cleanup. Tracking fires on `playState` change (not video `onPlaying`) to cover both video and presentation clips.

## SQL Migrations

Run manually in Supabase SQL Editor. Located in `scripts/*.sql`. Not auto-applied.

## Common Commands

```bash
npm run dev          # Dev server on :3000
npm run build        # Production build
npx tsc --noEmit     # Type check
```

## Code Conventions

- `'use client'` at top of client components
- API responses: `{ success: true, data: T }` or `{ success: false, error: string }`
- Flat type aliases: `{Table}Row`, `Insert{Table}`, `Update{Table}`
- No raw SQL in API routes — use Supabase SDK fluent API
- Fire-and-forget for analytics — never block playback
- `sendBeacon` for reliable tracking on page unload
- Use refs (not state) in tracking closures to avoid stale values
