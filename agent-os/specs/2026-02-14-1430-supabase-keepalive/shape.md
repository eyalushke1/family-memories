# Supabase Keep-Alive — Shaping Notes

## Scope

Self-contained keep-alive system to prevent Supabase free-tier projects from pausing (7-day inactivity timeout). Supports managing multiple Supabase projects via admin UI.

## Decisions

- **Self-contained scheduler** (not Cloud Scheduler) — uses `instrumentation.ts` + `setInterval`
- **6-hour ping interval** — 28x redundancy within the 7-day window
- **Ping method** — `GET /rest/v1/` with apikey header (lightest authenticated request)
- **Self-ping first** — Always ping app's own Supabase via env vars before reading DB (chicken-and-egg)
- **Encrypted keys** — AES-256-GCM using existing `TOKEN_ENCRYPTION_KEY`
- **Database storage** — New `supabase_keepalive_projects` table with RLS "Deny all"
- **Sequential pings** — Simple and sufficient for small number of projects (1-5)

## Context

- **Visuals:** None
- **References:** Admin settings page pattern, Google OAuth token encryption
- **Product alignment:** Infrastructure utility, separate from core streaming features
