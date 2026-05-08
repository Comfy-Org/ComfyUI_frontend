import type { LocationQuery } from 'vue-router'

const OAUTH_REQUEST_ID_STORAGE_KEY = 'Comfy.OAuthRequestId'
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function readQueryString(value: LocationQuery[string]): string | null {
  return typeof value === 'string' ? value : null
}

function isOAuthRequestId(value: string): boolean {
  return UUID_PATTERN.test(value)
}

function readStoredOAuthRequestId(): string | null {
  const value = sessionStorage.getItem(OAUTH_REQUEST_ID_STORAGE_KEY)
  return value && isOAuthRequestId(value) ? value : null
}

export function captureOAuthRequestId(query: LocationQuery): string | null {
  const value = readQueryString(query.oauth_request_id)
  if (!value || !isOAuthRequestId(value)) return null

  sessionStorage.setItem(OAUTH_REQUEST_ID_STORAGE_KEY, value)
  return value
}

export function getOAuthRequestId(): string | null {
  return readStoredOAuthRequestId()
}

export function hasOAuthRequestId(): boolean {
  return getOAuthRequestId() !== null
}

export function clearOAuthRequestId(): void {
  sessionStorage.removeItem(OAUTH_REQUEST_ID_STORAGE_KEY)
}
