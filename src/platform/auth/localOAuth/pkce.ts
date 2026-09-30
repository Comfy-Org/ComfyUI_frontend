export const LOCAL_OAUTH_CLIENT_ID = 'comfyui-local'
const LOCAL_OAUTH_CALLBACK_PATH = '/comfy-oauth-callback.html'
export const LOCAL_OAUTH_CHANNEL = 'comfy-local-oauth'
export const LOCAL_OAUTH_MESSAGE_TYPE = 'comfy-local-oauth-callback'

// Cloud registers comfyui-local only for these loopback hosts (any port).
const REDIRECT_HOSTS = new Set(['127.0.0.1', 'localhost'])

export interface PendingAuthorization {
  verifier: string
  state: string
  redirectUri: string
}

export type CallbackResult =
  | { ok: true; code: string }
  | { ok: false; reason: 'ignored' | 'state_mismatch' | 'denied' }

function base64Url(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function randomToken(byteLength = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)))
}

export async function s256Challenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  )
  return base64Url(new Uint8Array(digest))
}

export function supportsBrowserSignIn(location: Location | URL): boolean {
  return location.protocol === 'http:' && REDIRECT_HOSTS.has(location.hostname)
}

export function createPendingAuthorization(
  origin: string
): PendingAuthorization {
  return {
    verifier: randomToken(32),
    state: randomToken(16),
    redirectUri: `${origin}${LOCAL_OAUTH_CALLBACK_PATH}`
  }
}

export async function buildAuthorizeUrl(
  cloudBaseUrl: string,
  pending: PendingAuthorization
): Promise<string> {
  const url = new URL('/oauth/authorize', cloudBaseUrl)
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: LOCAL_OAUTH_CLIENT_ID,
    redirect_uri: pending.redirectUri,
    state: pending.state,
    code_challenge: await s256Challenge(pending.verifier),
    code_challenge_method: 'S256',
    resource: `${cloudBaseUrl}/api`
  }).toString()
  return url.toString()
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** Validates a message relayed by the callback page against the pending state. */
export function validateCallback(
  message: unknown,
  expectedState: string
): CallbackResult {
  if (typeof message !== 'object' || message === null) {
    return { ok: false, reason: 'ignored' }
  }
  const record = message as Record<string, unknown>
  if (record.type !== LOCAL_OAUTH_MESSAGE_TYPE) {
    return { ok: false, reason: 'ignored' }
  }
  if (readString(record, 'state') !== expectedState) {
    return { ok: false, reason: 'state_mismatch' }
  }
  const code = readString(record, 'code')
  if (readString(record, 'error') || !code) {
    return { ok: false, reason: 'denied' }
  }
  return { ok: true, code }
}
