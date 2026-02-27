# Admin Analytics Dashboard — Mockup Phase

## Context

The Family Memories admin panel currently has no visibility into how content is consumed — no view counts, watch time, or engagement data. The admin (family curator) wants a Netflix/YouTube-style analytics section to understand which clips are popular, who's watching, and overall engagement trends.

**This plan is mockup-only:** Build the full analytics UI with hardcoded mock data, wired into the admin panel. No Supabase tables or real tracking infrastructure yet. The code is structured so mock data can be swapped for real API calls later with minimal changes.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/types/analytics.ts` | TypeScript interfaces for all analytics data |
| `src/lib/mock/analytics-data.ts` | Mock data generator returning all data by date range |
| `src/components/admin/analytics/date-range-filter.tsx` | Date range pill buttons (7d / 30d / 90d / All) |
| `src/components/admin/analytics/metric-card.tsx` | Single KPI card with trend indicator |
| `src/components/admin/analytics/metric-cards-row.tsx` | Row of 4 metric cards |
| `src/components/admin/analytics/views-over-time-chart.tsx` | Line chart — daily views (recharts) |
| `src/components/admin/analytics/top-clips-chart.tsx` | Horizontal bar chart — most watched clips |
| `src/components/admin/analytics/activity-table.tsx` | Recent viewing activity table with sorting |
| `src/app/admin/analytics/page.tsx` | Analytics page assembling all components |
| `agent-os/specs/2026-02-27-1500-admin-analytics-dashboard/` | Spec folder (plan, shape, standards, references) |

## File to Modify

| File | Change |
|------|--------|
| `src/components/admin/admin-sidebar.tsx` | Add "Analytics" nav item with `BarChart3` icon after Dashboard |

---

## Tasks

### Task 1: Save Spec Documentation
Create `agent-os/specs/2026-02-27-1500-admin-analytics-dashboard/` with:
- `plan.md` — This plan
- `shape.md` — Scope, decisions, context
- `standards.md` — Applied standards (supabase-best-practices, types-structure, components/styling, components/loading-feedback)
- `references.md` — Netflix/YouTube analytics patterns studied, existing admin dashboard reference

### Task 2: Install recharts
`npm install recharts` — React charting library built on D3. SSR-safe, works with `'use client'` components. Only new dependency needed.

### Task 3: Create Analytics Types (`src/types/analytics.ts`)
Interfaces that serve as contract between mock data and UI:
- `DateRange` — `'7d' | '30d' | '90d' | 'all'`
- `AnalyticsMetrics` — totalViews, totalWatchTimeMinutes, activeViewers, avgCompletionRate (each with trend %)
- `DailyViewsDataPoint` — date, views, uniqueViewers
- `TopClipData` — clipId, title, views, avgCompletionRate, totalWatchTimeMinutes
- `RecentViewEntry` — clipTitle, viewerName, viewerAvatar, watchedAt, durationWatched, clipDuration, completionPercent
- `AnalyticsData` — aggregated response containing all above

### Task 4: Create Mock Data Module (`src/lib/mock/analytics-data.ts`)
Export `getMockAnalyticsData(range: DateRange): AnalyticsData`:
- **Metrics:** Family-scale values (1,247 views, 80.5 hrs watch time, 6 active viewers, 73% completion) with positive trends
- **Daily views:** Deterministic array using date seeds (stable across renders), size varies by range
- **Top clips:** 8 clips with family-memory titles sorted by views
- **Recent views:** ~15 entries with family profile names (Dad, Mom, Sarah, Jake, Grandma) and recent timestamps
- Metric totals adjust by range for responsive feel

### Task 5: Build Analytics Components
6 components in `src/components/admin/analytics/`:

**date-range-filter.tsx** — Pill buttons: active = `bg-accent text-white`, inactive = `bg-bg-card border border-border`

**metric-card.tsx** — Matches existing dashboard cards (`bg-bg-card border border-border rounded-xl p-6`). Icon with colored bg, label, big number, trend arrow (green/red) + trend label. Props: label, value, trend, trendLabel, icon, iconColor

**metric-cards-row.tsx** — `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6`:
1. Total Views — `Eye` icon, blue
2. Watch Time — `Clock` icon, purple, formatted as hours
3. Active Viewers — `Users` icon, green
4. Avg. Completion — `TrendingUp` icon, orange

**views-over-time-chart.tsx** — Recharts `LineChart` in card wrapper:
- Two lines: Views (accent `#e50914`) and Unique Viewers (`#6366f1`)
- Dark theme: grid `#2a2a2a`, axis `#737373`, custom tooltip `bg-bg-secondary`
- 300px height, `ResponsiveContainer`

**top-clips-chart.tsx** — Recharts `BarChart layout="vertical"`:
- Horizontal bars in accent red, top 8 clips
- Y-axis: clip titles (truncated ~25 chars), X-axis: view counts

**activity-table.tsx** — Table in card wrapper:
- Columns: Clip, Viewer (avatar initial + name), Date (relative), Duration (watched/total), Completion (inline progress bar + %)
- Row hover: `hover:bg-bg-card-hover`
- Client-side sorting by clicking column headers

### Task 6: Create Analytics Page (`src/app/admin/analytics/page.tsx`)
Layout:
```
Header: "Analytics" h1 + DateRangeFilter (right)
MetricCardsRow
Two-column grid (lg): ViewsOverTimeChart | TopClipsChart
Full-width: ActivityTable
```
State: `dateRange` controls mock data variant. Synchronous mock call — later swappable to `useEffect + fetch`.

### Task 7: Update Sidebar Navigation
In `src/components/admin/admin-sidebar.tsx`:
- Import `BarChart3` from lucide-react
- Add `{ href: '/admin/analytics', label: 'Analytics', icon: BarChart3 }` as second item (after Dashboard)

### Task 8: Test & Verify
- `npm run dev` → navigate to `/admin/analytics`
- All 4 metric cards render with values and trends
- Both charts render correctly with dark theme
- Activity table populated, sorting works
- Date range filter toggles data
- Sidebar shows Analytics, highlights when active
- Responsive: cards and charts stack on narrow screens
- Dark/light theme compatibility

---

## Migration Path (Future — NOT in this plan)
1. Create Supabase `view_events` table
2. Add tracking calls in watch page components
3. Create `/api/admin/analytics` route returning `AnalyticsData`
4. Replace `getMockAnalyticsData()` with `useEffect + fetch` + loading state
5. All UI components remain unchanged — they only consume typed props
