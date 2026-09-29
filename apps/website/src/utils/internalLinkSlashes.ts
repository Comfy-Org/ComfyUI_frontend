/**
 * The rule `scripts/check-internal-link-slashes.ts` enforces against dist/:
 * every link to one of our own pages uses the slash-terminated canonical form,
 * so crawlers never meet the second address of a page.
 */

const HREF_ATTRIBUTE = /\bhref\s*=\s*["']([^"']*)["']/gi
const FILE_EXTENSION = /\.[a-z][a-z0-9]*$/i

function internalPath(href: string, origin: string): string | undefined {
  if (href.startsWith('/') && !href.startsWith('//')) return href
  if (href.startsWith(`${origin}/`)) return href.slice(origin.length)
  return undefined
}

/** True when `href` points at one of our pages but drops the trailing slash. */
export function isSlashlessPageHref(href: string, origin: string): boolean {
  const path = internalPath(href, origin)?.split(/[?#]/)[0]
  if (!path || path.endsWith('/')) return false
  const lastSegment = path.slice(path.lastIndexOf('/') + 1)
  return !FILE_EXTENSION.test(lastSegment)
}

/** Every distinct slashless page href in one HTML document. */
export function slashlessPageHrefs(html: string, origin: string): string[] {
  const hrefs = [...html.matchAll(HREF_ATTRIBUTE)].map((match) =>
    match[1].replaceAll('&amp;', '&')
  )
  return [...new Set(hrefs.filter((href) => isSlashlessPageHref(href, origin)))]
}
