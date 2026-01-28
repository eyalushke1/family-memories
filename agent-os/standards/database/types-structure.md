# Database Types Structure

## Nested Database Interface

Required for Supabase SDK compatibility:

```typescript
export interface Database {
  finance_eom: {
    Tables: {
      revenue_records: {
        Row: { ... }    // SELECT result
        Insert: { ... } // INSERT payload
        Update: { ... } // UPDATE payload
      }
    }
  }
}
```

## Type Aliases

Create flat aliases for developer convenience:

```typescript
export type RevenueRecordRow = Database['finance_eom']['Tables']['revenue_records']['Row']
export type InsertRevenueRecord = Database['finance_eom']['Tables']['revenue_records']['Insert']
export type UpdateRevenueRecord = Database['finance_eom']['Tables']['revenue_records']['Update']
```

**Naming convention:**
- Row types: `{TableName}Row` (e.g., `RevenueRecordRow`)
- Insert types: `Insert{TableName}` (e.g., `InsertRevenueRecord`)
- Update types: `Update{TableName}` (e.g., `UpdateRevenueRecord`)

- Omit Insert/Update for read-only tables (e.g., `dim_customer`)
- Omit Update for immutable tables (e.g., `audit_log`)
