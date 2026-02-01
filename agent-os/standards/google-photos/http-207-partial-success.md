# HTTP 207 Multi-Status

Use HTTP 207 when a batch import has partial success.

```typescript
return NextResponse.json(result, {
  status: result.success ? 200 : 207,
});
```

**Response shape:**
```typescript
interface ImportResult {
  success: boolean;       // true only if ALL items succeeded
  totalItems: number;
  completedItems: number;
  failedItems: number;
  items: ImportProgress[];  // Per-item status
}
```

**Status codes:**
- `200` — All items imported successfully
- `207` — Some items failed, some succeeded
- `400` — Invalid request (missing params)
- `401` — Not connected / auth expired
- `500` — Complete failure

**Client handling:**
- Check `result.success` first
- If false, iterate `items` to show which failed
- Allow user to retry failed items
