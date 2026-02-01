# Factory Client Pattern

Use factory functions that return API clients bound to a profile.

```typescript
// Good: Factory returns profile-scoped client
const client = createPhotosClient(profileId);
const albums = await client.listAlbums();
const media = await client.getAlbumMediaItems(albumId);

// Bad: Passing profileId to every call
await listAlbums(profileId);
await getAlbumMediaItems(profileId, albumId);
```

**Why:**
- Encapsulates auth token management per-profile
- Methods don't need profileId repeatedly
- Internal `apiRequest()` handles Bearer token injection

**Implementation:**
- Factory creates closure over `profileId`
- Internal helper fetches/refreshes token before each request
- Returns object with all API methods
