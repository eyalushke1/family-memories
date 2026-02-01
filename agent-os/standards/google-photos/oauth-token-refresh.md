# OAuth Token Auto-Refresh

Refresh tokens 5 minutes before expiry, not when expired.

```typescript
const isExpired = tokens.expiresAt < Date.now() + 5 * 60 * 1000;
if (isExpired) {
  const newTokens = await refreshAccessToken(tokens.refreshToken);
  await saveTokens(profileId, newTokens);
}
```

**Why 5-min buffer:**
- Prevents race conditions when token expires mid-request
- Avoids blocking user operations with refresh latency

**On refresh failure:**
- Delete stale tokens
- Return null (user must re-authenticate)

**Storage:**
- Production: Supabase `google_auth_tokens` table
- Development fallback: File storage (with security warning)
