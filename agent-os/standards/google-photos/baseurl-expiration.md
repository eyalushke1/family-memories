# baseUrl Expiration

Google Photos `baseUrl` expires after ~60 minutes. Never cache or store these URLs.

**Always fetch fresh URL before download:**
```typescript
async function getDownloadUrl(mediaItemId: string): Promise<string> {
  const item = await this.getMediaItem(mediaItemId);
  const isVideo = item.mimeType.startsWith('video/');
  return `${item.baseUrl}${isVideo ? '=dv' : '=d'}`;
}
```

**URL suffixes:**
- `=d` — Download original image
- `=dv` — Download original video
- `=w{width}-h{height}` — Thumbnail at specified dimensions

**Never:**
- Store `baseUrl` in database for later use
- Cache URLs longer than a few minutes
- Assume URLs from list responses are still valid

**Why:** Google rotates URLs for security. Stale URLs return 403 errors.
