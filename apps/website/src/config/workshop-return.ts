const WORKSHOP_HOME = '/workshop/'

/** True if the string contains any C0 control char the URL parser would strip. */
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) <= 0x1f) return true
  }
  return false
}

/**
 * Where a visitor may be sent back to after sign-in or a purchase. Only a
 * same-origin absolute path qualifies; anything that could leave the origin
 * (a protocol-relative or backslash prefix, an absolute or javascript: URL,
 * or a path hiding one of those behind a stripped control char) falls back
 * to the Workshop home.
 *
 * The prefix checks alone are not enough: the WHATWG URL parser strips C0
 * control chars (tab, LF, CR) before parsing, so `/<TAB>//evil.com` passes a
 * literal `startsWith('//')` check yet the browser resolves it cross-origin.
 * So a control char is rejected outright, and the result is re-parsed against
 * the current origin to confirm it truly stays same-origin.
 */
export function safeReturnPath(raw: string | null | undefined): string {
  if (
    typeof raw !== 'string' ||
    !raw.startsWith('/') ||
    raw.startsWith('//') ||
    raw.startsWith('/\\') ||
    hasControlChar(raw)
  ) {
    return WORKSHOP_HOME
  }
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://comfy.org'
  try {
    const resolved = new URL(raw, origin)
    if (resolved.origin !== origin) return WORKSHOP_HOME
    return resolved.pathname + resolved.search + resolved.hash
  } catch {
    return WORKSHOP_HOME
  }
}

/**
 * Resolve an explicit return destination. A plain visit to the sign-in page
 * has no destination and must remain there after sign-in.
 */
export function requestedReturnPath(search: string): string | undefined {
  const raw = new URLSearchParams(search).get('returnTo')
  return raw ? safeReturnPath(raw) : undefined
}
