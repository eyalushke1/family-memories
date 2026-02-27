# Standards for Admin Analytics Dashboard

The following standards apply to this work. For the mockup phase, components/styling is the primary active standard. Database and loading standards will apply during the migration to real data.

---

## database/supabase-best-practices

Applies when migrating from mock data to real Supabase queries:
- All queries run server-side in API routes
- Use `isSupabaseConfigured` check
- Select specific columns (never `select('*')`)
- Include `.order()` for pagination consistency
- Use batch inserts for view event logging

## database/types-structure

Analytics types in `src/types/analytics.ts` follow the naming convention:
- Row types: `{Name}Row`
- Flat aliases for developer convenience
- Types serve as contract between data layer and UI

## components/styling

Active for mockup phase:
- Use `cn()` utility from `src/lib/utils.ts` for conditional classes
- CSS variables: `bg-bg-card`, `text-text-primary`, `text-text-secondary`, `border-border`
- Card pattern: `bg-bg-card border border-border rounded-xl p-6`
- Active state: `bg-accent text-white`
- Hover: `hover:bg-bg-card-hover transition-colors`

## components/loading-feedback

Applies when switching to async data:
- Show skeleton/loading states during data fetch
- Use existing '...' pattern from admin dashboard for metric cards
