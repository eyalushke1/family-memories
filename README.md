# Family Memories

A private Netflix-style streaming platform for families. Browse, watch, and share family video clips and photo slideshows on web and TV.

## Features

- **Browse & Watch** — Netflix-style grid with categories, animated thumbnails, and full-screen video player
- **TV Mode** — Optimized interface for LG WebOS and other smart TVs with remote-friendly navigation
- **Photo Slideshows** — Turn family photos into presentations with transitions and background music
- **Intro Clips** — Optional branded intro videos before clips (like the Netflix "ta-dum")
- **Profile System** — Multiple family member profiles with avatars and themes
- **Google Photos Import** — Import photos directly from Google Photos albums
- **Analytics Dashboard** — Real-time view tracking with per-profile stats, top clips, and watch trends
- **Admin Panel** — Manage clips, categories, profiles, intros, music, and analytics (PIN-protected)
- **Supabase Keep-Alive** — Automated pinging to prevent free-tier Supabase projects from pausing

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | Supabase (PostgreSQL, `family_memories` schema) |
| Storage | Zadara NGOS (S3-compatible) |
| Styling | Tailwind CSS 4 |
| Charts | Recharts |
| State | Zustand |
| Icons | Lucide React |
| Animations | Framer Motion |

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A Zadara NGOS or S3-compatible storage bucket

### Setup

1. Clone the repo and install dependencies:

```bash
git clone https://github.com/eyalushke1/family-memories.git
cd family-memories
npm install
```

2. Copy the environment template and fill in your values:

```bash
cp .env.local.example .env.local
```

3. Run the SQL migrations in your Supabase SQL Editor (in order):

```
scripts/create-view-events-table.sql
scripts/create-keepalive-table.sql
scripts/enable-rls-all-tables.sql
```

4. Start the dev server:

```bash
npm run dev
```

## Project Structure

```
src/
  app/
    admin/           # Admin panel (PIN-protected)
      analytics/     # View tracking dashboard
      categories/    # Category management
      clips/         # Clip management
      intros/        # Intro clip management
      profiles/      # Profile management
      google-photos/ # Google Photos import
      settings/      # App settings
    browse/          # Main browse page
    watch/[clipId]/  # Desktop video player
    tv/              # TV mode (browse + watch)
    api/             # API routes
      admin/         # Admin API endpoints
      analytics/     # View tracking API
  components/        # Reusable UI components
  lib/
    analytics/       # Client-side view tracking (trackViewStart, trackViewProgress, trackViewEnd)
    api/             # API helpers (response format, supabase check)
    supabase/        # Supabase client and config
    storage/         # Zadara/S3 storage utilities
    media/           # Media format detection and transcoding
  types/             # TypeScript type definitions
  stores/            # Zustand state stores
scripts/             # SQL migrations and utility scripts
```

## Analytics

View tracking records every clip play across web and TV with a 4-layer reliability model:

| Layer | Trigger | Purpose |
|-------|---------|---------|
| Heartbeat | Every 15s while playing | Survives browser crash / force close |
| `visibilitychange` | Tab switch, minimize | Captures tab-away events |
| `beforeunload` | Tab/window close | Sends final progress via `sendBeacon` |
| React cleanup | Component unmount | Handles in-app navigation |

Data is stored in the `view_events` Supabase table and aggregated by the `/api/admin/analytics` endpoint.

## Environment Variables

See [.env.local.example](.env.local.example) for all required variables:

- `SUPABASE_URL` / `SUPABASE_KEY` — Supabase connection
- `ZADARA_*` — Storage bucket configuration
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google Photos OAuth
- `TOKEN_ENCRYPTION_KEY` — Encrypts stored OAuth tokens
- `NEXT_PUBLIC_APP_NAME` — Display name

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run seed` | Seed database with sample data |
| `npm run lint` | Run ESLint |

## License

ISC
