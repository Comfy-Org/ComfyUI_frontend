const SAFE_EXTERNAL_URL_SCHEMES = new Set(['http:', 'https:'])

/**
 * Checks that `url` is a syntactically valid URL using only an http(s)
 * scheme, for use wherever a URL is bound to a clickable `href` (e.g. an
 * `<a>` tag) and could otherwise come from untrusted data (such as a
 * third-party registry). Unlike a bare `new URL(url)` validity check, this
 * rejects `javascript:`, `data:`, and other schemes that parse without
 * throwing but execute or render content on click.
 */
export function isSafeExternalUrl(url: string): boolean {
  try {
    return SAFE_EXTERNAL_URL_SCHEMES.has(new URL(url).protocol)
  } catch {
    return false
  }
}
