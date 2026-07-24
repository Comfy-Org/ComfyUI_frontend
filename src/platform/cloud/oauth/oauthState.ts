import type { LocationQuery } from 'vue-router'

const OAUTH_REQUEST_ID_STORAGE_KEY = 'Comfy.OAuthRequestId'
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function readQueryString(value: LocationQuery[string]): string | null {
  return typeof value === 'string' ? value : null
}

function isOAuthRequestId(value: string): boolean {
  return UUID_PATTERN.test(value)
}

export function captureOAuthRequestId(query: LocationQuery): string | null {
  // The router guard calls this on every navigation. We can't unconditionally
  // clear on absence — the OAuth return-trip from a social-login provider
  // (Google / GitHub) arrives at /login with `code` + `state` in the query
  // but no `oauth_request_id`, and we need the previously-captured value to
  // survive that hop.
  //
  // We DO clear on an explicitly invalid value (present but malformed): that
  // shape is either a stale deep-link or probing, and a stale Comfy.OAuthRequestId
  // contaminating later flows is worse than dropping the bad input.
  const raw = query.oauth_request_id
  const value = readQueryString(raw)
  if (!value) {
    if (raw !== undefined) {
      // Present but non-string (e.g. repeated `?oauth_request_id=a&oauth_request_id=b`).
      sessionStorage.removeItem(OAUTH_REQUEST_ID_STORAGE_KEY)
    }
    return null
  }
  if (!isOAuthRequestId(value)) {
    sessionStorage.removeItem(OAUTH_REQUEST_ID_STORAGE_KEY)
    return null
  }

  sessionStorage.setItem(OAUTH_REQUEST_ID_STORAGE_KEY, value)
  return value
}

export function getOAuthRequestId(): string | null {
  const value = sessionStorage.getItem(OAUTH_REQUEST_ID_STORAGE_KEY)
  return value && isOAuthRequestId(value) ? value : null
}

export function clearOAuthRequestId(): void {
  sessionStorage.removeItem(OAUTH_REQUEST_ID_STORAGE_KEY)
}
