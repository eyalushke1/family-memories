# Tech Stack

## Frontend

- **Next.js 14+** — App Router, React Server Components, API routes
- **Tailwind CSS** — Utility-first styling, dark theme, responsive design
- **Framer Motion** — Page transitions, hover animations, Netflix-style dynamic movements
- **shadcn/ui** — Accessible base components (dialogs, dropdowns, forms) customized for dark theme
- **TypeScript** — Full type safety across the codebase

## Backend

- **Next.js API Routes** — Server-side logic, media proxy, admin operations
- **Zadara NGOS** — S3-compatible object storage for video files, thumbnails, and avatars
  - `@aws-sdk/client-s3` with `forcePathStyle: true`
  - API proxy pattern — all media served through `/api/media/files/`
  - See standard: `storage/zadara-ngos`

## Database

- **Supabase (PostgreSQL)** — All application metadata
  - Profiles, categories, clips, watch history
  - Custom schema isolation
  - Server-side queries only (no client-side Supabase calls)
  - See standard: `database/supabase-best-practices`

## Hosting & Deployment

- **Google Cloud Run** — Containerized Next.js deployment
  - Auto-scaling, pay-per-use
  - Docker container build
  - Environment variables for Supabase + Zadara credentials

## Key Libraries

- **react-player** or custom HTML5 video — Netflix-style video playback
- **sharp** — Server-side image processing (thumbnails)
- **zustand** or React Context — Client-side state (current profile, player state)
- **next-auth** or custom — Profile selection (not full auth for MVP, profile-based access)
