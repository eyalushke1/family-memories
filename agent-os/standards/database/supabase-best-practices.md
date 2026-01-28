# Supabase Best Practices

Comprehensive guide for connecting to, querying, and managing data with Supabase in this app.

## 1. Client Setup

Single client instance in `lib/supabase/client.ts`. Never create new clients elsewhere.

```typescript
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'
```

- Uses custom schema `finance_eom` (configured in `lib/supabase/config.ts`)
- Schema is set via client options `db.schema` — all `.from()` calls resolve to this schema automatically
- No need to prefix table names with schema

**Environment Variables:**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
SUPABASE_SCHEMA=finance_eom
SUPABASE_BRANCH=main
```

## 2. Configuration Check

Every API route must check `isSupabaseConfigured` before querying:

```typescript
if (!isSupabaseConfigured) {
  return NextResponse.json(
    { success: false, error: 'Database not configured. Please check environment variables.' },
    { status: 500 }
  )
}
```

## 3. Pagination — Always Use ORDER BY

**Critical:** Supabase pagination with `.range()` returns inconsistent results without `.order()`. Always include an ORDER BY clause.

```typescript
// CORRECT
let query = supabase
  .from('revenue_records')
  .select('customer_id, customer_name, amount')
  .eq('period', period)
  .order('id', { ascending: true })   // REQUIRED for consistent pagination
  .range(offset, offset + pageSize - 1)

// WRONG — will return duplicate/missing records across pages
let query = supabase
  .from('revenue_records')
  .select('customer_id, customer_name, amount')
  .eq('period', period)
  .range(offset, offset + pageSize - 1)
```

**Pagination loop pattern:**
```typescript
const pageSize = 1000
let offset = 0
let hasMore = true

while (hasMore) {
  const { data, error } = await supabase
    .from('table')
    .select('col1, col2')
    .order('id', { ascending: true })
    .range(offset, offset + pageSize - 1)

  if (error) throw error
  // Process data...
  offset += pageSize
  hasMore = data.length === pageSize
}
```

## 4. Query Patterns

**Select specific columns** — never use `select('*')` in production queries:
```typescript
.select('customer_id, customer_name, subsidiary, mrr, amount')
```

**Filter operators:**
```typescript
.eq('period', period)              // Exact match
.neq('status', 'Churn')           // Not equal
.in('control_name', namesArray)    // IN array
.or('is_active.eq.true,is_active.is.null')  // OR conditions
.range(offset, offset + size - 1)  // Pagination
```

**Expect single row:**
```typescript
const { data, error } = await supabase
  .from('table')
  .select('*')
  .eq('id', id)
  .single()
```

## 5. Batch Insert

Use batch size of 100 rows for inserts. Track batch position for error reporting:

```typescript
const BATCH_SIZE = 100

for (let i = 0; i < records.length; i += BATCH_SIZE) {
  const batch = records.slice(i, i + BATCH_SIZE)
  const { error } = await supabase.from('revenue_records').insert(batch)

  if (error) {
    // Store batch_start index for debugging
    return { success: false, error: `Insert failed at batch ${i}: ${error.message}` }
  }
}
```

## 6. Upsert Pattern

Use `onConflict` for upsert operations:

```typescript
const { error } = await supabase
  .from('eom_hierarchy_preferences')
  .upsert(data, {
    onConflict: 'customer_internal_id',
    ignoreDuplicates: false,
  })
```

## 7. Soft Delete

Use `is_active` flag instead of hard deletes for control results:

```typescript
// Soft delete
const { error } = await supabase
  .from('control_results')
  .update({
    is_active: false,
    dismissed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  .in('id', ids)

// Query active records (handle legacy null values)
.or('is_active.eq.true,is_active.is.null')
```

## 8. RPC Calls (Stored Procedures)

Use RPC for audit logging. These are non-fatal — wrap in try/catch and warn on failure:

```typescript
try {
  await supabase.rpc('log_upload', {
    p_session_id: sessionId,
    p_file_name: fileName,
    p_row_count: rowCount,
  })
} catch (auditError) {
  console.warn('Failed to create audit log:', auditError)
}
```

Available RPCs: `log_upload`, `log_mrr_override`, `log_control_run`, `log_answer_update`

All RPC parameters use `p_` prefix convention.

## 9. Error Handling

**Fatal errors** — return error response:
```typescript
const { data, error } = await supabase.from('table').select('*').eq('id', id)

if (error) {
  console.error('Failed to fetch:', error)
  return NextResponse.json(
    { success: false, error: `Failed to fetch: ${error.message}` },
    { status: 500 }
  )
}
```

**Non-fatal errors** — log and continue (e.g., audit logging, cleanup):
```typescript
const { error: deactivateError } = await supabase
  .from('control_results')
  .update({ is_active: false })
  .in('id', staleIds)

if (deactivateError) {
  console.error('Failed to deactivate stale results:', deactivateError)
  // Non-critical — continue with execution
}
```

## 10. Data Access Architecture

- **Server-side only** — All Supabase queries run in Next.js API routes (`app/api/`)
- **No client-side queries** — React components fetch via `fetch('/api/...')` hooks
- **Custom schema isolation** — All tables in `finance_eom` schema, not `public`
- **Read-only tables** — `dim_customer` is ETL-managed, never write to it from the app

## 11. Delete-Before-Insert for Period Data

When uploading new data for a period, delete existing records first:

```typescript
// Delete existing records for the period
const { error: deleteError } = await supabase
  .from('revenue_records')
  .delete()
  .eq('period', period)

if (deleteError) {
  return { success: false, error: 'Failed to delete existing period data' }
}

// Then insert new records in batches
for (let i = 0; i < records.length; i += BATCH_SIZE) {
  // ...batch insert
}
```

## 12. Aggregation Pattern

Supabase JS SDK doesn't support GROUP BY. Use in-app aggregation with Map:

```typescript
const aggregationMap = new Map<string, AggregatedRecord>()

// Paginate through all records
while (hasMore) {
  const { data } = await query.range(offset, offset + pageSize - 1)
  for (const record of data) {
    const key = `${record.customer_id}|${record.end_user_id}|${record.mrr}`
    const existing = aggregationMap.get(key)
    if (existing) {
      existing.amount += record.amount
    } else {
      aggregationMap.set(key, { ...record })
    }
  }
  offset += pageSize
  hasMore = data.length === pageSize
}
```
