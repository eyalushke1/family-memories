# Download with Retry

Use exponential backoff and concurrency control for media downloads.

**Defaults (tuned for Google rate limits):**
```typescript
const DEFAULT_OPTIONS = {
  concurrency: 3,      // Max parallel downloads
  retries: 3,          // Retry attempts per item
  retryDelay: 1000,    // Initial delay (ms)
};
```

**Exponential backoff:**
```typescript
const delay = retryDelay * Math.pow(2, attempt);
// Attempt 0: 1s, Attempt 1: 2s, Attempt 2: 4s
```

**Concurrency control:**
- Process queue with max N concurrent tasks
- Use `Promise.race()` to wait for slot availability
- Track in-progress promises, splice on completion

**On failure:**
- Mark item as `failed` in index with error message
- Continue processing remaining items
- Return partial success result
