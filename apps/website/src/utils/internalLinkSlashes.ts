/**
 * The rule `scripts/check-internal-link-slashes.ts` enforces against dist/:
 * every link to one of our own pages uses the slash-terminated canonical form,
 * so crawlers never meet the second address of a page.
 */

const HREF_ATTRIBUTE = /(?<![\w:-])href\s*=\s*(["'])(.*?)\1/gi
const FILE_EXTENSION = /\.[a-z][a-z0-9]*$/i

function internalPath(
  href: string,
  origins: readonly string[]
): string | undefined {
  if (href.startsWith('/') && !href.startsWith('//')) return href
  const origin = origins.find((candidate) => href.startsWith(`${candidate}/`))
  return origin === undefined ? undefined : href.slice(origin.length)
}

/** True when `href` points at one of our pages but drops the trailing slash. */
export function isSlashlessPageHref(
  href: string,
  origins: readonly string[]
): boolean {
  const path = internalPath(href, origins)?.split(/[?#]/)[0]
  if (!path || path.endsWith('/')) return false
  const lastSegment = path.slice(path.lastIndexOf('/') + 1)
  return !FILE_EXTENSION.test(lastSegment)
}

/** Every distinct slashless page href in one HTML document. */
export function slashlessPageHrefs(
  html: string,
  origins: readonly string[]
): string[] {
  return [
    ...new Set(
      hrefsIn(html).filter((href) => isSlashlessPageHref(href, origins))
    )
  ]
}

/** Every distinct href in one HTML document that points at an alias host. */
export function aliasHostHrefs(
  html: string,
  aliasOrigins: readonly string[]
): string[] {
  return [
    ...new Set(
      hrefsIn(html).filter((href) =>
        aliasOrigins.some((origin) => isOnOrigin(href, origin))
      )
    )
  ]
}

function isOnOrigin(href: string, origin: string): boolean {
  return (
    href === origin ||
    ['/', '?', '#'].some((next) => href.startsWith(`${origin}${next}`))
  )
}

function hrefsIn(html: string): string[] {
  return [...html.matchAll(HREF_ATTRIBUTE)].map((match) =>
    match[2].replaceAll('&amp;', '&')
  )
}
