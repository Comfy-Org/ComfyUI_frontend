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
 * the origin to confirm it truly stays same-origin. The normalised result is
 * then re-checked itself: dot-segment removal can leave a path starting with
 * `//`, which is protocol-relative once the browser re-resolves the returned
 * string.
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
    if (resolved.origin !== origin) return fallback
    const out = resolved.pathname + resolved.search + resolved.hash
    // Dot-segment normalisation can produce a path that itself begins with
    // `//` (`/..//evil.example` resolves same-origin but its pathname is
    // `//evil.example`), and the RETURNED string is what the browser
    // re-resolves — where a leading `//` is protocol-relative, i.e. another
    // origin. The rebuilt value must pass the same discipline as the input
    // (#20922).
    if (
      !out.startsWith('/') ||
      out.startsWith('//') ||
      out.startsWith('/\\') ||
      hasControlChar(out)
    ) {
      return fallback
    }
    return out
  } catch {
    return fallback
  }
}
