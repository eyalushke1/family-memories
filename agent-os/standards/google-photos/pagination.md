# Pagination Pattern

Google Photos API uses `pageToken`/`nextPageToken` for pagination.

**Single page:**
```typescript
const page = await client.listAlbums({ pageSize: 50, pageToken });
return {
  albums: page.albums,
  nextPageToken: page.nextPageToken,
};
```

**Fetch all pages:**
```typescript
const allItems: GoogleAlbum[] = [];
let pageToken: string | undefined;

do {
  const page = await client.listAlbums({ pageSize: 50, pageToken });
  allItems.push(...page.albums);
  pageToken = page.nextPageToken;
} while (pageToken);
```

**Rules:**
- Default pageSize: 50 for albums, 100 for media items
- Always handle empty arrays in response (`response.albums || []`)
- API max: 50 items per batch for `batchGet` operations
