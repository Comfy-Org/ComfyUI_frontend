/** True if the string contains any C0 control char the URL parser would strip. */
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) <= 0x1f) return true
  }
  return false
}

/**
 * Where a visitor may be sent after sign-in. Only a same-origin absolute
 * path qualifies; anything that could leave the origin (a protocol-relative
 * or backslash prefix, an absolute or javascript: URL, or a path hiding one
 * of those behind a stripped control char) falls back.
 *
 * The prefix checks alone are not enough: the WHATWG URL parser strips C0
 * control chars (tab, LF, CR) before parsing, so `/<TAB>//evil.com` passes a
 * literal `startsWith('//')` check yet the browser resolves it cross-origin.
 * So a control char is rejected outright, and the result is re-parsed against
 * the origin to confirm it truly stays same-origin. That parse collapses dot
 * segments (`/.//evil.com` becomes `//evil.com`), so its output is checked too.
 */
export function safeInternalPath(
  raw: string | null | undefined,
  origin: string,
  fallback: string
): string {
  if (
    typeof raw !== 'string' ||
    !raw.startsWith('/') ||
    raw.startsWith('//') ||
    raw.startsWith('/\\') ||
    hasControlChar(raw)
  ) {
    return fallback
  }
  try {
    const resolved = new URL(raw, origin)
    const path = resolved.pathname + resolved.search + resolved.hash
    if (resolved.origin !== origin || path.startsWith('//')) return fallback
    return path
  } catch {
    return fallback
  }
}
