# References for Admin Analytics Dashboard

## Similar Implementations

### Existing Admin Dashboard
- **Location:** `src/app/admin/page.tsx`
- **Relevance:** Card layout pattern, stat card styling, data fetching pattern
- **Key patterns:** Grid of stat cards with icon + label + count, `bg-bg-card border border-border rounded-xl p-6`, loading state with '...'

### Admin Sidebar Navigation
- **Location:** `src/components/admin/admin-sidebar.tsx`
- **Relevance:** Adding new navigation item
- **Key patterns:** `navItems` array with href/label/icon, active state via `pathname.startsWith()`, lucide-react icons

## External Research

### Netflix Analytics
- Content creator dashboards show: views, watch hours, audience demographics
- Clean card-based layout with trend indicators
- Source: Netflix Tech Blog analytics engineering

### YouTube Studio Analytics
- Overview tab: key metrics cards (views, watch time, subscribers)
- Line charts for trends over time with date range selector
- Content tab: table of videos sorted by performance
- Audience tab: viewer demographics and activity patterns

### Dashboard UX Best Practices
- Most important metrics above the fold as large cards
- Trend indicators (up/down arrows with %) provide context without clicking
- Max 3-4 charts on main dashboard to avoid cognitive overload
- Date range filter as pill buttons for quick switching
- Tables for detailed data, charts for trends
