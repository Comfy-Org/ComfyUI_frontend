const NAVIGABLE_PROTOCOLS = new Set(['http:', 'https:'])

/**
 * Narrows an untrusted URL to one that is safe to place in an `href`.
 *
 * `isValidUrl` in `@/utils/formatUtil` only asks whether `new URL` parses, and
 * `javascript:alert(1)` parses, so it is not a scheme guard. Vue does not
 * sanitize `:href` either, so binding a registry- or user-supplied string
 * needs this instead.
 *
 * @returns the URL when it is http(s), otherwise `undefined` so the caller
 * renders no `href` at all rather than a navigable hostile one.
 */
export function toSafeExternalHref(
  url: string | null | undefined
): string | undefined {
  if (!url) return undefined
  try {
    return NAVIGABLE_PROTOCOLS.has(new URL(url).protocol) ? url : undefined
  } catch {
    return undefined
  }
}
