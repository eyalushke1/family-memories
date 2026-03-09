# Security Code Review - Family Memories App

**Date:** 2026-03-09
**Reviewer:** Claude Code Security Review
**Application:** Family Memories (Next.js + Supabase + Zadara/S3 Storage)

---

## Executive Summary

This security review identified **26 findings** across the Family Memories application, including **3 critical**, **6 high**, **10 medium**, and **7 low** severity issues. The most urgent concerns center around the authentication system, which relies on a plain-text, unsigned cookie that can be trivially forged, and the fact that 18 out of 25 admin API routes lack server-side authorization checks.

---

## Findings

### CRITICAL Severity

#### C1: Forgeable Cookie-Based Authentication
- **Files:** `src/middleware.ts:14`, `src/lib/api/admin-check.ts:15`, `src/stores/profile-store.ts`
- **Description:** The entire authentication system relies on a plain-text cookie (`fm-profile-id`) containing a UUID. There is no cryptographic signature (JWT, HMAC, etc.) or server-side session mechanism. Any user who discovers or guesses a valid admin profile UUID can forge the cookie and gain full admin access.
- **Impact:** Complete authentication bypass. Any user can impersonate any other user, including admins.
- **Recommendation:** Replace the plain-text cookie with a signed session token (JWT with server-side secret, or use Supabase Auth). Set `HttpOnly`, `Secure`, and `SameSite=Strict` flags on all auth cookies.

#### C2: 18 of 25 Admin API Routes Missing Server-Side Authorization
- **Files:** All routes under `src/app/api/admin/` except 7 that have `checkAdmin()`
- **Description:** Only 7 admin API routes call `checkAdmin()`:
  - `admin/music/route.ts`
  - `admin/uploaded-music/route.ts`
  - `admin/google-photos/upload-music/route.ts`
  - `admin/google-photos/picker/media/route.ts`
  - `admin/google-photos/picker/proxy/route.ts`
  - `admin/google-photos/picker/session/route.ts`
  - `admin/google-photos/picker/session/[sessionId]/route.ts`

  The remaining **18 routes** have NO server-side authorization check:
  - `admin/categories/route.ts`
  - `admin/categories/[id]/route.ts`
  - `admin/categories/reorder/route.ts`
  - `admin/clips/route.ts`
  - `admin/clips/[id]/route.ts`
  - `admin/clips/[id]/profiles/route.ts`
  - `admin/clips/reorder/route.ts`
  - `admin/intros/route.ts`
  - `admin/intros/[id]/route.ts`
  - `admin/presentations/route.ts`
  - `admin/presentations/[id]/route.ts`
  - `admin/presentations/[id]/slides/route.ts`
  - `admin/upload/route.ts`
  - `admin/google-photos/debug/route.ts`
  - `admin/google-photos/media/route.ts`
  - `admin/google-photos/albums/route.ts`
  - `admin/google-photos/albums/[albumId]/media/route.ts`
  - `admin/google-photos/import/route.ts`

  These routes rely solely on Next.js middleware, which only protects page-level navigation. API routes can be called directly, bypassing middleware entirely.
- **Impact:** Any unauthenticated user can call admin API endpoints directly to create, modify, or delete categories, clips, intros, presentations, and upload files.
- **Recommendation:** Add `const adminErr = await checkAdmin(request); if (adminErr) return adminErr;` to every handler function in all admin routes.

#### C3: Path Traversal in Media Endpoints
- **Files:** `src/app/api/media/files/[...path]/route.ts:31`, `src/app/api/cast/media/[...path]/route.ts:44`
- **Description:** The `[...path]` catch-all route segments are joined with `/` and passed directly to `storage.download()` with no sanitization. While Next.js may decode path segments, there is no explicit check for `..` segments or path normalization.
- **Impact:** Depending on the storage backend implementation, an attacker may be able to traverse directories and access arbitrary files in the storage bucket.
- **Recommendation:** Validate that no path segment contains `..`, starts with `/`, or contains null bytes. Normalize the path and verify it stays within the expected storage prefix.

---

### HIGH Severity

#### H1: Profiles API is Fully Unauthenticated
- **File:** `src/app/api/profiles/route.ts:24-46`
- **Description:** `POST /api/profiles` allows anyone to create a profile with `is_admin: true` — there is no authentication check whatsoever. The request body's `is_admin` field is passed directly to the database insert.
- **Impact:** Any anonymous user can create an admin account and gain full administrative access.
- **Recommendation:** Either require existing admin authentication to create profiles, or remove `is_admin` from the insertable fields (only allow existing admins to grant admin status).

#### H2: Mass Assignment / Privilege Escalation on Profile Update
- **File:** `src/app/api/profiles/[id]/route.ts:40-43`
- **Description:** `PATCH /api/profiles/:id` spreads the entire request body into the database update: `{ ...body, updated_at: ... }`. An attacker can send `{ "is_admin": true }` to escalate any profile to admin.
- **Impact:** Any user can grant themselves admin privileges.
- **Recommendation:** Whitelist allowed update fields explicitly: `{ name: body.name, avatar_path: body.avatar_path }`.

#### H3: Unauthenticated Media File Access
- **Files:** `src/app/api/media/files/[...path]/route.ts`, `src/app/api/cast/media/[...path]/route.ts`
- **Description:** Both media endpoints serve files to any requester without authentication. Family photos and videos can be accessed by anyone who knows or guesses the storage path.
- **Impact:** Private family media exposed to unauthenticated users.
- **Recommendation:** Add authentication checks, or implement signed/time-limited URLs for media access.

#### H4: Debug Endpoint Leaks OAuth Tokens
- **File:** `src/app/api/admin/google-photos/debug/route.ts:56-64`
- **Description:** The debug endpoint returns partial access tokens (`tokenPreview`), full Google token info (including scopes, expiry, audience), and Photos API response data. It only checks for a cookie (which is forgeable — see C1) and does NOT call `checkAdmin()`.
- **Impact:** OAuth tokens and Google account metadata can be leaked to any user who sets the cookie.
- **Recommendation:** Remove this endpoint entirely in production, or at minimum add `checkAdmin()` and redact all token data.

#### H5: No File Upload Size Limit
- **File:** `src/app/api/admin/upload/route.ts:90`
- **Description:** The upload endpoint reads the entire file into memory via `Buffer.from(await file.arrayBuffer())` with no size limit. A large file can exhaust server memory.
- **Impact:** Denial of service via memory exhaustion.
- **Recommendation:** Add a file size check before reading (e.g., `if (file.size > MAX_SIZE) return errorResponse(...)`) and configure Next.js body size limits.

#### H6: Secrets Baked into Docker Image Layers
- **File:** `Dockerfile:19-25`
- **Description:** `SUPABASE_URL`, `SUPABASE_KEY`, and `NEXT_PUBLIC_APP_URL` are set via `ARG`/`ENV` in the builder stage. These values are permanently embedded in the image layers and can be extracted by anyone with access to the image.
- **Impact:** Database credentials exposed in container image.
- **Recommendation:** Use runtime environment variables or a secrets manager (e.g., Google Secret Manager with Cloud Run). Only `NEXT_PUBLIC_*` vars need to be available at build time — server-side secrets should be injected at runtime.

---

### MEDIUM Severity

#### M1: Supabase Service Role Key Used Application-Wide
- **File:** `src/lib/supabase/client.ts` (inferred from `.env.local.example`)
- **Description:** The `SUPABASE_KEY` is the service role key, which bypasses all Supabase Row-Level Security (RLS) policies. Every database call in the application uses this key.
- **Impact:** If the application-level auth is bypassed (see C1, C2), there are no database-level guards.
- **Recommendation:** Consider using the Supabase anon key with RLS policies for user-facing operations, and reserve the service role key for truly administrative operations.

#### M2: No Security Headers Configured
- **File:** `next.config.ts`
- **Description:** The Next.js config has no security headers. Missing: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- **Impact:** Increased exposure to XSS, clickjacking, MIME sniffing, and other client-side attacks.
- **Recommendation:** Add a `headers()` configuration to `next.config.ts` with appropriate security headers.

#### M3: Auth Cookie Missing Security Flags
- **File:** `src/stores/profile-store.ts` (client-side cookie set)
- **Description:** The `fm-profile-id` cookie is set client-side without `Secure`, `HttpOnly`, or `SameSite` flags.
- **Impact:** Cookie accessible via JavaScript (XSS risk), transmitted over HTTP (MITM risk), and vulnerable to CSRF.
- **Recommendation:** Set cookies server-side with `HttpOnly; Secure; SameSite=Strict` flags.

#### M4: Wildcard CORS on Cast Media Endpoint
- **File:** `src/app/api/cast/media/[...path]/route.ts:27`
- **Description:** `Access-Control-Allow-Origin: *` is set on all cast media responses with no authentication.
- **Impact:** Any website can embed/fetch family media content.
- **Recommendation:** Restrict CORS to the specific origin(s) needed for Chromecast functionality.

#### M5: OAuth State Parameter Not Cryptographically Verified
- **Description:** The OAuth state parameter appears to use base64-encoded JSON without a cryptographic signature (HMAC). The server cannot verify the state was generated by itself.
- **Impact:** OAuth CSRF attacks — an attacker could initiate an OAuth flow and trick a user into linking the attacker's Google account.
- **Recommendation:** Include an HMAC signature in the state parameter and verify it on callback.

#### M6: Supabase Error Messages Returned to Clients
- **Files:** Multiple API routes (e.g., `src/app/api/profiles/route.ts:19`, `src/app/api/profiles/[id]/route.ts:49`)
- **Description:** Supabase error messages containing table names, column names, and constraint details are passed directly to API responses via `error.message`.
- **Impact:** Information disclosure — reveals database schema to attackers.
- **Recommendation:** Return generic error messages to clients; log detailed errors server-side only.

#### M7: File Upload Type Validation Relies on Client-Reported MIME Type
- **File:** `src/app/api/admin/upload/route.ts:50-59`
- **Description:** File type validation uses `file.type`, which is the MIME type reported by the client. This can be trivially spoofed.
- **Impact:** An attacker could upload a malicious file (e.g., HTML with JavaScript) disguised as an image.
- **Recommendation:** Validate file contents using magic bytes/file signatures, not just the reported MIME type.

#### M8: Raw Request Body Passed to Database Updates
- **Files:** Multiple admin API routes (categories, clips, intros, presentations)
- **Description:** Several update endpoints spread the entire request body into database updates without field whitelisting. TypeScript types provide no runtime protection.
- **Impact:** Attackers can modify unexpected database columns.
- **Recommendation:** Explicitly whitelist allowed fields for each update operation.

#### M9: OAuth Tokens Logged to Console
- **File:** `src/app/api/admin/google-photos/debug/route.ts:30-31`, `src/lib/google/oauth.ts` (inferred)
- **Description:** Access tokens, token info, and API responses are logged via `console.log` in production code. On Cloud Run, these persist in Cloud Logging.
- **Impact:** Token exposure in log aggregation systems.
- **Recommendation:** Remove all token logging or use a structured logger with sensitive data redaction.

#### M10: Cloud Run Deployed with `--allow-unauthenticated`
- **File:** `cloudbuild.yaml` / `deploy.sh`
- **Description:** The Cloud Run service is configured to allow unauthenticated access, making the application-level auth the only line of defense.
- **Impact:** Combined with C1/C2, there is no defense in depth.
- **Recommendation:** This may be intentional for a public-facing app, but ensure application-level auth is robust (see C1, C2). Consider adding Cloud Armor or IAP for additional protection.

---

### LOW Severity

#### L1: No Rate Limiting
- **Files:** All API routes
- **Description:** No rate limiting is implemented on any endpoint.
- **Impact:** Susceptible to brute force, enumeration, and DoS attacks.
- **Recommendation:** Add rate limiting middleware or use a service like Cloudflare/Cloud Armor.

#### L2: No CSRF Protection on State-Changing Endpoints
- **Files:** All POST/PATCH/DELETE API routes
- **Description:** No CSRF tokens are used on any state-changing endpoint.
- **Impact:** Cross-site request forgery attacks possible if the cookie is set without `SameSite=Strict`.
- **Recommendation:** Set `SameSite=Strict` on auth cookies and/or implement CSRF tokens.

#### L3: Container Filesystem is Writable
- **File:** `Dockerfile`
- **Description:** The container does not use a read-only filesystem (`--read-only` flag).
- **Impact:** If compromised, an attacker can write files to the container filesystem.
- **Recommendation:** Consider adding `--read-only` flag in Cloud Run deployment configuration.

#### L4: Deprecated Container Registry
- **File:** `cloudbuild.yaml`
- **Description:** Uses `gcr.io` which is deprecated in favor of `Artifact Registry`.
- **Impact:** May lose support in the future.
- **Recommendation:** Migrate to Artifact Registry (`REGION-docker.pkg.dev`).

#### L5: `setup-secrets.sh` Echoes Secret Values
- **File:** `setup-secrets.sh`
- **Description:** Uses `read -p` instead of `read -sp` for secret input, making values visible on screen.
- **Impact:** Shoulder surfing / terminal history exposure.
- **Recommendation:** Use `read -sp` for sensitive prompts.

#### L6: Profile DELETE Endpoint is Unauthenticated
- **File:** `src/app/api/profiles/[id]/route.ts:55-75`
- **Description:** Any user can delete any profile by ID without authentication.
- **Impact:** Profile data deletion by unauthorized users.
- **Recommendation:** Require admin authentication for profile deletion.

#### L7: Duplicate OAuth Callback Routes
- **Description:** Multiple OAuth callback route files exist, which may cause confusion and maintenance issues.
- **Impact:** Potential for inconsistent behavior.
- **Recommendation:** Consolidate to a single callback route.

---

## Remediation Priority

### Phase 1 - Critical (Immediate)
1. **Fix authentication** (C1): Implement signed sessions (JWT or server-side sessions)
2. **Protect profile creation** (H1, H2): Remove `is_admin` from user-settable fields, whitelist update fields
3. **Add `checkAdmin()` to all admin routes** (C2): Quick win once auth is solid
4. **Add path traversal protection** (C3): Validate and sanitize media path segments

### Phase 2 - High (Within 1 Week)
5. **Add media endpoint authentication** (H3)
6. **Remove or secure debug endpoint** (H4)
7. **Add upload size limits** (H5)
8. **Fix Docker secrets** (H6): Use runtime injection instead of build args

### Phase 3 - Medium (Within 1 Month)
9. Add security headers (M2)
10. Set cookie security flags (M3)
11. Restrict CORS (M4)
12. Whitelist update fields across all routes (M8)
13. Redact sensitive data from logs (M9)
14. Return generic error messages to clients (M6)

### Phase 4 - Low (Ongoing Hardening)
15. Add rate limiting (L1)
16. Add CSRF protection (L2)
17. Container security hardening (L3, L4)
18. Fix secrets script (L5)

---

## Summary Table

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 3     | Requires immediate attention |
| HIGH     | 6     | Fix within 1 week |
| MEDIUM   | 10    | Fix within 1 month |
| LOW      | 7     | Ongoing hardening |
| **Total** | **26** | |
