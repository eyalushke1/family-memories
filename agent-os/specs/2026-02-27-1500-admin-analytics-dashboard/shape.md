# Admin Analytics Dashboard — Shaping Notes

## Status: COMPLETE

All phases implemented: mockup UI, real Supabase infrastructure, view tracking, and live data aggregation.

## Scope

Netflix/YouTube-style analytics section in the admin panel showing viewing statistics: total views, watch time, active viewers, completion rates, top clips, profile analysis, and recent activity. Data tracked from both web and TV players, stored in Supabase `view_events` table, aggregated by a GET API endpoint.

## Decisions

- **recharts** for charting: popular React library, SSR-safe, works with `'use client'` components
- **Single data interface** (`AnalyticsData`): One typed contract from API to UI components
- **4-layer tracking reliability**: heartbeat (15s), visibilitychange, beforeunload (sendBeacon), React cleanup
- **playState-based tracking**: Fires on `playState` change (not video `onPlaying`) to cover both video and presentation/slideshow clips
- **Refs over state in tracking closures**: All progress reads use refs to avoid stale closures in beforeunload/cleanup handlers
- **`clipTotalDurationRef`**: Stores total duration at tracking start so closures always have the correct value
- **Input validation**: UUID validation, numeric clamping (0-86400s for duration, 0-100 for completion)
- **Mock data deleted**: `src/lib/mock/analytics-data.ts` removed after migration to real data

## Architecture

```
Client (watch pages)
  trackViewStart() ─── POST /api/analytics/track {action:'start'}  ──> INSERT view_events
  trackViewProgress() ─ POST /api/analytics/track {action:'progress'} > UPDATE (no ended_at)
  trackViewEnd() ────── POST /api/analytics/track {action:'end'}    ──> UPDATE (sets ended_at)

Admin (analytics page)
  useEffect+fetch ──── GET /api/admin/analytics?range=30d ──> Aggregate view_events + clips + profiles
```

## Context

- **Visuals:** Researched Netflix Studio, YouTube Studio, Vimeo analytics dashboards
- **References:** Existing admin dashboard for card/layout patterns
- **Product alignment:** Helps the family curator understand engagement

## Standards Applied

- database/supabase-best-practices — Parameterized queries via Supabase SDK, no raw SQL
- database/types-structure — `ViewEventRow`, `InsertViewEvent`, `UpdateViewEvent` aliases
- components/styling — Uses existing CSS variables (bg-bg-card, text-text-primary, border-border)
- components/loading-feedback — Loading and error states on the analytics page
