/**
 * Media gateway access control.
 *
 * The storage bucket is private, but the media routes in front of it used to
 * serve any object to any caller. These helpers gate those routes on one of:
 *
 *   1. `fm-media-key` — an HMAC-signed, httpOnly cookie issued by the middleware
 *      on any page load. Browsers attach it to <video src> / <img src>
 *      automatically, so web, TV and share recipients need no client changes.
 *   2. `?t=` — a path-bound signed token, for consumers that cannot send
 *      cookies (e.g. a cast receiver fetching the URL itself).
 *
 * Uses Web Crypto rather than node:crypto so the identical implementation runs
 * in both the Edge middleware and the Node route handlers.
 *
 * NOTE: this stops direct fetching of storage paths. It is not viewer
 * authentication — anyone who loads the site is issued a cookie. Real
 * protection requires a login, which this app does not have.
 */

const COOKIE_NAME = 'fm-media-key'
const COOKIE_TTL_SECONDS = 12 * 60 * 60 // 12h
const TOKEN_TTL_SECONDS = 6 * 60 * 60 // 6h — cast sessions can outlast a signed storage URL

function getSecret(): string | null {
  // TOKEN_ENCRYPTION_KEY is already provisioned in Cloud Run, so no new secret
  // is required to deploy this.
  const secret = process.env.MEDIA_TOKEN_SECRET || process.env.TOKEN_ENCRYPTION_KEY
  return secret && secret.length > 0 ? secret : null
}

export function isMediaAccessConfigured(): boolean {
  return getSecret() !== null
}

async function hmac(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  // base64url, no padding
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Constant-time string comparison. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

async function sign(payload: string, ttlSeconds: number): Promise<string | null> {
  const secret = getSecret()
  if (!secret) return null
  const exp = nowSeconds() + ttlSeconds
  const sig = await hmac(`${payload}:${exp}`, secret)
  return `${exp}.${sig}`
}

async function verify(payload: string, value: string | undefined): Promise<boolean> {
  const secret = getSecret()
  if (!secret || !value) return false

  const dot = value.indexOf('.')
  if (dot < 1) return false

  const exp = Number(value.slice(0, dot))
  const sig = value.slice(dot + 1)
  if (!Number.isFinite(exp) || exp < nowSeconds()) return false

  const expected = await hmac(`${payload}:${exp}`, secret)
  return safeEqual(sig, expected)
}

// ── Browser cookie ─────────────────────────────────────────────────────────

export const MEDIA_COOKIE_NAME = COOKIE_NAME
export const MEDIA_COOKIE_MAX_AGE = COOKIE_TTL_SECONDS

/** Mint the value for the `fm-media-key` cookie. Null if no secret configured. */
export function issueMediaKey(): Promise<string | null> {
  return sign('media-key:v1', COOKIE_TTL_SECONDS)
}

export function verifyMediaKey(value: string | undefined): Promise<boolean> {
  return verify('media-key:v1', value)
}

// ── Path-bound token (cookie-less consumers) ───────────────────────────────

/** Sign a token that authorises exactly one storage path. */
export function signMediaToken(storagePath: string): Promise<string | null> {
  return sign(`media-path:v1:${storagePath}`, TOKEN_TTL_SECONDS)
}

export function verifyMediaToken(
  storagePath: string,
  token: string | undefined
): Promise<boolean> {
  return verify(`media-path:v1:${storagePath}`, token)
}

// ── Route guard ────────────────────────────────────────────────────────────

/**
 * True when the request may read `storagePath`: either it carries a valid
 * media-key cookie, or a `?t=` token signed for this exact path.
 */
export async function isMediaRequestAllowed(
  request: Request & { cookies?: { get(name: string): { value: string } | undefined } },
  storagePath: string
): Promise<boolean> {
  // Fail closed — an unset secret must not silently disable the gateway.
  if (!isMediaAccessConfigured()) return false

  const url = new URL(request.url)
  const token = url.searchParams.get('t') ?? undefined
  if (token && (await verifyMediaToken(storagePath, token))) return true

  const cookie =
    request.cookies?.get(COOKIE_NAME)?.value ??
    readCookieHeader(request.headers.get('cookie'), COOKIE_NAME)

  return verifyMediaKey(cookie)
}

function readCookieHeader(header: string | null, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return rest.join('=')
  }
  return undefined
}
